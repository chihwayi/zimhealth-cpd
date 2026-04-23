import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { CourseStatus, Difficulty, CPDCategory, Language, ContentType, Role, Cadre } from '@prisma/client';
import app from '../app';
import { db } from '../lib/db';
import { signAccessToken } from '../services/auth.service';
import { getCurrentCycleYear } from '../services/cpd-rules';

const TEST_SUFFIX = randomUUID().slice(0, 8);
const TEST_EMAIL = `s07-${TEST_SUFFIX}@zimhealthcpd.co.zw`;
const TEST_REGISTRATION = `NCZ-S07-${TEST_SUFFIX.toUpperCase()}`;

let learnerId = '';
let accessToken = '';
let courseId = '';
let enrollmentId = '';
let firstSectionId = '';
let secondSectionId = '';
let foreignCourseId = '';
let foreignSectionId = '';

describe('Enrollments API', () => {
  beforeAll(async () => {
    const council = await db.council.findUnique({ where: { acronym: 'NCZ' }, select: { id: true } });
    if (!council) throw new Error('NCZ council seed missing');

    const learner = await db.user.create({
      data: {
        email: TEST_EMAIL,
        passwordHash: 'test-hash',
        fullName: 'Sprint Seven Learner',
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

    const course = await db.course.create({
      data: {
        title: `S07 Completion Course ${TEST_SUFFIX}`,
        subtitle: 'Route-driven CPD credit test',
        description: 'Ensures progress completion triggers CPD crediting exactly once.',
        category: CPDCategory.CLINICAL,
        difficulty: Difficulty.FOUNDATION,
        language: Language.ENGLISH,
        status: CourseStatus.PUBLISHED,
        creatorId: (await db.user.findUniqueOrThrow({
          where: { email: 'creator@zimhealthcpd.co.zw' },
          select: { id: true },
        })).id,
        estimatedMinutes: 20,
        cpdPoints: 4,
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
                    title: 'Section 1',
                    order: 1,
                    type: ContentType.READING,
                    content: '<p>Section 1</p>',
                  },
                  {
                    title: 'Section 2',
                    order: 2,
                    type: ContentType.READING,
                    content: '<p>Section 2</p>',
                  },
                ],
              },
            },
          ],
        },
        councilReviews: {
          create: {
            councilId: council.id,
            status: 'APPROVED',
            points: 5,
          },
        },
      },
      select: {
        id: true,
        modules: {
          select: {
            sections: {
              orderBy: { order: 'asc' },
              select: { id: true },
            },
          },
        },
      },
    });

    courseId = course.id;
    firstSectionId = course.modules[0]!.sections[0]!.id;
    secondSectionId = course.modules[0]!.sections[1]!.id;

    const enrollment = await db.enrollment.create({
      data: {
        learnerId,
        courseId,
      },
      select: { id: true },
    });
    enrollmentId = enrollment.id;

    const foreignCourse = await db.course.create({
      data: {
        title: `S10 Foreign Course ${TEST_SUFFIX}`,
        subtitle: 'Section ownership validation test',
        description: 'Provides a section that does not belong to the enrolled course.',
        category: CPDCategory.CLINICAL,
        difficulty: Difficulty.FOUNDATION,
        language: Language.ENGLISH,
        status: CourseStatus.PUBLISHED,
        creatorId: (await db.user.findUniqueOrThrow({
          where: { email: 'creator@zimhealthcpd.co.zw' },
          select: { id: true },
        })).id,
        estimatedMinutes: 10,
        cpdPoints: 2,
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
                    title: 'Foreign Section',
                    order: 1,
                    type: ContentType.READING,
                    content: '<p>Foreign section</p>',
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
    foreignCourseId = foreignCourse.id;
    foreignSectionId = foreignCourse.modules[0]!.sections[0]!.id;
  });

  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { userId: learnerId } });
    await db.cPDRecord.deleteMany({ where: { learnerId, courseId } });
    await db.enrollment.deleteMany({ where: { id: enrollmentId } });
    await db.course.deleteMany({ where: { id: courseId } });
    await db.course.deleteMany({ where: { id: foreignCourseId } });
    await db.user.deleteMany({ where: { id: learnerId } });
  });

  it('credits CPD points once when the learner completes the final section', async () => {
    const firstRes = await request(app)
      .patch(`/api/enrollments/${enrollmentId}/progress`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ sectionId: firstSectionId, totalSections: 1 });

    expect(firstRes.status).toBe(200);
    expect(firstRes.body.progress).toBe(0.5);
    expect(firstRes.body.completedAt).toBeNull();

    const completionRes = await request(app)
      .patch(`/api/enrollments/${enrollmentId}/progress`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ sectionId: secondSectionId, totalSections: 2 });

    expect(completionRes.status).toBe(200);
    expect(completionRes.body.progress).toBe(1);
    expect(completionRes.body.completedAt).toBeTruthy();

    const records = await db.cPDRecord.findMany({
      where: {
        learnerId,
        courseId,
        activityType: 'VIDEO_WATCH',
        cycleYear: getCurrentCycleYear(),
      },
      orderBy: { completedAt: 'asc' },
    });

    expect(records).toHaveLength(1);
    expect(records[0]!.pointsEarned).toBe(5);

    const summaryRes = await request(app)
      .get('/api/points/summary')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.totalPoints).toBe(5);

    const repeatRes = await request(app)
      .patch(`/api/enrollments/${enrollmentId}/progress`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ sectionId: secondSectionId, totalSections: 2 });

    expect(repeatRes.status).toBe(200);

    const recordCount = await db.cPDRecord.count({
      where: {
        learnerId,
        courseId,
        activityType: 'VIDEO_WATCH',
        cycleYear: getCurrentCycleYear(),
      },
    });
    expect(recordCount).toBe(1);
  });

  it('rejects section ids that do not belong to the enrolled course', async () => {
    const res = await request(app)
      .patch(`/api/enrollments/${enrollmentId}/progress`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ sectionId: foreignSectionId, totalSections: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Section does not belong to this course.');
  });
});
