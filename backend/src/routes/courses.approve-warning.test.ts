import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { CPDCategory, Difficulty, Language, Role } from '@prisma/client';
import app from '../app';
import { db } from '../lib/db';
import { signAccessToken } from '../services/auth.service';

const TEST_SUFFIX = randomUUID().slice(0, 8);
const CREATOR_EMAIL = `s12-creator-${TEST_SUFFIX}@zimhealthcpd.co.zw`;

let creatorId = '';
let adminToken = '';
let learnerCouncilId = '';
let noApprovalCourseId = '';
let approvedCourseId = '';

describe('Courses API approve warnings', () => {
  beforeAll(async () => {
    const creator = await db.user.create({
      data: {
        email: CREATOR_EMAIL,
        passwordHash: 'test-hash',
        fullName: 'Sprint Twelve Creator',
        role: Role.CONTENT_MANAGER,
        isApproved: true,
      },
      select: { id: true },
    });
    creatorId = creator.id;

    const admin = await db.user.findUniqueOrThrow({
      where: { email: 'admin@zimhealthcpd.co.zw' },
      select: { id: true, email: true, role: true },
    });
    adminToken = signAccessToken(admin);

    const learner = await db.user.findUniqueOrThrow({
      where: { email: 'grace@zimhealthcpd.co.zw' },
      select: { councilId: true },
    });
    learnerCouncilId = learner.councilId ?? '';

    const noApprovalCourse = await db.course.create({
      data: {
        title: `S12 No Approval Course ${TEST_SUFFIX}`,
        subtitle: 'Publish warning test',
        description: 'Publishing this course should warn because no council has approved it.',
        category: CPDCategory.CLINICAL,
        difficulty: Difficulty.FOUNDATION,
        language: Language.ENGLISH,
        status: 'UNDER_REVIEW',
        creatorId,
        estimatedMinutes: 10,
        cpdPoints: 0,
        accreditationBody: 'NCZ',
        targetCadres: ['NURSE'],
        targetCouncilIds: learnerCouncilId ? [learnerCouncilId] : [],
        targetTitles: ['Registered General Nurse'],
      },
      select: { id: true },
    });
    noApprovalCourseId = noApprovalCourse.id;

    const approvedCourse = await db.course.create({
      data: {
        title: `S12 Approved Course ${TEST_SUFFIX}`,
        subtitle: 'Publish success test',
        description: 'Publishing this course should not warn because a council already approved it.',
        category: CPDCategory.CLINICAL,
        difficulty: Difficulty.FOUNDATION,
        language: Language.ENGLISH,
        status: 'UNDER_REVIEW',
        creatorId,
        estimatedMinutes: 10,
        cpdPoints: 0,
        accreditationBody: 'NCZ',
        targetCadres: ['NURSE'],
        targetCouncilIds: learnerCouncilId ? [learnerCouncilId] : [],
        targetTitles: ['Registered General Nurse'],
        councilReviews: learnerCouncilId
          ? {
              create: {
                councilId: learnerCouncilId,
                status: 'APPROVED',
                points: 3,
              },
            }
          : undefined,
      },
      select: { id: true },
    });
    approvedCourseId = approvedCourse.id;
  });

  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { entityId: { in: [noApprovalCourseId, approvedCourseId] } } });
    await db.course.deleteMany({ where: { id: { in: [noApprovalCourseId, approvedCourseId] } } });
    await db.user.deleteMany({ where: { id: creatorId } });
  });

  it('returns a warning when publishing without any approved council reviews', async () => {
    const res = await request(app)
      .post(`/api/courses/${noApprovalCourseId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'APPROVE' });

    expect(res.status).toBe(200);
    expect(res.body.course.status).toBe('PUBLISHED');
    expect(res.body.warning).toContain('no council has approved it yet');
  });

  it('omits the warning when at least one council approval with points exists', async () => {
    const res = await request(app)
      .post(`/api/courses/${approvedCourseId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'APPROVE' });

    expect(res.status).toBe(200);
    expect(res.body.course.status).toBe('PUBLISHED');
    expect(res.body.warning).toBeUndefined();
  });
});
