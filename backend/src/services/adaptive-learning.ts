import { AIClient, SYSTEM_PROMPTS, type AIProviderConfig } from '@nursepro/ai-client';
import { db } from '../lib/db';
import { redis } from '../lib/redis';
import { getLearnerCPDSummary } from './cpd-engine';

const CACHE_TTL = 60 * 60 * 12; // 12 hours

function buildAiConfig(): AIProviderConfig {
  return {
    anthropic: process.env.ANTHROPIC_API_KEY
      ? {
          apiKey: process.env.ANTHROPIC_API_KEY,
          defaultModel: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
        }
      : undefined,
    openai: process.env.OPENAI_API_KEY
      ? {
          apiKey: process.env.OPENAI_API_KEY,
          defaultModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
          baseUrl: process.env.OPENAI_BASE_URL || undefined,
        }
      : undefined,
    gemini: process.env.GEMINI_API_KEY
      ? {
          apiKey: process.env.GEMINI_API_KEY,
          defaultModel: process.env.GEMINI_MODEL ?? 'gemini-1.5-pro',
        }
      : undefined,
    ollama: process.env.OLLAMA_BASE_URL
      ? {
          baseUrl: process.env.OLLAMA_BASE_URL,
          defaultModel: process.env.OLLAMA_MODEL ?? 'llama3',
        }
      : undefined,
  };
}

async function redisGetSafe(key: string): Promise<string | null> {
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

async function redisSetexSafe(key: string, ttl: number, value: string): Promise<void> {
  try {
    await redis.setex(key, ttl, value);
  } catch {
    // Cache is optional; recommendations still work without Redis.
  }
}

// ─── Exported so enrollment route can bust the cache on course completion ─────
export async function invalidateRecommendations(learnerId: string): Promise<void> {
  try {
    await redis.del(`ai:recs:${learnerId}`);
  } catch {
    // Ignore Redis errors
  }
}

export async function getRecommendations(
  learnerId: string,
): Promise<{ courseIds: string[]; explanations: Record<string, string>; isProfileBased: boolean }> {
  const cacheKey = `ai:recs:${learnerId}`;
  const cached = await redisGetSafe(cacheKey);
  if (cached) {
    return JSON.parse(cached) as {
      courseIds: string[];
      explanations: Record<string, string>;
      isProfileBased: boolean;
    };
  }

  // ── Gather learner context ────────────────────────────────────────────────
  const [learner, summary, completedEnrollments] = await Promise.all([
    db.user.findUnique({
      where: { id: learnerId },
      select: { cadre: true, institution: true, province: true },
    }),
    getLearnerCPDSummary(learnerId),
    db.enrollment.findMany({
      where: { learnerId, completedAt: { not: null } },
      select: { courseId: true, course: { select: { title: true, category: true, tags: true } } },
      take: 20,
    }),
  ]);

  const enrolledIds = await db.enrollment
    .findMany({ where: { learnerId }, select: { courseId: true } })
    .then((rows) => rows.map((r) => r.courseId));

  const availableCourses = await db.course.findMany({
    where: { status: 'PUBLISHED', id: { notIn: enrolledIds } },
    select: { id: true, title: true, category: true, tags: true, cpdPoints: true, targetCadres: true },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  if (!availableCourses.length) {
    return { courseIds: [], explanations: {}, isProfileBased: false };
  }

  const ai = new AIClient(buildAiConfig());
  const yearEnd = new Date(new Date().getFullYear(), 11, 31);
  const daysToRenewal = Math.ceil((yearEnd.getTime() - Date.now()) / 86400000);

  const isProfileBased = completedEnrollments.length === 0;

  // ── Cold-start: profile-only prompt (no completion history) ──────────────
  const prompt = isProfileBased
    ? `A nurse has just joined NursePro CPD. They have no completed courses yet.

Learner profile:
- Cadre: ${learner?.cadre ?? 'Registered Nurse'}
- Institution: ${learner?.institution ?? 'Unknown'}
- Province: ${learner?.province ?? 'Zimbabwe'}
- CPD Points: 0/${summary.requiredPoints} required
- Days to renewal: ${daysToRenewal}

Available courses (recommend the most relevant 3 for this cadre):
${availableCourses.map((c) => `- ${c.id}: "${c.title}" (${c.category}, ${c.cpdPoints} pts, for: ${(c.targetCadres as string[]).join(', ')})`).join('\n')}

Return JSON: { "recommendations": [ { "courseId": "...", "reason": "under 20 words why this suits their role" } ] }
Order by relevance to their cadre. Max 3.`
    : `Learner profile:
- Cadre: ${learner?.cadre ?? 'Nurse'}
- Institution: ${learner?.institution ?? 'Unknown'}
- Province: ${learner?.province ?? 'Unknown'}
- CPD Points: ${summary.totalPoints}/${summary.requiredPoints} (${summary.percentComplete}% complete)
- Days to renewal: ${daysToRenewal}
- Completed courses: ${completedEnrollments.map((e) => e.course.title).join(', ')}

Available courses:
${availableCourses.map((c) => `- ${c.id}: "${c.title}" (${c.category}, ${c.cpdPoints} pts)`).join('\n')}

Return JSON: { "recommendations": [ { "courseId": "...", "reason": "under 20 words" } ] }
Order by highest value for this learner. Max 3.`;

  try {
    const raw = await ai.complete(prompt, {
      systemPrompt: SYSTEM_PROMPTS.COURSE_RECOMMENDER,
      maxTokens: 500,
      temperature: 0.3,
    });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid AI response');

    const parsed = JSON.parse(jsonMatch[0]) as {
      recommendations?: Array<{ courseId?: string; reason?: string }>;
    };

    const recommendations = (parsed.recommendations ?? [])
      .filter((item): item is { courseId: string; reason: string } => Boolean(item.courseId && item.reason))
      .slice(0, 3);

    const result = {
      courseIds: recommendations.map((item) => item.courseId),
      explanations: Object.fromEntries(recommendations.map((item) => [item.courseId, item.reason])),
      isProfileBased,
    };

    await redisSetexSafe(cacheKey, CACHE_TTL, JSON.stringify(result));
    return result;
  } catch {
    return { courseIds: [], explanations: {}, isProfileBased };
  }
}
