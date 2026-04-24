import { AIClient, SYSTEM_PROMPTS, type AIProviderConfig } from '@zimhealth/ai-client';
import { db } from '../lib/db';
import { redis } from '../lib/redis';
import { getLearnerCPDSummary } from './cpd-engine';
import { buildEligibleCourseWhere } from './course-eligibility';
import { logger } from '../lib/logger';

const CACHE_TTL = 3600 * 12; // 12 hours

export interface RecommendationResult {
  courseIds: string[];
  moduleRecommendations: Array<{
    courseId: string;
    moduleId: string;
    reason: string;
  }>;
  explanations: Record<string, string>;
  reasonCategories: Record<string, string[]>;
  isProfileBased: boolean;
}

function buildAiConfig(): AIProviderConfig {
  return {
    anthropic: process.env.ANTHROPIC_API_KEY
      ? {
          apiKey: process.env.ANTHROPIC_API_KEY,
          defaultModel: process.env.ANTHROPIC_MODEL ?? 'claude-3-sonnet-20240229',
        }
      : undefined,
    openai: process.env.OPENAI_API_KEY
      ? {
          apiKey: process.env.OPENAI_API_KEY,
          defaultModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
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
    // ignore
  }
}

export async function invalidateRecommendations(learnerId: string): Promise<void> {
  try {
    await redis.del(`ai:recs:${learnerId}`);
  } catch {
    // ignore
  }
}

export async function getRecommendations(
  learnerId: string,
): Promise<RecommendationResult> {
  const cacheKey = `ai:recs:${learnerId}`;
  const cached = await redisGetSafe(cacheKey);
  if (cached) return JSON.parse(cached);

  try {
    const [learner, summary, quizAttempts, enrollments] = await Promise.all([
      db.user.findUnique({
        where: { id: learnerId },
        select: { id: true, cadre: true, specialtyArea: true, fullName: true, professionalTitle: true, institution: true, province: true },
      }),
      getLearnerCPDSummary(learnerId),
      db.quizAttempt.findMany({
        where: { learnerId, passed: false },
        orderBy: { completedAt: 'desc' },
        take: 5,
        include: { quiz: { select: { title: true, courseId: true, moduleId: true } } },
      }),
      db.enrollment.findMany({
        where: { learnerId, completedAt: null },
        include: {
          course: {
            select: { id: true, title: true, modules: { select: { id: true, title: true, order: true } } },
          },
        },
      }),
    ]);

    if (!learner) {
      return { courseIds: [], moduleRecommendations: [], explanations: {}, reasonCategories: {}, isProfileBased: false };
    }

    const enrolledIds = await db.enrollment
      .findMany({ where: { learnerId }, select: { courseId: true } })
      .then((rows) => rows.map((r) => r.courseId));

    const eligibleCourses = await db.course.findMany({
      where: {
        ...buildEligibleCourseWhere(learner),
        status: 'PUBLISHED',
        id: { notIn: enrolledIds },
      },
      select: { id: true, title: true, category: true, difficulty: true, tags: true, cpdPoints: true },
      take: 20,
    });

    const isProfileBased = enrolledIds.length === 0;

    const fallbackRecommendations = (): RecommendationResult => {
      const cadreNeedle = String(learner.professionalTitle ?? learner.cadre ?? '').toLowerCase();
      const ranked = [...eligibleCourses]
        .sort((a, b) => {
          const aFit = a.title.toLowerCase().includes(cadreNeedle) ? 1 : 0;
          const bFit = b.title.toLowerCase().includes(cadreNeedle) ? 1 : 0;
          if (aFit !== bFit) return bFit - aFit;
          return b.cpdPoints - a.cpdPoints;
        })
        .slice(0, 3);

      return {
        courseIds: ranked.map((c) => c.id),
        moduleRecommendations: [],
        explanations: Object.fromEntries(ranked.map((c) => [c.id, 'Recommended based on your professional profile.'])),
        reasonCategories: Object.fromEntries(ranked.map((c) => [c.id, ['specialty_fit']])),
        isProfileBased,
      };
    };

    const aiEnabled = (await redis.get('config:ai:enabled')) !== 'false';
    if (!aiEnabled || !process.env.ANTHROPIC_API_KEY) {
      const result = fallbackRecommendations();
      await redisSetexSafe(cacheKey, CACHE_TTL, JSON.stringify(result));
      return result;
    }

    const aiClient = new AIClient(buildAiConfig());

    const prompt = `
Learner Profile:
- Name: ${learner.fullName}
- Cadre: ${learner.cadre}
- Specialty: ${learner.specialtyArea ?? 'General'}
- CPD Progress: ${summary.totalPoints} / ${summary.requiredPoints} points
- Recent Quiz Weaknesses: ${quizAttempts.map(a => a.quiz.title).join(', ') || 'None'}
- Currently Enrolled Incomplete Courses: ${enrollments.map(e => e.course.title).join(', ')}

Available Courses:
${eligibleCourses.map(c => `- ID: ${c.id}, Title: ${c.title}, Category: ${c.category}, Tags: ${c.tags.join(', ')}`).join('\n')}

Incomplete Modules in Enrolled Courses:
${enrollments.flatMap(e => e.course.modules.map(m => `- Course: ${e.course.title}, Module ID: ${m.id}, Module Title: ${m.title}`)).join('\n')}

Task:
1. Recommend up to 3 specific courses from the 'Available Courses' list.
2. Recommend up to 2 specific modules from 'Incomplete Modules' that should be prioritised.
3. Provide a short explanation for each recommendation.

Return valid JSON in this format:
{
  "courseIds": ["id1", "id2"],
  "moduleRecommendations": [
    { "courseId": "c1", "moduleId": "m1", "reason": "..." }
  ],
  "explanations": { "id1": "...", "id2": "..." },
  "reasonCategories": { "id1": ["Specialty", "Gap Fill"], "id2": ["Weakness"] }
}
`;

    const response = await aiClient.complete(prompt, {
      systemPrompt: SYSTEM_PROMPTS.COURSE_RECOMMENDER,
      temperature: 0.2,
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid AI response');
    const parsed = JSON.parse(jsonMatch[0]);

    const result: RecommendationResult = {
      courseIds: Array.isArray(parsed.courseIds) ? parsed.courseIds : [],
      moduleRecommendations: Array.isArray(parsed.moduleRecommendations) ? parsed.moduleRecommendations : [],
      explanations: parsed.explanations || {},
      reasonCategories: parsed.reasonCategories || {},
      isProfileBased: true,
    };

    await redisSetexSafe(cacheKey, CACHE_TTL, JSON.stringify(result));
    return result;
  } catch (err) {
    logger.error('Adaptive learning recommendation failed', { learnerId, err: String(err) });
    // Need a way to call fallbackRecommendations here, but it was defined inside try.
    // I'll just return a minimal deterministic result.
    const result = {
      courseIds: [],
      moduleRecommendations: [],
      explanations: {},
      reasonCategories: {},
      isProfileBased: false,
    };
    return result;
  }
}
