import { describe, it, expect, beforeAll } from 'vitest';
import { creditPoints, getLearnerCPDSummary, hasEarnedPoints } from './cpd-engine';
import { db } from '../lib/db';

// Uses the seeded Grace learner
const GRACE_EMAIL = 'grace@nursepro.co.zw';
let graceId: string;

beforeAll(async () => {
  const grace = await db.user.findUnique({ where: { email: GRACE_EMAIL } });
  graceId = grace!.id;
});

describe('CPD Engine', () => {
  it('credits points for a WhatsApp quiz', async () => {
    const result = await creditPoints({
      learnerId: graceId,
      activityType: 'WHATSAPP_QUIZ',
    });
    expect(result.pointsEarned).toBeGreaterThan(0);
  });

  it('returns accurate CPD summary', async () => {
    const summary = await getLearnerCPDSummary(graceId, 2026);
    expect(summary.totalPoints).toBeGreaterThan(0);
    expect(summary.requiredPoints).toBe(12); // NURSE = 12
    expect(summary.percentComplete).toBeGreaterThanOrEqual(0);
  });

  it('prevents duplicate course point crediting', async () => {
    const COURSE_ID = 'course-seed-001';
    // Credit once
    await creditPoints({ learnerId: graceId, courseId: COURSE_ID, activityType: 'QUIZ_PASS' });
    // Attempt duplicate — should return 0 new points
    const result = await creditPoints({ learnerId: graceId, courseId: COURSE_ID, activityType: 'QUIZ_PASS' });
    expect(result.pointsEarned).toBe(0);
  });

  it('prevents duplicate quiz crediting when quizId is provided', async () => {
    const quiz = await db.quiz.findFirst({ select: { id: true, courseId: true } });
    expect(quiz?.id).toBeTruthy();
    // Credit once for this quiz
    const first = await creditPoints({
      learnerId: graceId,
      courseId: quiz!.courseId,
      quizId: quiz!.id,
      activityType: 'QUIZ_PASS',
    });
    expect(first.pointsEarned).toBeGreaterThanOrEqual(0);
    // Attempt duplicate — should return 0 new points
    const second = await creditPoints({
      learnerId: graceId,
      courseId: quiz!.courseId,
      quizId: quiz!.id,
      activityType: 'QUIZ_PASS',
    });
    expect(second.pointsEarned).toBe(0);
  });

  it('detects earned points correctly', async () => {
    const earned = await hasEarnedPoints(graceId, 'course-seed-001', 'QUIZ_PASS');
    expect(earned).toBe(true);
  });
});

