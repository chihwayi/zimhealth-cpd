import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import app from '../app';
import { db } from '../lib/db';

const OFFICER_EMAIL = `test.council.courses.officer+${randomUUID()}@zimhealthcpd.co.zw`;
const OFFICER_PASSWORD = 'CouncilOfficer@12345';

describe('Council course review endpoints', () => {
  let officerToken = '';
  let councilId = '';
  let courseId = '';

  beforeAll(async () => {
    const council = await db.council.findUnique({ where: { acronym: 'NCZ' }, select: { id: true } });
    if (!council) throw new Error('NCZ council seed missing');
    councilId = council.id;

    const officer = await db.user.create({
      data: {
        email: OFFICER_EMAIL,
        passwordHash: await bcrypt.hash(OFFICER_PASSWORD, 12),
        fullName: 'Test Council Officer (Courses)',
        role: 'COUNCIL_OFFICER',
        councilId,
        professionalTitle: 'Council Officer',
        isApproved: true,
        isActive: true,
      },
      select: { id: true },
    });

    const loginRes = await request(app).post('/api/auth/login').send({ email: OFFICER_EMAIL, password: OFFICER_PASSWORD });
    expect(loginRes.status).toBe(200);
    officerToken = loginRes.body.accessToken;
    expect(officerToken).toBeTruthy();

    // Create a pending review row (course must exist).
    // Seed creates course-seed-001; use it so we don't depend on course creation.
    const course = await db.course.findUnique({ where: { id: 'course-seed-001' }, select: { id: true } });
    if (!course) throw new Error('Seed course missing');
    courseId = course.id;

    await db.councilCourseReview.upsert({
      where: { courseId_councilId: { courseId, councilId } },
      update: {
        status: 'PENDING_REVIEW',
        points: null,
        rejectionReason: null,
        reviewedAt: null,
        reviewedByUserId: null,
      },
      create: {
        courseId,
        councilId,
        status: 'PENDING_REVIEW',
      },
    });

    // Ensure target contains council (creator flow will do this; tests keep it explicit).
    await db.course.update({
      where: { id: courseId },
      data: { targetCouncilIds: { push: councilId } },
    }).catch(() => null);

    // Sanity: officer exists (avoid unused variable warnings in some TS configs)
    expect(officer.id).toBeTruthy();
  });

  afterAll(async () => {
    const officer = await db.user.findUnique({ where: { email: OFFICER_EMAIL }, select: { id: true } });
    if (officer) {
      await db.auditLog.deleteMany({ where: { userId: officer.id } });
    }
    await db.user.deleteMany({ where: { email: OFFICER_EMAIL } });
    // Leave seed data intact; it is recreated per test run anyway.
  });

  it('GET /api/ncz/courses/reviews?status=PENDING_REVIEW returns review rows', async () => {
    const res = await request(app)
      .get('/api/ncz/courses/reviews?status=PENDING_REVIEW&limit=50')
      .set('Authorization', `Bearer ${officerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.reviews)).toBe(true);
    const ids = res.body.reviews.map((r: any) => r.courseId);
    expect(ids).toContain(courseId);
  });

  it('POST /api/ncz/courses/:id/reviews/approve approves and assigns points', async () => {
    const res = await request(app)
      .post(`/api/ncz/courses/${courseId}/reviews/approve`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ points: 5 });
    expect(res.status).toBe(200);
    expect(res.body.review?.status).toBe('APPROVED');
    expect(res.body.review?.points).toBe(5);
  });

  it('PATCH /api/ncz/courses/:id/reviews/points updates points', async () => {
    const res = await request(app)
      .patch(`/api/ncz/courses/${courseId}/reviews/points`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ points: 7 });
    expect(res.status).toBe(200);
    expect(res.body.review?.points).toBe(7);
  });

  it('POST /api/ncz/courses/:id/reviews/reject rejects with reason', async () => {
    // Reset to pending first
    await db.councilCourseReview.update({
      where: { courseId_councilId: { courseId, councilId } },
      data: { status: 'PENDING_REVIEW', points: null, rejectionReason: null, reviewedAt: null, reviewedByUserId: null },
    });

    const res = await request(app)
      .post(`/api/ncz/courses/${courseId}/reviews/reject`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ reason: 'Not aligned with council guidelines.' });
    expect(res.status).toBe(200);
    expect(res.body.review?.status).toBe('REJECTED');
    expect(res.body.review?.rejectionReason).toBeTruthy();
  });
});

