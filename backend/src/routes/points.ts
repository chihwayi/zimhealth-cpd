import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { db } from '../lib/db';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { getLearnerCPDSummary, creditPoints } from '../services/cpd-engine';
import { z } from 'zod';
import type { AuthRequest } from '../middleware/auth.middleware';

const router: ExpressRouter = Router();

// GET /api/points/summary — learner's own summary
router.get('/summary', requireAuth, async (req: AuthRequest, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const summary = await getLearnerCPDSummary(req.user!.id, year);
    res.json(summary);
  } catch {
    res.status(500).json({ error: 'Could not fetch CPD summary' });
  }
});

// GET /api/points/records — learner's own records
router.get('/records', requireAuth, async (req: AuthRequest, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
    const records = await db.cPDRecord.findMany({
      where: { learnerId: req.user!.id, cycleYear: year },
      orderBy: { completedAt: 'desc' },
      include: { course: { select: { title: true } } },
    });
    res.json(records);
  } catch {
    res.status(500).json({ error: 'Could not fetch CPD records' });
  }
});

// POST /api/points/override — Admin only
const OverrideSchema = z.object({
  learnerId: z.string(),
  courseId: z.string().optional(),
  activityType: z.enum(['VIDEO_WATCH', 'QUIZ_PASS', 'READING', 'WEBINAR', 'WHATSAPP_QUIZ']),
  points: z.number().int().min(-50).max(50),
  note: z.string().min(5),
});

router.post('/override', requireAuth, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const data = OverrideSchema.parse(req.body);
    const result = await creditPoints({
      learnerId: data.learnerId,
      courseId: data.courseId,
      activityType: data.activityType as any,
      pointsOverride: data.points,
      overrideNote: data.note,
      isManualOverride: true,
    });
    res.json(result);
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: 'Override failed' });
  }
});

// GET /api/points/learner/:id — Admin or NCZ Officer
router.get('/learner/:id', requireAuth, requireRole('ADMIN', 'NCZ_OFFICER'), async (req, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const summary = await getLearnerCPDSummary(req.params.id, year);
    const records = await db.cPDRecord.findMany({
      where: { learnerId: req.params.id, cycleYear: summary.cycleYear },
      orderBy: { completedAt: 'desc' },
      include: { course: { select: { title: true } } },
    });
    res.json({ summary, records });
  } catch {
    res.status(500).json({ error: 'Could not fetch learner CPD data' });
  }
});

export default router;

