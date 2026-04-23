import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { CourseStatus, CPDCategory, Difficulty, Language, Role } from '@prisma/client';
import app from '../app';
import { db } from '../lib/db';
import { signAccessToken } from '../services/auth.service';

const TEST_SUFFIX = randomUUID().slice(0, 8);
const TEST_EMAIL = `s09-creator-${TEST_SUFFIX}@zimhealthcpd.co.zw`;

let creatorId = '';
let accessToken = '';
let courseId = '';
let councilId = '';

describe('Courses API resubmit-council', () => {
  beforeAll(async () => {
    const council = await db.council.findUnique({ where: { acronym: 'NCZ' }, select: { id: true } });
    if (!council) throw new Error('NCZ council seed missing');
    councilId = council.id;

    const creator = await db.user.create({
      data: {
        email: TEST_EMAIL,
        passwordHash: 'test-hash',
        fullName: 'Sprint Nine Creator',
        role: Role.CONTENT_MANAGER,
        isApproved: true,
      },
      select: { id: true, email: true, role: true },
    });
    creatorId = creator.id;
    accessToken = signAccessToken(creator);

    const course = await db.course.create({
      data: {
        title: `S09 Resubmit Course ${TEST_SUFFIX}`,
        subtitle: 'Resubmit status regression test',
        description: 'Ensures resubmitting to council resets the course status and review rows.',
        category: CPDCategory.CLINICAL,
        difficulty: Difficulty.FOUNDATION,
        language: Language.ENGLISH,
        status: CourseStatus.PUBLISHED,
        creatorId,
        estimatedMinutes: 15,
        cpdPoints: 0,
        accreditationBody: 'NCZ',
        targetCadres: ['NURSE'],
        targetCouncilIds: [councilId],
        targetTitles: ['Registered General Nurse'],
      },
      select: { id: true },
    });
    courseId = course.id;

    await db.councilCourseReview.create({
      data: {
        courseId,
        councilId,
        status: 'APPROVED',
        points: 6,
      },
    });
  });

  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { userId: creatorId, entityId: courseId } });
    await db.councilCourseReview.deleteMany({ where: { courseId } });
    await db.course.deleteMany({ where: { id: courseId } });
    await db.user.deleteMany({ where: { id: creatorId } });
  });

  it('resets the course to UNDER_REVIEW and records the status transition in the audit log', async () => {
    const res = await request(app)
      .post(`/api/courses/${courseId}/resubmit-council`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.councilTargets).toBe(1);

    const course = await db.course.findUniqueOrThrow({
      where: { id: courseId },
      select: { status: true },
    });
    expect(course.status).toBe('UNDER_REVIEW');

    const review = await db.councilCourseReview.findUniqueOrThrow({
      where: { courseId_councilId: { courseId, councilId } },
      select: {
        status: true,
        points: true,
        rejectionReason: true,
        reviewedAt: true,
        reviewedByUserId: true,
      },
    });
    expect(review.status).toBe('PENDING_REVIEW');
    expect(review.points).toBeNull();
    expect(review.rejectionReason).toBeNull();
    expect(review.reviewedAt).toBeNull();
    expect(review.reviewedByUserId).toBeNull();

    const auditLog = await db.auditLog.findFirstOrThrow({
      where: {
        userId: creatorId,
        entityId: courseId,
        action: 'CREATOR_RESUBMITTED_TO_COUNCIL',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(auditLog.meta).toMatchObject({
      targetCouncilIds: [councilId],
      previousStatus: 'PUBLISHED',
      newStatus: 'UNDER_REVIEW',
    });
  });
});
