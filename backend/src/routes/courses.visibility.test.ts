import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { ContentType, CourseStatus, CPDCategory, Difficulty, Language, Role } from '@prisma/client';
import app from '../app';
import { db } from '../lib/db';
import { signAccessToken } from '../services/auth.service';

const TEST_SUFFIX = randomUUID().slice(0, 8);
const CREATOR_EMAIL = `s11-creator-${TEST_SUFFIX}@zimhealthcpd.co.zw`;

let creatorId = '';
let creatorToken = '';
let learnerToken = '';
let adminToken = '';
let underReviewCourseId = '';
let publishedCourseId = '';
let learnerCouncilId = '';

describe('Courses API visibility', () => {
  beforeAll(async () => {
    const creator = await db.user.create({
      data: {
        email: CREATOR_EMAIL,
        passwordHash: 'test-hash',
        fullName: 'Sprint Eleven Creator',
        role: Role.CONTENT_MANAGER,
        isApproved: true,
      },
      select: { id: true, email: true, role: true },
    });
    creatorId = creator.id;
    creatorToken = signAccessToken(creator);

    const learner = await db.user.findUniqueOrThrow({
      where: { email: 'grace@zimhealthcpd.co.zw' },
      select: { id: true, email: true, role: true, councilId: true },
    });
    learnerToken = signAccessToken(learner);
    learnerCouncilId = learner.councilId ?? '';

    const admin = await db.user.findUniqueOrThrow({
      where: { email: 'admin@zimhealthcpd.co.zw' },
      select: { id: true, email: true, role: true },
    });
    adminToken = signAccessToken(admin);

    const course = await db.course.create({
      data: {
        title: `S11 Under Review Course ${TEST_SUFFIX}`,
        subtitle: 'Visibility guard test',
        description: 'Ensures under-review course structure is hidden from learners.',
        category: CPDCategory.CLINICAL,
        difficulty: Difficulty.FOUNDATION,
        language: Language.ENGLISH,
        status: CourseStatus.UNDER_REVIEW,
        creatorId,
        estimatedMinutes: 20,
        cpdPoints: 0,
        accreditationBody: 'NCZ',
        targetCadres: ['NURSE'],
        targetCouncilIds: [],
        targetTitles: ['Registered General Nurse'],
        modules: {
          create: [
            {
              title: 'Module 1',
              order: 1,
              sections: {
                create: [
                  {
                    title: 'Hidden Section',
                    order: 1,
                    type: ContentType.READING,
                    content: '<p>Hidden content</p>',
                  },
                ],
              },
            },
          ],
        },
      },
      select: { id: true },
    });
    underReviewCourseId = course.id;

    const publishedCourse = await db.course.create({
      data: {
        title: `S11 Published Course ${TEST_SUFFIX}`,
        subtitle: 'Published learner visibility test',
        description: 'Ensures eligible learners can still fetch published course content.',
        category: CPDCategory.CLINICAL,
        difficulty: Difficulty.FOUNDATION,
        language: Language.ENGLISH,
        status: CourseStatus.PUBLISHED,
        creatorId,
        estimatedMinutes: 20,
        cpdPoints: 0,
        accreditationBody: 'NCZ',
        targetCadres: ['NURSE'],
        targetCouncilIds: learnerCouncilId ? [learnerCouncilId] : [],
        targetTitles: ['Registered General Nurse'],
        modules: {
          create: [
            {
              title: 'Visible Module',
              order: 1,
              sections: {
                create: [
                  {
                    title: 'Visible Section',
                    order: 1,
                    type: ContentType.READING,
                    content: '<p>Visible content</p>',
                  },
                ],
              },
            },
          ],
        },
        councilReviews: learnerCouncilId
          ? {
              create: {
                councilId: learnerCouncilId,
                status: 'APPROVED',
                points: 4,
              },
            }
          : undefined,
      },
      select: { id: true },
    });
    publishedCourseId = publishedCourse.id;
  });

  afterAll(async () => {
    await db.course.deleteMany({ where: { id: underReviewCourseId } });
    await db.course.deleteMany({ where: { id: publishedCourseId } });
    await db.user.deleteMany({ where: { id: creatorId } });
  });

  it('returns 404 to learners for under-review courses', async () => {
    const res = await request(app)
      .get(`/api/courses/${underReviewCourseId}`)
      .set('Authorization', `Bearer ${learnerToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Course not found');
  });

  it('still returns full course data to creators for under-review courses', async () => {
    const res = await request(app)
      .get(`/api/courses/${underReviewCourseId}`)
      .set('Authorization', `Bearer ${creatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(underReviewCourseId);
    expect(res.body.modules).toHaveLength(1);
    expect(res.body.modules[0].sections).toHaveLength(1);
  });

  it('still returns full course data to admins for under-review courses', async () => {
    const res = await request(app)
      .get(`/api/courses/${underReviewCourseId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(underReviewCourseId);
    expect(res.body.modules).toHaveLength(1);
  });

  it('still allows learners to fetch published courses assigned to them', async () => {
    const res = await request(app)
      .get(`/api/courses/${publishedCourseId}`)
      .set('Authorization', `Bearer ${learnerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(publishedCourseId);
    expect(res.body.modules.length).toBeGreaterThan(0);
  });
});
