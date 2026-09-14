import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { Role } from '@prisma/client';
import { db } from '../lib/db';
import { updateStreak, getStreak, checkAchievements } from './engagement';
import { creditPoints } from './cpd-engine';

const TEST_SUFFIX = randomUUID().slice(0, 8);
const LEARNER_EMAIL = `s11-learner-${TEST_SUFFIX}@zimhealthcpd.co.zw`;

let learnerId = '';

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

describe('Engagement service (Sprint 11)', () => {
  beforeAll(async () => {
    const learner = await db.user.create({
      data: {
        email: LEARNER_EMAIL,
        passwordHash: 'test-hash',
        fullName: 'Sprint Eleven Learner',
        role: Role.LEARNER,
        isApproved: true,
      },
      select: { id: true },
    });
    learnerId = learner.id;
  });

  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { userId: learnerId } });
    await db.learnerAchievement.deleteMany({ where: { learnerId } });
    await db.learnerStreak.deleteMany({ where: { learnerId } });
    await db.cPDRecord.deleteMany({ where: { learnerId } });
    await db.user.deleteMany({ where: { id: learnerId } });
  });

  it('starts a streak at 1 on first activity', async () => {
    const result = await updateStreak(learnerId);
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(1);
  });

  it('is a no-op when called again the same day', async () => {
    const before = await getStreak(learnerId);
    const after = await updateStreak(learnerId);
    expect(after.currentStreak).toBe(before.currentStreak);
  });

  it('increments the streak for consecutive-day activity', async () => {
    // Simulate "yesterday" by backdating lastActivityDate directly.
    await db.learnerStreak.update({
      where: { learnerId },
      data: { lastActivityDate: daysAgo(1) },
    });
    const result = await updateStreak(learnerId);
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(2);
  });

  it('resets the streak to 1 after a missed day, keeping longestStreak', async () => {
    await db.learnerStreak.update({
      where: { learnerId },
      data: { lastActivityDate: daysAgo(3) },
    });
    const result = await updateStreak(learnerId);
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(2); // preserved from the earlier streak
  });

  it('earns FIRST_QUIZ_PASS after a genuine quiz-pass credit', async () => {
    const before = await db.learnerAchievement.count({ where: { learnerId } });
    expect(before).toBe(0);

    await creditPoints({ learnerId, activityType: 'WHATSAPP_QUIZ' });

    const codes = await checkAchievements(learnerId);
    // Already earned as a side effect of creditPoints() itself; a direct
    // call here should find nothing new left to earn for this criterion.
    expect(codes).not.toContain('FIRST_QUIZ_PASS');

    const earned = await db.learnerAchievement.findFirst({
      where: { learnerId, achievement: { code: 'FIRST_QUIZ_PASS' } },
    });
    expect(earned).toBeTruthy();
  });

  it('does not affect CPD point totals', async () => {
    const summary = await db.cPDRecord.aggregate({
      where: { learnerId },
      _sum: { pointsEarned: true },
    });
    // Only the single WHATSAPP_QUIZ credit above contributed points — streak/
    // achievement bookkeeping must never add its own point records.
    const recordCount = await db.cPDRecord.count({ where: { learnerId } });
    expect(recordCount).toBe(1);
    expect(summary._sum.pointsEarned).toBeGreaterThan(0);
  });
});
