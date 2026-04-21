import type { ActivityType } from '@prisma/client';
import { db } from '../lib/db';
import { getRequiredPoints, getCurrentCycleYear } from './cpd-rules';
import { logger } from '../lib/logger';

export interface CreditPointsInput {
  learnerId: string;
  courseId?: string;
  /** When set (e.g. web quiz pass), duplicate detection is per quiz instead of whole course. */
  quizId?: string;
  activityType: ActivityType;
  quizScore?: number;
  pointsOverride?: number; // Admin manual override
  overrideNote?: string;
  isManualOverride?: boolean;
}

export interface CPDSummary {
  learnerId: string;
  cycleYear: number;
  totalPoints: number;
  requiredPoints: number;
  percentComplete: number;
  recordCount: number;
}

/**
 * Credit CPD points to a learner after activity completion.
 * This is the ONLY function that should write CPD records.
 * All calls are logged for audit purposes.
 */
export async function creditPoints(
  input: CreditPointsInput,
): Promise<{ recordId: string; pointsEarned: number }> {
  const {
    learnerId,
    courseId,
    quizId,
    activityType,
    quizScore,
    pointsOverride,
    overrideNote,
    isManualOverride,
  } = input;

  // Determine points to award
  let pointsEarned: number;
  if (typeof pointsOverride === 'number') {
    pointsEarned = pointsOverride;
  } else if (courseId) {
    const course = await db.course.findUnique({ where: { id: courseId }, select: { cpdPoints: true } });
    pointsEarned = course?.cpdPoints ?? 0;
  } else {
    pointsEarned = (await import('./cpd-rules.js')).ACTIVITY_POINTS[activityType] ?? 1;
  }

  const cycleYear = getCurrentCycleYear();

  // Duplicate prevention: quiz passes are deduped per quiz when quizId is set; otherwise same learner + course + activity + year.
  if (!isManualOverride) {
    if (activityType === 'QUIZ_PASS' && quizId) {
      const existing = await db.cPDRecord.findFirst({
        where: { learnerId, quizId, activityType, cycleYear },
      });
      if (existing) {
        logger.warn('Duplicate quiz CPD credit prevented', { learnerId, quizId, activityType });
        return { recordId: existing.id, pointsEarned: 0 };
      }
    } else if (courseId) {
      const existing = await db.cPDRecord.findFirst({
        where: { learnerId, courseId, activityType, cycleYear },
      });
      if (existing) {
        logger.warn('Duplicate CPD credit prevented', { learnerId, courseId, activityType });
        return { recordId: existing.id, pointsEarned: 0 };
      }
    }
  }

  const record = await db.cPDRecord.create({
    data: {
      learnerId,
      courseId,
      quizId,
      activityType,
      pointsEarned,
      quizScore,
      cycleYear,
      nczSyncStatus: 'PENDING',
      isManualOverride: isManualOverride ?? false,
      overrideNote,
    },
  });

  // Audit log
  await db.auditLog.create({
    data: {
      userId: learnerId,
      action: isManualOverride ? 'CPD_POINTS_MANUAL_OVERRIDE' : 'CPD_POINTS_CREDITED',
      entityType: 'CPDRecord',
      entityId: record.id,
      meta: { pointsEarned, activityType, courseId, quizId, quizScore, overrideNote },
    },
  });

  logger.info('CPD points credited', { learnerId, pointsEarned, activityType, cycleYear });
  return { recordId: record.id, pointsEarned };
}

/**
 * Get CPD summary for a learner in the current (or specified) cycle year.
 */
export async function getLearnerCPDSummary(learnerId: string, cycleYear?: number): Promise<CPDSummary> {
  const year = cycleYear ?? getCurrentCycleYear();

  const learner = await db.user.findUnique({
    where: { id: learnerId },
    select: { cadre: true },
  });

  const records = await db.cPDRecord.findMany({
    where: { learnerId, cycleYear: year },
  });

  const totalPoints = records.reduce((sum, r) => sum + r.pointsEarned, 0);
  const requiredPoints = getRequiredPoints(learner?.cadre);
  const percentComplete = Math.min(100, Math.round((totalPoints / requiredPoints) * 100));

  return {
    learnerId,
    cycleYear: year,
    totalPoints,
    requiredPoints,
    percentComplete,
    recordCount: records.length,
  };
}

/**
 * Check if a learner has already earned points for a specific course/activity
 */
export async function hasEarnedPoints(
  learnerId: string,
  courseId: string,
  activityType: ActivityType,
): Promise<boolean> {
  const record = await db.cPDRecord.findFirst({
    where: { learnerId, courseId, activityType, cycleYear: getCurrentCycleYear() },
  });
  return !!record;
}

