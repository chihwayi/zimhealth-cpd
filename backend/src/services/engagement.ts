import { db } from '../lib/db';
import { logger } from '../lib/logger';

// Personal-only engagement layer: streaks and achievements are computed from
// existing Enrollment/CPDRecord data and never affect CPD point crediting.
// No cross-learner leaderboard (Sprint 11 non-goal) — this stays 1:1 with a
// single learner.

function toUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.round((toUtcMidnight(b).getTime() - toUtcMidnight(a).getTime()) / MS_PER_DAY);
}

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date | null;
}

/**
 * Update a learner's completion streak for "today" (UTC calendar day).
 * - First-ever activity: streak starts at 1.
 * - Activity on consecutive days: streak increments.
 * - A day is skipped: streak resets to 1 (today's activity starts a new one).
 * - Already logged today: no-op, returns current state unchanged.
 */
export async function updateStreak(learnerId: string): Promise<StreakResult> {
  const today = toUtcMidnight(new Date());

  const existing = await db.learnerStreak.findUnique({ where: { learnerId } });

  if (!existing) {
    const created = await db.learnerStreak.create({
      data: { learnerId, currentStreak: 1, longestStreak: 1, lastActivityDate: today },
    });
    return created;
  }

  if (!existing.lastActivityDate) {
    const updated = await db.learnerStreak.update({
      where: { learnerId },
      data: { currentStreak: 1, longestStreak: Math.max(existing.longestStreak, 1), lastActivityDate: today },
    });
    return updated;
  }

  const diff = daysBetween(existing.lastActivityDate, today);

  if (diff === 0) {
    // Already logged today — no-op.
    return existing;
  }

  if (diff === 1) {
    const nextStreak = existing.currentStreak + 1;
    const updated = await db.learnerStreak.update({
      where: { learnerId },
      data: {
        currentStreak: nextStreak,
        longestStreak: Math.max(existing.longestStreak, nextStreak),
        lastActivityDate: today,
      },
    });
    return updated;
  }

  // A day (or more) was missed, or clock skew put lastActivityDate in the
  // future — either way, today's activity starts a fresh streak of 1.
  const updated = await db.learnerStreak.update({
    where: { learnerId },
    data: { currentStreak: 1, lastActivityDate: today },
  });
  return updated;
}

export async function getStreak(learnerId: string): Promise<StreakResult> {
  const existing = await db.learnerStreak.findUnique({ where: { learnerId } });
  return existing ?? { currentStreak: 0, longestStreak: 0, lastActivityDate: null };
}

// ─── Achievements ───────────────────────────────────────────────────────────

interface AchievementDef {
  code: string;
  title: string;
  description: string;
  isEarned: (ctx: AchievementContext) => Promise<boolean>;
}

interface AchievementContext {
  learnerId: string;
}

const ACHIEVEMENTS: AchievementDef[] = [
  {
    code: 'FIRST_COURSE_COMPLETE',
    title: 'First Steps',
    description: 'Completed your first CPD course.',
    isEarned: async ({ learnerId }) => {
      const count = await db.enrollment.count({ where: { learnerId, completedAt: { not: null } } });
      return count >= 1;
    },
  },
  {
    code: 'FIVE_COURSES_COMPLETE',
    title: 'Committed Learner',
    description: 'Completed 5 CPD courses.',
    isEarned: async ({ learnerId }) => {
      const count = await db.enrollment.count({ where: { learnerId, completedAt: { not: null } } });
      return count >= 5;
    },
  },
  {
    code: 'FIRST_QUIZ_PASS',
    title: 'Quiz Whiz',
    description: 'Passed your first quiz.',
    isEarned: async ({ learnerId }) => {
      const count = await db.cPDRecord.count({
        where: { learnerId, activityType: { in: ['QUIZ_PASS', 'WHATSAPP_QUIZ'] } },
      });
      return count >= 1;
    },
  },
  {
    code: 'STREAK_7_DAYS',
    title: 'Week-Long Streak',
    description: 'Kept a 7-day completion streak.',
    isEarned: async ({ learnerId }) => {
      const streak = await db.learnerStreak.findUnique({ where: { learnerId } });
      return (streak?.longestStreak ?? 0) >= 7;
    },
  },
  {
    code: 'STREAK_30_DAYS',
    title: 'Unstoppable',
    description: 'Kept a 30-day completion streak.',
    isEarned: async ({ learnerId }) => {
      const streak = await db.learnerStreak.findUnique({ where: { learnerId } });
      return (streak?.longestStreak ?? 0) >= 30;
    },
  },
  {
    code: 'SPECIALTY_FOCUS_5',
    title: 'Specialty Focus',
    description: 'Completed 5 courses in the same specialty track.',
    isEarned: async ({ learnerId }) => {
      const completed = await db.enrollment.findMany({
        where: { learnerId, completedAt: { not: null } },
        select: { course: { select: { specialtyTrack: true } } },
      });
      const counts = new Map<string, number>();
      for (const e of completed) {
        const track = e.course.specialtyTrack;
        if (!track) continue;
        counts.set(track, (counts.get(track) ?? 0) + 1);
      }
      return [...counts.values()].some((n) => n >= 5);
    },
  },
];

export async function ensureAchievementsSeeded(): Promise<void> {
  await Promise.all(
    ACHIEVEMENTS.map((a) =>
      db.achievement.upsert({
        where: { code: a.code },
        update: { title: a.title, description: a.description },
        create: { code: a.code, title: a.title, description: a.description },
      }),
    ),
  );
}

/**
 * Evaluate all achievement criteria for a learner and persist any newly
 * earned ones. Safe to call repeatedly — already-earned achievements are
 * skipped and the unique(learnerId, achievementId) constraint guards against
 * races.
 */
export async function checkAchievements(learnerId: string): Promise<string[]> {
  await ensureAchievementsSeeded();

  const alreadyEarned = await db.learnerAchievement.findMany({
    where: { learnerId },
    select: { achievement: { select: { code: true } } },
  });
  const earnedCodes = new Set(alreadyEarned.map((e) => e.achievement.code));

  const newlyEarned: string[] = [];

  for (const def of ACHIEVEMENTS) {
    if (earnedCodes.has(def.code)) continue;
    const earned = await def.isEarned({ learnerId });
    if (!earned) continue;

    const achievement = await db.achievement.findUniqueOrThrow({ where: { code: def.code } });
    try {
      await db.learnerAchievement.create({
        data: { learnerId, achievementId: achievement.id },
      });
      newlyEarned.push(def.code);
    } catch {
      // Unique constraint hit (concurrent request already awarded it) — fine, skip.
    }
  }

  return newlyEarned;
}

/**
 * Called from creditPoints() after a genuine (non-duplicate) CPD credit.
 * Failures here must never break point crediting.
 */
export async function recordEngagementActivity(learnerId: string): Promise<void> {
  try {
    await updateStreak(learnerId);
    await checkAchievements(learnerId);
  } catch (err) {
    logger.warn('Engagement update failed (streak/achievements)', { learnerId, err });
  }
}
