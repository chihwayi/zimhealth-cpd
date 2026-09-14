import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { CPDCategory, Difficulty, Language, Role } from '@prisma/client';
import app from '../app';
import { db } from '../lib/db';
import { signAccessToken } from '../services/auth.service';

// Regression coverage for the RBAC audit finding: a PLATFORM_OWNER must never
// be able to publish a course without the target council's approval — that's
// the council's exclusive mandate. See docs/rbac-audit-report.md finding #1.

const TEST_SUFFIX = randomUUID().slice(0, 8);
const CREATOR_EMAIL = `s12-creator-${TEST_SUFFIX}@zimhealthcpd.co.zw`;
const COUNCIL_OFFICER_EMAIL = `s12-council-${TEST_SUFFIX}@zimhealthcpd.co.zw`;

let creatorId = '';
let councilOfficerId = '';
let ownerToken = '';
let councilOfficerToken = '';
let learnerCouncilId = '';
let noApprovalCourseId = '';
let approvableCourseId = '';

describe('Courses API — publish gating stays the council\'s mandate', () => {
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

    const owner = await db.user.findUniqueOrThrow({
      where: { email: 'admin@zimhealthcpd.co.zw' },
      select: { id: true, email: true, role: true },
    });
    ownerToken = signAccessToken(owner);

    const learner = await db.user.findUniqueOrThrow({
      where: { email: 'grace@zimhealthcpd.co.zw' },
      select: { councilId: true },
    });
    learnerCouncilId = learner.councilId ?? '';

    const councilOfficer = await db.user.create({
      data: {
        email: COUNCIL_OFFICER_EMAIL,
        passwordHash: 'test-hash',
        fullName: 'Sprint Twelve Council Officer',
        role: Role.COUNCIL_OFFICER,
        councilId: learnerCouncilId || undefined,
        isApproved: true,
      },
      select: { id: true, email: true, role: true },
    });
    councilOfficerId = councilOfficer.id;
    councilOfficerToken = signAccessToken(councilOfficer);

    const noApprovalCourse = await db.course.create({
      data: {
        title: `S12 No Approval Course ${TEST_SUFFIX}`,
        subtitle: 'Publish-bypass regression test',
        description: 'Platform Owner must not be able to publish this without council approval.',
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

    const approvableCourse = await db.course.create({
      data: {
        title: `S12 Council-Approvable Course ${TEST_SUFFIX}`,
        subtitle: 'Auto-publish-on-council-approval test',
        description: 'Should go PUBLISHED only once the council approves it.',
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
          ? { create: { councilId: learnerCouncilId, status: 'PENDING_REVIEW' } }
          : undefined,
      },
      select: { id: true },
    });
    approvableCourseId = approvableCourse.id;
  });

  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { entityId: { in: [noApprovalCourseId, approvableCourseId] } } });
    await db.course.deleteMany({ where: { id: { in: [noApprovalCourseId, approvableCourseId] } } });
    await db.user.deleteMany({ where: { id: { in: [creatorId, councilOfficerId] } } });
  });

  it('PLATFORM_OWNER cannot APPROVE (publish) a course directly — 403', async () => {
    const res = await request(app)
      .post(`/api/courses/${noApprovalCourseId}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ action: 'APPROVE' });

    expect(res.status).toBe(403);

    const course = await db.course.findUniqueOrThrow({ where: { id: noApprovalCourseId }, select: { status: true } });
    expect(course.status).not.toBe('PUBLISHED');
  });

  it('PLATFORM_OWNER can still REJECT (policy takedown) a submission', async () => {
    const res = await request(app)
      .post(`/api/courses/${noApprovalCourseId}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ action: 'REJECT', reason: 'Policy violation' });

    expect(res.status).toBe(200);
    expect(res.body.course.status).toBe('DRAFT');
  });

  it('council approval is the only path that publishes a course', async () => {
    if (!learnerCouncilId) return; // skip if seed data has no council-linked learner

    const before = await db.course.findUniqueOrThrow({ where: { id: approvableCourseId }, select: { status: true } });
    expect(before.status).not.toBe('PUBLISHED');

    const res = await request(app)
      .post(`/api/ncz/courses/${approvableCourseId}/reviews/approve`)
      .set('Authorization', `Bearer ${councilOfficerToken}`)
      .send({ points: 5 });

    expect(res.status).toBe(200);

    const after = await db.course.findUniqueOrThrow({ where: { id: approvableCourseId }, select: { status: true } });
    expect(after.status).toBe('PUBLISHED');
  });
});
