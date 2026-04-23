import { AIClient, SYSTEM_PROMPTS, type AIProviderConfig } from '@zimhealth/ai-client';
import { db } from '../lib/db';
import { redis } from '../lib/redis';
import { getLearnerCPDSummary } from './cpd-engine';
import { buildEligibleCourseWhere } from './course-eligibility';

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
): Promise<{
  courseIds: string[];
  explanations: Record<string, string>;
  reasonCategories: Record<string, string[]>;
  isProfileBased: boolean;
}> {
  const cacheKey = `ai:recs:${learnerId}`;
  const cached = await redisGetSafe(cacheKey);
  if (cached) {
    return JSON.parse(cached) as {
      courseIds: string[];
      explanations: Record<string, string>;
      reasonCategories: Record<string, string[]>;
      isProfileBased: boolean;
    };
  }

  // ── Gather learner context ────────────────────────────────────────────────
  const [learner, summary, completedEnrollments, inProgressEnrollments, recentQuizAttempts] = await Promise.all([
    db.user.findUnique({
      where: { id: learnerId },
      select: { cadre: true, councilId: true, professionalTitle: true, institution: true, province: true },
    }),
    getLearnerCPDSummary(learnerId),
    db.enrollment.findMany({
      where: { learnerId, completedAt: { not: null } },
      select: { courseId: true, course: { select: { title: true, category: true, tags: true } } },
      take: 20,
    }),
    db.enrollment.findMany({
      where: { learnerId, completedAt: null },
      select: {
        progress: true,
        lastAccessAt: true,
        course: { select: { title: true, category: true } },
      },
      orderBy: [{ lastAccessAt: 'desc' }, { enrolledAt: 'desc' }],
      take: 10,
    }),
    db.quizAttempt.findMany({
      where: { learnerId },
      orderBy: { completedAt: 'desc' },
      take: 30,
      select: {
        score: true,
        passed: true,
        completedAt: true,
        quiz: { select: { title: true, courseId: true } },
      },
    }),
  ]);

  const enrolledIds = await db.enrollment
    .findMany({ where: { learnerId }, select: { courseId: true } })
    .then((rows) => rows.map((r) => r.courseId));

  const availableCourses = await db.course.findMany({
    where: { ...buildEligibleCourseWhere(learner), id: { notIn: enrolledIds } },
    select: { id: true, title: true, category: true, tags: true, cpdPoints: true, targetCadres: true, targetTitles: true },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  if (!availableCourses.length) {
    return { courseIds: [], explanations: {}, reasonCategories: {}, isProfileBased: false };
  }

  const ai = new AIClient(buildAiConfig());
  const yearEnd = new Date(new Date().getFullYear(), 11, 31);
  const daysToRenewal = Math.ceil((yearEnd.getTime() - Date.now()) / 86400000);

  const isProfileBased = completedEnrollments.length === 0;

  const quizCourseIds = [...new Set(recentQuizAttempts.map((a) => a.quiz.courseId))];
  const quizCourses = await db.course.findMany({
    where: { id: { in: quizCourseIds } },
    select: { id: true, category: true, title: true },
  });
  const courseById = new Map(quizCourses.map((c) => [c.id, c]));

  const categoryStats = new Map<string, { total: number; count: number; failures: number }>();
  for (const a of recentQuizAttempts) {
    const cat = courseById.get(a.quiz.courseId)?.category ?? 'UNKNOWN';
    const existing = categoryStats.get(cat) ?? { total: 0, count: 0, failures: 0 };
    existing.total += a.score;
    existing.count += 1;
    if (!a.passed) existing.failures += 1;
    categoryStats.set(cat, existing);
  }
  const weakestCategories = [...categoryStats.entries()]
    .map(([cat, v]) => ({ cat, avg: v.count ? v.total / v.count : 0, failures: v.failures, count: v.count }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 2);

  // ── Cold-start: profile-only prompt (no completion history) ──────────────
  const prompt = isProfileBased
    ? `A health professional has just joined ZimHealth CPD. They have no completed courses yet.

Learner profile:
- Cadre: ${learner?.cadre ?? 'Registered Nurse'}
- Professional title: ${learner?.professionalTitle ?? 'Not set'}
- Institution: ${learner?.institution ?? 'Unknown'}
- Province: ${learner?.province ?? 'Zimbabwe'}
- CPD Points: 0/${summary.requiredPoints} required
- Days to renewal: ${daysToRenewal}

Available courses (recommend the most relevant 3 for this cadre):
${availableCourses.map((c) => `- ${c.id}: "${c.title}" (${c.category}, ${c.cpdPoints} pts, for: ${[...((c.targetTitles as string[]) ?? []), ...((c.targetCadres as string[]) ?? [])].join(', ') || 'all eligible health workers'})`).join('\n')}

Return JSON: { "recommendations": [ { "courseId": "...", "reason": "under 20 words why this suits their role" } ] }
Order by relevance to their cadre. Max 3.`
    : `Learner profile:
- Cadre: ${learner?.cadre ?? 'Nurse'}
- Professional title: ${learner?.professionalTitle ?? 'Not set'}
- Institution: ${learner?.institution ?? 'Unknown'}
- Province: ${learner?.province ?? 'Unknown'}
- CPD Points: ${summary.totalPoints}/${summary.requiredPoints} (${summary.percentComplete}% complete)
- Days to renewal: ${daysToRenewal}
- Completed courses: ${completedEnrollments.map((e) => e.course.title).join(', ')}
- In-progress courses: ${inProgressEnrollments.length ? inProgressEnrollments.map((e) => `${e.course.title} (${Math.round(e.progress * 100)}%)`).join(', ') : 'None'}
- Weakest quiz categories: ${weakestCategories.length ? weakestCategories.map((w) => `${w.cat} (avg ${Math.round(w.avg)}%, fails ${w.failures}/${w.count})`).join(', ') : 'No quiz attempts yet'}

Available courses:
${availableCourses.map((c) => `- ${c.id}: "${c.title}" (${c.category}, ${c.cpdPoints} pts)`).join('\n')}

Return JSON:
{
  "recommendations": [
    {
      "courseId": "...",
      "reason": "under 25 words",
      "categories": ["deadline" | "specialty_fit" | "knowledge_gap" | "points_efficiency"]
    }
  ]
}
Prioritise: renewal gap closure → weak knowledge areas → cadre fit → points efficiency. Max 3.`;

  try {
    const raw = await ai.complete(prompt, {
      systemPrompt: SYSTEM_PROMPTS.COURSE_RECOMMENDER,
      maxTokens: 500,
      temperature: 0.3,
    });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid AI response');

    const parsed = JSON.parse(jsonMatch[0]) as {
      recommendations?: Array<{ courseId?: string; reason?: string; categories?: string[] }>;
    };

    const recommendations = (parsed.recommendations ?? [])
      .filter((item): item is { courseId: string; reason: string; categories?: string[] } => Boolean(item.courseId && item.reason))
      .slice(0, 3);

    const result = {
      courseIds: recommendations.map((item) => item.courseId),
      explanations: Object.fromEntries(recommendations.map((item) => [item.courseId, item.reason])),
      reasonCategories: Object.fromEntries(
        recommendations.map((item) => [
          item.courseId,
          (item.categories ?? []).filter((c) =>
            ['deadline', 'specialty_fit', 'knowledge_gap', 'points_efficiency'].includes(c),
          ),
        ]),
      ),
      isProfileBased,
    };

    await redisSetexSafe(cacheKey, CACHE_TTL, JSON.stringify(result));
    return result;
  } catch {
    return { courseIds: [], explanations: {}, reasonCategories: {}, isProfileBased };
  }
}
