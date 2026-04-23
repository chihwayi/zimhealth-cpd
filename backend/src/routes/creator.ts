import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { db } from '../lib/db';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';

const router: ExpressRouter = Router();

function getMonthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(date: Date) {
  return date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
}

// GET /api/creator/courses — creator's own courses
router.get('/courses', requireAuth, requireRole('CONTENT_MANAGER', 'ADMIN'), async (req: AuthRequest, res) => {
  try {
    const courses = await db.course.findMany({
      where: req.user!.role === 'ADMIN' ? {} : { creatorId: req.user!.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { enrollments: true } },
        councilReviews: {
          orderBy: [{ updatedAt: 'desc' }],
          select: {
            id: true,
            status: true,
            points: true,
            rejectionReason: true,
            reviewedAt: true,
            updatedAt: true,
            council: { select: { id: true, name: true, acronym: true } },
          },
        },
      },
    });
    res.json({ courses });
  } catch {
    res.status(500).json({ error: 'Could not fetch courses' });
  }
});

// GET /api/creator/analytics/summary — overall stats for creator
router.get('/analytics/summary', requireAuth, requireRole('CONTENT_MANAGER', 'ADMIN'), async (req: AuthRequest, res) => {
  try {
    const creatorId = req.user!.id;
    const isAdmin = req.user!.role === 'ADMIN';
    const where = isAdmin ? {} : { creatorId };

    const courses = await db.course.findMany({ where, select: { id: true } });
    const courseIds = courses.map(c => c.id);

    const [totalEnrollments, totalCompletions, avgRating] = await Promise.all([
      db.enrollment.count({ where: { courseId: { in: courseIds } } }),
      db.enrollment.count({ where: { courseId: { in: courseIds }, completedAt: { not: null } } }),
      db.courseReview.aggregate({
        where: { courseId: { in: courseIds } },
        _avg: { rating: true },
      }),
    ]);

    res.json({
      totalCourses: courses.length,
      totalEnrollments,
      completionRate: totalEnrollments ? totalCompletions / totalEnrollments : 0,
      avgRating: avgRating._avg.rating || 0,
    });
  } catch {
    res.status(500).json({ error: 'Could not fetch summary' });
  }
});

// GET /api/creator/analytics/courses — per-course metrics
router.get('/analytics/courses', requireAuth, requireRole('CONTENT_MANAGER', 'ADMIN'), async (req: AuthRequest, res) => {
  try {
    const creatorId = req.user!.id;
    const isAdmin = req.user!.role === 'ADMIN';
    const courseWhere = isAdmin ? {} : { creatorId };

    const courses = await db.course.findMany({
      where: courseWhere,
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { enrollments: true } },
        reviews: { select: { rating: true } },
      },
    });

    const courseIds = courses.map((course) => course.id);
    const [completions, quizAttempts] = await Promise.all([
      db.enrollment.groupBy({
        by: ['courseId'],
        where: { courseId: { in: courseIds }, completedAt: { not: null } },
        _count: { _all: true },
      }),
      db.quizAttempt.findMany({
        where: { quiz: { courseId: { in: courseIds } } },
        select: { score: true, passed: true, quiz: { select: { courseId: true } } },
      }),
    ]);

    const completionMap = new Map(completions.map((row) => [row.courseId, row._count._all]));
    const quizMap = new Map<string, { totalScore: number; count: number; passed: number }>();
    for (const attempt of quizAttempts) {
      const courseId = attempt.quiz.courseId;
      const existing = quizMap.get(courseId) ?? { totalScore: 0, count: 0, passed: 0 };
      existing.totalScore += attempt.score;
      existing.count += 1;
      existing.passed += attempt.passed ? 1 : 0;
      quizMap.set(courseId, existing);
    }

    const analytics = courses.map((course) => {
      const enrollmentCount = course._count.enrollments;
      const completedCount = completionMap.get(course.id) ?? 0;
      const quizStats = quizMap.get(course.id) ?? { totalScore: 0, count: 0, passed: 0 };
      const averageRating = course.reviews.length
        ? course.reviews.reduce((sum, review) => sum + review.rating, 0) / course.reviews.length
        : 0;

      return {
        id: course.id,
        title: course.title,
        category: course.category,
        status: course.status,
        enrollmentCount,
        completionRate: enrollmentCount ? completedCount / enrollmentCount : 0,
        avgQuizScore: quizStats.count ? quizStats.totalScore / quizStats.count : 0,
        passRate: quizStats.count ? quizStats.passed / quizStats.count : 0,
        avgRating: averageRating,
      };
    });

    res.json({ courses: analytics });
  } catch {
    res.status(500).json({ error: 'Could not fetch course analytics' });
  }
});

