import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { CourseStatus, CPDCategory, Difficulty, Language, QuestionType, Role } from '@prisma/client';
import app from '../app';
import { db } from '../lib/db';
import { signAccessToken } from '../services/auth.service';

const TEST_SUFFIX = randomUUID().slice(0, 8);
const LEARNER_EMAIL = `s10-learner-${TEST_SUFFIX}@zimhealthcpd.co.zw`;
const LEARNER_REGISTRATION = `NCZ-S10-${TEST_SUFFIX.toUpperCase()}`;

let learnerId = '';
let learnerToken = '';
let courseId = '';
let quizId = ''; // attemptLimit: 2, passMark: 0.5, 2 questions

async function submitAttempt(answers: Record<string, string>, extra: Record<string, unknown> = {}) {
  return request(app)
    .post(`/api/quizzes/${quizId}/attempt`)
    .set('Authorization', `Bearer ${learnerToken}`)
    .send({ answers, ...extra });
}

describe('Quiz integrity (Sprint 10)', () => {
  beforeAll(async () => {
    const council = await db.council.findUnique({ where: { acronym: 'NCZ' }, select: { id: true } });
    if (!council) throw new Error('NCZ council seed missing');

    const learner = await db.user.create({
      data: {
        email: LEARNER_EMAIL,
        passwordHash: 'test-hash',
        fullName: 'Sprint Ten Learner',
        role: Role.LEARNER,
        councilId: council.id,
        professionalTitle: 'Registered General Nurse',
        registrationNumber: LEARNER_REGISTRATION,
        cadre: 'NURSE',
        nczRegistrationNumber: LEARNER_REGISTRATION,
        isApproved: true,
      },
      select: { id: true, email: true, role: true },
    });
    learnerId = learner.id;
    learnerToken = signAccessToken(learner);

    const creator = await db.user.findUniqueOrThrow({
      where: { email: 'creator@zimhealthcpd.co.zw' },
      select: { id: true },
    });

    const course = await db.course.create({
      data: {
        title: `S10 Quiz Integrity Course ${TEST_SUFFIX}`,
        subtitle: 'Quiz integrity test fixture',
        description: 'Course used to exercise attempt limits and timing flags.',
        category: CPDCategory.CLINICAL,
        difficulty: Difficulty.FOUNDATION,
        language: Language.ENGLISH,
        status: CourseStatus.PUBLISHED,
        creatorId: creator.id,
        estimatedMinutes: 10,
        cpdPoints: 3,
        accreditationBody: 'NCZ',
        targetCadres: ['NURSE'],
        targetCouncilIds: [council.id],
        targetTitles: ['Registered General Nurse'],
      },
      select: { id: true },
    });
    courseId = course.id;

    const quiz = await db.quiz.create({
      data: {
        courseId,
        title: 'Integrity Quiz',
        passMark: 0.5,
        attemptLimit: 2,
        randomiseQuestions: false,
        showAnswersAfter: true,
        questions: {
          create: [
            {
              type: QuestionType.MULTIPLE_CHOICE,
              text: 'Question 1',
              order: 1,
              options: {
                create: [
                  { text: 'Correct', isCorrect: true },
                  { text: 'Wrong', isCorrect: false },
                ],
              },
            },
            {
              type: QuestionType.MULTIPLE_CHOICE,
              text: 'Question 2',
              order: 2,
              options: {
                create: [
                  { text: 'Correct', isCorrect: true },
                  { text: 'Wrong', isCorrect: false },
                ],
              },
            },
          ],
        },
      },
      select: { id: true },
    });
    quizId = quiz.id;
  });

  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { userId: learnerId } });
    await db.cPDRecord.deleteMany({ where: { learnerId, courseId } });
    await db.quizAttempt.deleteMany({ where: { learnerId, quizId } });
    await db.quiz.deleteMany({ where: { id: quizId } });
    await db.course.deleteMany({ where: { id: courseId } });
    await db.user.deleteMany({ where: { id: learnerId } });
  });

  it('passes a correct attempt and credits points once', async () => {
    const quiz = await db.quiz.findUniqueOrThrow({
      where: { id: quizId },
      include: { questions: { include: { options: true }, orderBy: { order: 'asc' } } },
    });
    const correctAnswers: Record<string, string> = {};
    for (const q of quiz.questions) {
      correctAnswers[q.id] = q.options.find((o) => o.isCorrect)!.id;
    }

    const res = await submitAttempt(correctAnswers);
    expect(res.status).toBe(200);
    expect(res.body.passed).toBe(true);
    expect(res.body.pointsEarned).toBeGreaterThan(0);
    expect(res.body.attemptsRemaining).toBe(1);
  });

  it('does not double-credit points on a retake pass', async () => {
    const quiz = await db.quiz.findUniqueOrThrow({
      where: { id: quizId },
      include: { questions: { include: { options: true }, orderBy: { order: 'asc' } } },
    });
    const correctAnswers: Record<string, string> = {};
    for (const q of quiz.questions) {
      correctAnswers[q.id] = q.options.find((o) => o.isCorrect)!.id;
    }

    // This is the 2nd of 2 allowed attempts.
    const res = await submitAttempt(correctAnswers);
    expect(res.status).toBe(200);
    expect(res.body.passed).toBe(true);
    expect(res.body.pointsEarned).toBe(0); // already credited this cycle from attempt 1
    expect(res.body.attemptsRemaining).toBe(0);
  });

  it('rejects a submission beyond attemptLimit with a clear error', async () => {
    const res = await submitAttempt({}); // attempt 3, limit is 2
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/attempt limit/i);
  });

  it('flags an implausibly fast submission in AuditLog without blocking it', async () => {
    // Fresh quiz+learner so attemptLimit from the prior tests doesn't interfere.
    const quiz = await db.quiz.create({
      data: {
        courseId,
        title: 'Timing Flag Quiz',
        passMark: 0.5,
        attemptLimit: 3,
        questions: {
          create: [
            {
              type: QuestionType.MULTIPLE_CHOICE,
              text: 'Q1',
              order: 1,
              options: { create: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: false }] },
            },
            {
              type: QuestionType.MULTIPLE_CHOICE,
              text: 'Q2',
              order: 2,
              options: { create: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: false }] },
            },
            {
              type: QuestionType.MULTIPLE_CHOICE,
              text: 'Q3',
              order: 3,
              options: { create: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: false }] },
            },
          ],
        },
      },
      include: { questions: { include: { options: true }, orderBy: { order: 'asc' } } },
    });

    const answers: Record<string, string> = {};
    for (const q of quiz.questions) answers[q.id] = q.options.find((o) => o.isCorrect)!.id;

    const startedAt = new Date().toISOString(); // submitted "now" -> ~0 elapsed seconds for 3 questions
    const res = await request(app)
      .post(`/api/quizzes/${quiz.id}/attempt`)
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ answers, startedAt });

    expect(res.status).toBe(200); // flagged, not blocked
    expect(res.body.passed).toBe(true);

    const flagLog = await db.auditLog.findFirst({
      where: { userId: learnerId, action: 'QUIZ_SUBMISSION_FLAGGED_FAST', entityId: res.body.attemptId },
    });
    expect(flagLog).toBeTruthy();

    const attempt = await db.quizAttempt.findUniqueOrThrow({ where: { id: res.body.attemptId } });
    expect(attempt.flaggedFast).toBe(true);

    await db.auditLog.deleteMany({ where: { userId: learnerId, entityId: res.body.attemptId } });
    await db.cPDRecord.deleteMany({ where: { learnerId, quizId: quiz.id } });
    await db.quizAttempt.deleteMany({ where: { quizId: quiz.id } });
    await db.quiz.deleteMany({ where: { id: quiz.id } });
  });
});
