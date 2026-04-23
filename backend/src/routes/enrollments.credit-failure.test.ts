import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'crypto';
import request from 'supertest';
import type express from 'express';
import { Cadre, ContentType, CourseStatus, CPDCategory, Difficulty, Language, Role } from '@prisma/client';
import { db } from '../lib/db';
import { signAccessToken } from '../services/auth.service';

vi.mock('../services/cpd-engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/cpd-engine')>();
  return {
    ...actual,
    creditPoints: vi.fn().mockRejectedValue(new Error('Synthetic S07 credit failure')),
  };
});

const TEST_SUFFIX = randomUUID().slice(0, 8);
const TEST_EMAIL = `s07-fail-${TEST_SUFFIX}@zimhealthcpd.co.zw`;
const TEST_REGISTRATION = `NCZ-S07-FAIL-${TEST_SUFFIX.toUpperCase()}`;

let app: express.Express;
let learnerId = '';
let accessToken = '';
let courseId = '';
let enrollmentId = '';
let sectionId = '';

describe('Enrollments API credit failure handling', () => {
  beforeAll(async () => {
    app = (await import('../app.js')).default as unknown as express.Express;

    const council = await db.council.findUnique({ where: { acronym: 'NCZ' }, select: { id: true } });
    if (!council) throw new Error('NCZ council seed missing');

    const learner = await db.user.create({
      data: {
        email: TEST_EMAIL,
        passwordHash: 'test-hash',
        fullName: 'Sprint Seven Failure Learner',
        role: Role.LEARNER,
        councilId: council.id,
        professionalTitle: 'Registered General Nurse',
        registrationNumber: TEST_REGISTRATION,
        cadre: Cadre.NURSE,
        nczRegistrationNumber: TEST_REGISTRATION,
        isApproved: true,
      },
      select: { id: true, email: true, role: true },
    });
    learnerId = learner.id;
    accessToken = signAccessToken(learner);

    const creator = await db.user.findUniqueOrThrow({
      where: { email: 'creator@zimhealthcpd.co.zw' },
      select: { id: true },
    });

    const course = await db.course.create({
      data: {
        title: `S07 Failure Course ${TEST_SUFFIX}`,
        subtitle: 'Credit failure should not block progress',
        description: 'Ensures the enrollment completion response stays successful when CPD crediting fails.',
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
        modules: {
          create: [
            {
              title: 'Module 1',
              order: 1,
              sections: {
                create: [
                  {
                    title: 'Only Section',
                    order: 1,
                    type: ContentType.READING,
                    content: '<p>Only section</p>',
                  },
                ],
              },
            },
          ],
        },
      },
      select: {
        id: true,
        modules: {
          select: {
            sections: {
              select: { id: true },
              take: 1,
            },
          },
          take: 1,
        },
      },
    });

    courseId = course.id;
    sectionId = course.modules[0]!.sections[0]!.id;

    const enrollment = await db.enrollment.create({
      data: { learnerId, courseId },
      select: { id: true },
    });
    enrollmentId = enrollment.id;
  });

  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { userId: learnerId } });
    await db.cPDRecord.deleteMany({ where: { learnerId, courseId } });
    await db.enrollment.deleteMany({ where: { id: enrollmentId } });
    await db.course.deleteMany({ where: { id: courseId } });
    await db.user.deleteMany({ where: { id: learnerId } });
  });

  it('still returns 200 and marks the enrollment complete when CPD crediting throws', async () => {
    const res = await request(app)
      .patch(`/api/enrollments/${enrollmentId}/progress`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ sectionId, totalSections: 1 });

    expect(res.status).toBe(200);
    expect(res.body.progress).toBe(1);
    expect(res.body.completedAt).toBeTruthy();

    const enrollment = await db.enrollment.findUniqueOrThrow({
      where: { id: enrollmentId },
      select: { completedAt: true, progress: true },
    });

    expect(enrollment.progress).toBe(1);
    expect(enrollment.completedAt).toBeTruthy();

    const recordCount = await db.cPDRecord.count({
      where: { learnerId, courseId, activityType: 'VIDEO_WATCH' },
    });
    expect(recordCount).toBe(0);
  });
});
