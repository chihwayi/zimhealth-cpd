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

  const filters: Prisma.CourseWhereInput[] = [
    { isPublicToAll: true },
    { targetCouncilIds: { isEmpty: true } },
    learner.councilId ? { targetCouncilIds: { has: learner.councilId } } : {},
  ];

  const titleFilters: Prisma.CourseWhereInput[] = [
    { isPublicToAll: true },
    { AND: [{ targetTitles: { isEmpty: true } }, { targetCadres: { isEmpty: true } }] },
    learner.professionalTitle ? { targetTitles: { has: learner.professionalTitle } } : {},
    learner.cadre ? { targetCadres: { has: learner.cadre } } : {},
  ];

  return {
    ...where,
    AND: [{ OR: filters }, { OR: titleFilters }],
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
