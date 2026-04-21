import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { db } from '../lib/db';

const router: ExpressRouter = Router();

// ─── POST /api/telemetry/offline-download ─────────────────────────────────────
// Learner-side event to make offline usage measurable (Sprint 30 telemetry).
const OfflineDownloadSchema = z.object({
  courseId: z.string().min(1),
  moduleId: z.string().min(1),
});

router.post('/telemetry/offline-download', requireAuth, requireRole('LEARNER'), async (req: AuthRequest, res) => {
  try {
    const data = OfflineDownloadSchema.parse(req.body);
    await db.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'WEB_OFFLINE_MODULE_DOWNLOADED',
        entityType: 'Module',
        entityId: data.moduleId,
        meta: { courseId: data.courseId },
      },
    });
    return res.json({ ok: true });
  } catch (err: any) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'Could not record telemetry' });
  }
});

export default router;

