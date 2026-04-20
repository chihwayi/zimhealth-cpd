import { AIClient, SYSTEM_PROMPTS, type AIProviderConfig } from '@nursepro/ai-client';
import { db } from '../lib/db';
import { redis } from '../lib/redis';
import { getLearnerCPDSummary } from './cpd-engine';

const CACHE_TTL = 60 * 60 * 12;

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

export async function getRecommendations(
  learnerId: string,
): Promise<{ courseIds: string[]; explanations: Record<string, string> }> {
  const cacheKey = `ai:recs:${learnerId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

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

  if (completedEnrollments.length < 3) {
    return { courseIds: [], explanations: {} };
  }

  const enrolledIds = await db.enrollment
    .findMany({
      where: { learnerId },
      select: { courseId: true },
    })
    .then((rows) => rows.map((row) => row.courseId));

  const availableCourses = await db.course.findMany({
    where: { status: 'PUBLISHED', id: { notIn: enrolledIds } },
    select: { id: true, title: true, category: true, tags: true, cpdPoints: true },
    take: 20,
  });

  if (!availableCourses.length) {
    return { courseIds: [], explanations: {} };
  }

  const ai = new AIClient(buildAiConfig());
  const yearEnd = new Date(new Date().getFullYear(), 11, 31);
  const daysToRenewal = Math.ceil((yearEnd.getTime() - Date.now()) / 86400000);

  const prompt = `Learner profile:
- Cadre: ${learner?.cadre ?? 'NURSE'}
- Institution: ${learner?.institution ?? 'Unknown'}
- Province: ${learner?.province ?? 'Unknown'}
- CPD Points: ${summary.totalPoints}/${summary.requiredPoints} (${summary.percentComplete}% complete)
- Days to renewal: ${daysToRenewal}
- Completed courses: ${completedEnrollments.map((enrollment) => enrollment.course.title).join(', ')}

Available courses:
${availableCourses.map((course) => `- ${course.id}: "${course.title}" (${course.category}, ${course.cpdPoints} pts)`).join('\n')}

Return a JSON object:
{ "recommendations": [ { "courseId": "...", "reason": "short reason under 20 words" } ] }
Order by highest value for this learner first. Max 3 recommendations.`;

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
    };

    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
    return result;
  } catch {
    return { courseIds: [], explanations: {} };
  }
}
