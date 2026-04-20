import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { db } from '../lib/db';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { UpdateProgressSchema } from './enrollments.schema';

const router: ExpressRouter = Router();

function mapEnrollmentRow(e: {
  id: string;
  progress: number;
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

// GET /api/enrollments — Learner's enrollments (filter by status)
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
        ? {
            ...base,
            OR: [{ progress: { gte: 1 } }, { completedAt: { not: null } }],
          }
        : {
            ...base,
            progress: { lt: 1 },
            completedAt: null,
          };

    const enrollments = await db.enrollment.findMany({
      where,
      take: limit,
      orderBy:
        status === 'COMPLETED'
          ? [{ completedAt: 'desc' }, { lastAccessAt: 'desc' }]
          : [{ lastAccessAt: 'desc' }, { enrolledAt: 'desc' }],
      include: {
        course: courseInclude,
      },
    });

    const payload = enrollments.map(mapEnrollmentRow);

    res.json(payload);
  } catch {
    res.status(500).json({ error: 'Could not fetch enrollments' });
  }
});

// PATCH /api/enrollments/:id/progress — Learner updates course progress (0..1)
router.patch('/:id/progress', requireAuth, requireRole('LEARNER'), async (req: AuthRequest, res) => {
  try {
    const data = UpdateProgressSchema.parse(req.body);

    const enrollment = await db.enrollment.findUnique({ where: { id: req.params.id } });
    if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });
    if (enrollment.learnerId !== req.user!.id) return res.status(403).json({ error: 'Not authorised' });

    const updated = await db.enrollment.update({
      where: { id: req.params.id },
      data: {
        progress: data.progress,
        lastAccessAt: new Date(),
        completedAt: data.progress >= 1 ? new Date() : null,
      },
    });

    res.json(updated);
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: 'Could not update progress' });
  }
});

export default router;

