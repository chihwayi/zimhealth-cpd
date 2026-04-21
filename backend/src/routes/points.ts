import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { db } from '../lib/db';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { getLearnerCPDSummary, creditPoints } from '../services/cpd-engine';
import { canEarnWhatsAppPoints, getLearnerEntitlements } from '../services/entitlements';
import { z } from 'zod';
import type { AuthRequest } from '../middleware/auth.middleware';
import { requireBotSecret } from '../middleware/auth.middleware';

const router: ExpressRouter = Router();
const BotCreditSchema = z.object({
  phone: z.string().min(8),
  quizId: z.string().min(3),
  courseId: z.string().optional(),
  moduleId: z.string().optional(),
  attemptKey: z.string().min(6),
  quizScore: z.number().min(0).max(100),
});

// GET /api/points — learner's CPD records (optional year + limit; default recent across years)
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 100);
    const yearRaw = req.query.year;
    const where: { learnerId: string; cycleYear?: number } = { learnerId: req.user!.id };
    if (yearRaw !== undefined && yearRaw !== '') {
      const y = parseInt(String(yearRaw), 10);
      if (!Number.isNaN(y)) where.cycleYear = y;
    }

    const records = await db.cPDRecord.findMany({
      where,
      orderBy: { completedAt: 'desc' },
      take: limit,
      include: { course: { select: { title: true, category: true } } },
    });

    res.json(records);
  } catch {
    res.status(500).json({ error: 'Could not fetch CPD records' });
  }
});

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

// GET /api/points/bot/:phone — bot queries learner points by phone
router.get('/bot/:phone', requireBotSecret, async (req, res) => {
  try {
    const learner = await db.user.findUnique({ where: { phone: req.params.phone } });
    if (!learner) return res.status(404).json({ error: 'Learner not found' });
    const summary = await getLearnerCPDSummary(learner.id);
    res.json({ ...summary, learnerId: learner.id, fullName: learner.fullName });
  } catch {
    res.status(500).json({ error: 'Could not fetch points' });
  }
});

// POST /api/points/bot/credit — bot credits WhatsApp quiz points
router.post('/bot/credit', requireBotSecret, async (req, res) => {
  try {
    const { phone, quizId, courseId, attemptKey, quizScore } = BotCreditSchema.parse(req.body);
    const learner = await db.user.findUnique({ where: { phone } });
    if (!learner) return res.status(404).json({ error: 'Learner not found' });
    const cycleYear = new Date().getFullYear();

    // Enforce FREE-tier WhatsApp CPD cap at the backend.
    const allowed = await canEarnWhatsAppPoints(learner.id, cycleYear);
    if (!allowed) {
      const ent = await getLearnerEntitlements(learner.id);
      return res.status(402).json({
        error: 'WhatsApp CPD allowance reached for this cycle. Upgrade to continue earning points.',
        code: 'WHATSAPP_POINTS_CAP_REACHED',
        remainingWhatsappPoints: ent.remainingWhatsappPoints,
        subscriptionTier: ent.subscriptionTier,
      });
    }
    // Prevent farming: if already credited for this quiz this cycle, return 0 points.
    const existing = await db.cPDRecord.findFirst({
      where: { learnerId: learner.id, quizId, cycleYear, activityType: 'WHATSAPP_QUIZ' },
    });
    if (existing) {
      return res.json({ recordId: existing.id, pointsEarned: 0, alreadyCredited: true });
    }

    const result = await creditPoints({
      learnerId: learner.id,
      courseId,
      quizId,
      activityType: 'WHATSAPP_QUIZ' as any,
      quizScore,
    });

    // Persist attemptKey on the record for audit/deduplication visibility.
    if (result.recordId) {
      await db.cPDRecord.update({
        where: { id: result.recordId },
        data: { sourceAttemptKey: attemptKey },
      });
    }
    // Store attemptKey for audit/dedupe visibility
    await db.auditLog.create({
      data: {
        userId: learner.id,
        action: 'WHATSAPP_QUIZ_ATTEMPT_CREDIT',
        entityType: 'Quiz',
        entityId: quizId,
        meta: { attemptKey, pointsEarned: result.pointsEarned, courseId },
      },
    });
    res.json(result);
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: 'Could not credit points' });
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