// GET /api/creator/courses/:id/analytics
router.get('/courses/:id/analytics', requireAuth, requireRole('CONTENT_MANAGER', 'ADMIN'), async (req: AuthRequest, res) => {
  try {
    const course = await db.course.findUnique({ where: { id: req.params.id } });
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (req.user!.role !== 'ADMIN' && course.creatorId !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorised' });
    }

    const [enrollmentCount, completedCount, quizAttempts] = await Promise.all([
      db.enrollment.count({ where: { courseId: req.params.id } }),
      db.enrollment.count({ where: { courseId: req.params.id, completedAt: { not: null } } }),
      db.quizAttempt.findMany({
        where: { quiz: { courseId: req.params.id } },
        select: { score: true, passed: true },
      }),
    ]);

    const avgScore = quizAttempts.length
      ? quizAttempts.reduce((sum, a) => sum + a.score, 0) / quizAttempts.length
      : 0;
    const passRate = quizAttempts.length
      ? quizAttempts.filter((a) => a.passed).length / quizAttempts.length
      : 0;

    res.json({
      enrollmentCount,
      completionRate: enrollmentCount ? completedCount / enrollmentCount : 0,
      avgQuizScore: Math.round(avgScore * 100) / 100,
      passRate: Math.round(passRate * 100),
    });
  } catch {
    res.status(500).json({ error: 'Could not fetch analytics' });
  }
});

// GET /api/creator/analytics/timeseries
router.get('/analytics/timeseries', requireAuth, requireRole('CONTENT_MANAGER', 'ADMIN'), async (req: AuthRequest, res) => {
  try {
    const creatorId = req.user!.id;
    const isAdmin = req.user!.role === 'ADMIN';
    const monthStarts = Array.from({ length: 6 }, (_, index) => {
      const date = new Date();
      date.setUTCDate(1);
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCMonth(date.getUTCMonth() - (5 - index));
      return date;
    });
    const startDate = monthStarts[0];

    const enrollmentWhere = isAdmin
      ? { enrolledAt: { gte: startDate } }
      : { enrolledAt: { gte: startDate }, course: { creatorId } };
    const completionWhere = isAdmin
      ? { completedAt: { not: null, gte: startDate } }
      : { completedAt: { not: null, gte: startDate }, course: { creatorId } };

    const [enrollments, completions] = await Promise.all([
      db.enrollment.findMany({
        where: enrollmentWhere,
        select: { enrolledAt: true },
      }),
      db.enrollment.findMany({
        where: completionWhere,
        select: { completedAt: true },
      }),
    ]);

    const enrollmentsByMonth = new Map<string, number>();
    for (const enrollment of enrollments) {
      const key = getMonthKey(enrollment.enrolledAt);
      enrollmentsByMonth.set(key, (enrollmentsByMonth.get(key) ?? 0) + 1);
    }

    const completionsByMonth = new Map<string, number>();
    for (const enrollment of completions) {
      if (!enrollment.completedAt) continue;
      const key = getMonthKey(enrollment.completedAt);
      completionsByMonth.set(key, (completionsByMonth.get(key) ?? 0) + 1);
    }

    const data = monthStarts.map((monthStart) => {
      const key = getMonthKey(monthStart);
      return {
        name: getMonthLabel(monthStart),
        enrollments: enrollmentsByMonth.get(key) ?? 0,
        completions: completionsByMonth.get(key) ?? 0,
      };
    });

    res.json(data);
  } catch {
    res.status(500).json({ error: 'Could not fetch timeseries' });
  }
});

export default router;
