import type { Prisma } from '@prisma/client';
import { db } from '../lib/db';

export type LearnerAudience = {
  councilId?: string | null;
  professionalTitle?: string | null;
  cadre?: string | null;
};

export function buildEligibleCourseWhere(learner?: LearnerAudience | null): Prisma.CourseWhereInput {
  const where: Prisma.CourseWhereInput = { status: 'PUBLISHED' };
  if (!learner) return where;

  // Council-aware publishing:
  // A learner should only see a course once THEIR council has approved it and assigned points.
  // (Legacy "public to all / empty audiences" is kept for admin-created generic content, but still
  // requires council approval for the learner's council when a councilId exists.)
  const councilApproval: Prisma.CourseWhereInput =
    learner.councilId
      ? {
          councilReviews: {
            some: {
              councilId: learner.councilId,
              status: 'APPROVED',
              points: { not: null },
            },
          },
        }
      : {};

  const filters: Prisma.CourseWhereInput[] = [
    // Courses explicitly targeted to the learner's council
    learner.councilId ? { targetCouncilIds: { has: learner.councilId } } : {},
    // Backwards compatibility: truly global courses (no audience filters) still require council approval
    {
      AND: [
        { OR: [{ isPublicToAll: true }, { targetCouncilIds: { isEmpty: true } }] },
        councilApproval,
      ],
    },
  ];

  const titleFilters: Prisma.CourseWhereInput[] = [
    // If a course has no title/cadre limits, it matches all titles.
    { AND: [{ targetTitles: { isEmpty: true } }, { targetCadres: { isEmpty: true } }] },
    learner.professionalTitle ? { targetTitles: { has: learner.professionalTitle } } : {},
    learner.cadre ? { targetCadres: { has: learner.cadre } } : {},
  ];

  return {
    ...where,
    AND: [councilApproval, { OR: filters }, { OR: titleFilters }],
  };
}

export async function assertLearnerCanAccessCourse(learnerId: string, courseId: string): Promise<boolean> {
  const learner = await db.user.findUnique({
    where: { id: learnerId },
    select: { councilId: true, professionalTitle: true, cadre: true },
  });
  if (!learner) return false;

  const course = await db.course.findFirst({
    where: {
      id: courseId,
      ...buildEligibleCourseWhere(learner),
    },
    select: { id: true },
  });

  return Boolean(course);
}
