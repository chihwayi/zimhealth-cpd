import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { db } from '../lib/db';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { UpdateProgressSchema } from './enrollments.schema';

const router: ExpressRouter = Router();

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

