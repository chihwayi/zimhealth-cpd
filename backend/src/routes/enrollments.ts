import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { db } from '../lib/db';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { UpdateProgressSchema, SubmitReviewSchema } from './enrollments.schema';
import { invalidateRecommendations } from '../services/adaptive-learning';

const router: ExpressRouter = Router();

function mapEnrollmentRow(e: {
  id: string;
  progress: number;
  completedSections: string[];
  enrolledAt: Date;
  completedAt: Date | null;
  course: {
    id: string;
    title: string;
    category: string;
    difficulty: string;
    thumbnailUrl: string | null;
    estimatedMinutes: number;
    cpdPoints: number;
  };
}) {
  const completed = e.progress >= 1 || e.completedAt != null;
  return {
    id: e.id,
    status: completed ? ('COMPLETED' as const) : ('IN_PROGRESS' as const),
    progressPercent: Math.round(Math.min(1, Math.max(0, e.progress)) * 100),
    completedSections: e.completedSections,
    enrolledAt: e.enrolledAt.toISOString(),
    completedAt: e.completedAt?.toISOString() ?? null,
    course: e.course,
  };
}

const courseInclude = {
  select: {
    id: true,
    title: true,
    category: true,
    difficulty: true,
    thumbnailUrl: true,
    estimatedMinutes: true,
    cpdPoints: true,
  },
} as const;

// GET /api/enrollments — Learner's enrollments (filter by status or courseId)
router.get('/', requireAuth, requireRole('LEARNER'), async (req: AuthRequest, res) => {
  try {
    const courseId = typeof req.query.courseId === 'string' ? req.query.courseId.trim() : '';
    if (courseId) {
      const e = await db.enrollment.findUnique({
        where: { learnerId_courseId: { learnerId: req.user!.id, courseId } },
        include: { course: courseInclude },
      });
      if (!e) return res.json([]);
      return res.json([mapEnrollmentRow(e)]);
    }

    const status = (req.query.status as string) || 'IN_PROGRESS';
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10) || 20, 1), 100);

    const base = { learnerId: req.user!.id };

    const where =
      status === 'COMPLETED'
        ? { ...base, OR: [{ progress: { gte: 1 } }, { completedAt: { not: null } }] }
        : { ...base, progress: { lt: 1 }, completedAt: null };

    const enrollments = await db.enrollment.findMany({
      where,
      take: limit,
      orderBy:
        status === 'COMPLETED'
          ? [{ completedAt: 'desc' }, { lastAccessAt: 'desc' }]
          : [{ lastAccessAt: 'desc' }, { enrolledAt: 'desc' }],
      include: { course: courseInclude },
    });

    res.json(enrollments.map(mapEnrollmentRow));
  } catch {
    res.status(500).json({ error: 'Could not fetch enrollments' });
  }
});

// PATCH /api/enrollments/:id/progress — mark a section complete or set raw progress
router.patch('/:id/progress', requireAuth, requireRole('LEARNER'), async (req: AuthRequest, res) => {
  try {
    const data = UpdateProgressSchema.parse(req.body);

    const enrollment = await db.enrollment.findUnique({ where: { id: req.params.id } });
    if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });
    if (enrollment.learnerId !== req.user!.id) return res.status(403).json({ error: 'Not authorised' });

    let newProgress = data.progress ?? enrollment.progress;
    let newCompletedSections = enrollment.completedSections;

    // Section-level progress: add the sectionId and recalculate
    if (data.sectionId) {
      if (!newCompletedSections.includes(data.sectionId)) {
        newCompletedSections = [...newCompletedSections, data.sectionId];
      }
      if (data.totalSections && data.totalSections > 0) {
        newProgress = newCompletedSections.length / data.totalSections;
      }
    }

    const isComplete = newProgress >= 1;
    const justCompleted = isComplete && !enrollment.completedAt;

    const updated = await db.enrollment.update({
      where: { id: req.params.id },
      data: {
        progress: Math.min(1, newProgress),
        completedSections: newCompletedSections,
        lastAccessAt: new Date(),
        completedAt: justCompleted ? new Date() : enrollment.completedAt,
      },
    });

    // Bust recommendation cache so the learner sees fresh suggestions after completing a course
    if (justCompleted) {
      void invalidateRecommendations(req.user!.id);
    }

    res.json({
      id: updated.id,
      progress: updated.progress,
      completedSections: updated.completedSections,
      completedAt: updated.completedAt?.toISOString() ?? null,
      progressPercent: Math.round(Math.min(1, updated.progress) * 100),
    });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: 'Could not update progress' });
  }
});

// POST /api/enrollments/:enrollmentId/review — learner submits a course review
router.post('/:enrollmentId/review', requireAuth, requireRole('LEARNER'), async (req: AuthRequest, res) => {
  try {
    const data = SubmitReviewSchema.parse(req.body);

    const enrollment = await db.enrollment.findUnique({ where: { id: req.params.enrollmentId } });
    if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });
    if (enrollment.learnerId !== req.user!.id) return res.status(403).json({ error: 'Not authorised' });

    const review = await db.courseReview.upsert({
      where: { courseId_learnerId: { courseId: enrollment.courseId, learnerId: req.user!.id } },
      create: { courseId: enrollment.courseId, learnerId: req.user!.id, rating: data.rating, comment: data.comment },
      update: { rating: data.rating, comment: data.comment },
    });

    res.json(review);
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: 'Could not submit review' });
  }
});

export default router;
