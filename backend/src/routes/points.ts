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
import twilio from 'twilio';

const router: ExpressRouter = Router();

async function sendWhatsAppMessage(to: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_NUMBER;
  const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

  if (!sid || !token || !from) {
    console.info(`[points] Completion message dry run: to=${toFormatted}\n${body}`);
    return;
  }

  const client = twilio(sid, token);
  await client.messages.create({ from, to: toFormatted, body });
}
const BotCreditSchema = z.object({
  phone: z.string().min(8),
  quizId: z.string().min(3),
  courseId: z.string().optional(),
  moduleId: z.string().optional(),
  attemptKey: z.string().min(6),
  quizScore: z.number().min(0).max(100),
  // Whether this quiz attempt passed — every completed attempt (pass or
  // fail) is reported so attemptLimit enforcement matches the web path.
  passed: z.boolean().default(true),
  startedAt: z.coerce.date().optional(),
});

async function listLearnerCPDRecords(req: AuthRequest, defaultToCurrentYear: boolean) {
  const learner = await db.user.findUnique({ where: { id: req.user!.id }, select: { councilId: true } });
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 100);
  const yearRaw = req.query.year;
  const where: { learnerId: string; cycleYear?: number } = { learnerId: req.user!.id };

  if (yearRaw !== undefined && yearRaw !== '') {
    const y = parseInt(String(yearRaw), 10);
    if (!Number.isNaN(y)) where.cycleYear = y;
  } else if (defaultToCurrentYear) {
    where.cycleYear = new Date().getFullYear();
  }

  const records = await db.cPDRecord.findMany({
    where,
    orderBy: { completedAt: 'desc' },
    take: limit,
    include: { course: { select: { id: true, title: true, category: true, cpdPoints: true } } },
  });

  const courseIds = records.map((record) => record.course?.id).filter(Boolean) as string[];
  const pointsByCourseId =
    learner?.councilId && courseIds.length
      ? Object.fromEntries(
          (
            await db.councilCourseReview.findMany({
              where: { councilId: learner.councilId, courseId: { in: courseIds }, status: 'APPROVED', points: { not: null } },
              select: { courseId: true, points: true },
            })
          ).map((row) => [row.courseId, row.points]),
        )
      : {};

  return records.map((record: any) => {
    const effectivePoints =
      record.course?.id && pointsByCourseId[record.course.id] != null
        ? pointsByCourseId[record.course.id]
        : (record.course?.cpdPoints ?? null);
    return {
      ...record,
      course: record.course ? { title: record.course.title, category: record.course.category, effectivePoints } : null,
    };
  });
}

// GET /api/points — deprecated root endpoint; redirect to /records.
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const qs = new URLSearchParams(req.query as Record<string, string>).toString();
  return res.redirect(307, `/api/points/records${qs ? `?${qs}` : ''}`);
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
    const records = await listLearnerCPDRecords(req, true);
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

// POST /api/points/bot/credit — bot reports a completed WhatsApp quiz attempt
// (pass or fail) and, if passed, credits points. Mirrors the web
// POST /api/quizzes/:id/attempt path: every completed attempt is recorded
// against the quiz's attemptLimit, not just passing ones.
router.post('/bot/credit', requireBotSecret, async (req, res) => {
  try {
    const { phone, quizId, courseId, moduleId, attemptKey, quizScore, passed, startedAt } = BotCreditSchema.parse(req.body);
    const learner = await db.user.findUnique({
      where: { phone },
      select: { id: true, fullName: true, phone: true, subscriptionTier: true },
    });
    if (!learner) return res.status(404).json({ error: 'Learner not found' });
    const cycleYear = new Date().getFullYear();

    const quiz = await db.quiz.findUnique({
      where: { id: quizId },
      select: { attemptLimit: true, questions: { select: { id: true } } },
    });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    const attemptCount = await db.quizAttempt.count({ where: { learnerId: learner.id, quizId } });
    if (attemptCount >= quiz.attemptLimit) {
      return res.status(400).json({ error: 'Attempt limit reached' });
    }

    const totalQuestions = quiz.questions.length || 1;
    const MIN_SECONDS_PER_QUESTION = 5;
    const submittedAt = new Date();
    const elapsedSeconds = startedAt ? (submittedAt.getTime() - startedAt.getTime()) / 1000 : null;
    const minPlausibleSeconds = totalQuestions * MIN_SECONDS_PER_QUESTION;
    const flaggedFast = elapsedSeconds !== null && elapsedSeconds >= 0 && elapsedSeconds < minPlausibleSeconds;

    const attempt = await db.quizAttempt.create({
      data: {
        learnerId: learner.id,
        quizId,
        score: quizScore,
        passed,
        answers: {},
        startedAt,
        flaggedFast,
        completedAt: submittedAt,
      },
    });

    if (flaggedFast) {
      await db.auditLog.create({
        data: {
          userId: learner.id,
          action: 'QUIZ_SUBMISSION_FLAGGED_FAST',
          entityType: 'QuizAttempt',
          entityId: attempt.id,
          meta: { quizId, elapsedSeconds, minPlausibleSeconds, totalQuestions, channel: 'WHATSAPP' },
        },
      });
    }

    if (!passed) {
      return res.json({ attemptId: attempt.id, passed: false, pointsEarned: 0 });
    }

    // Enforce FREE-tier WhatsApp CPD cap at the backend.
    const entitlementBeforeCredit = await getLearnerEntitlements(learner.id);
    const allowed = await canEarnWhatsAppPoints(learner.id, cycleYear);
    if (!allowed) {
      return res.status(402).json({
        error: 'WhatsApp CPD allowance reached for this cycle. Upgrade to continue earning points.',
        code: 'WHATSAPP_POINTS_CAP_REACHED',
        remainingWhatsappPoints: entitlementBeforeCredit.remainingWhatsappPoints,
        subscriptionTier: entitlementBeforeCredit.subscriptionTier,
      });
    }
    // Prevent farming: if already credited for this quiz this cycle, return 0 points.
    const existing = await db.cPDRecord.findFirst({
      where: { learnerId: learner.id, quizId, cycleYear, activityType: 'WHATSAPP_QUIZ' },
    });
    if (existing) {
      return res.json({ attemptId: attempt.id, recordId: existing.id, passed: true, pointsEarned: 0, alreadyCredited: true });
    }

    const result = await creditPoints({
      learnerId: learner.id,
      courseId,
      quizId,
      activityType: 'WHATSAPP_QUIZ' as any,
      quizScore,
    });

    if (
      entitlementBeforeCredit.subscriptionTier === 'FREE' &&
      Number.isFinite(entitlementBeforeCredit.remainingWhatsappPoints) &&
      result.pointsEarned > entitlementBeforeCredit.remainingWhatsappPoints
    ) {
      result.pointsEarned = entitlementBeforeCredit.remainingWhatsappPoints;
      if (result.recordId) {
        await db.cPDRecord.update({
          where: { id: result.recordId },
          data: { pointsEarned: result.pointsEarned },
        });
      }
    }

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
        meta: { attemptKey, pointsEarned: result.pointsEarned, courseId, moduleId },
      },
    });

    const learnerPhone = learner.phone;
    if (result.pointsEarned > 0 && learnerPhone) {
      void (async () => {
        try {
          const summary = await getLearnerCPDSummary(learner.id);
          const previousTotal = summary.totalPoints - result.pointsEarned;
          if (summary.totalPoints >= summary.requiredPoints && previousTotal < summary.requiredPoints) {
            const firstName = learner.fullName.split(' ')[0] || 'there';
            const webUrl = process.env.WEB_URL ?? 'https://zimhealthcpd.co.zw';
            const message =
              `Congratulations, ${firstName}!\n\n` +
              `You have earned ${summary.totalPoints} CPD points, meeting your ${summary.cycleYear} renewal requirement of ${summary.requiredPoints} points.\n\n` +
              `Your points have been recorded and will be submitted to your council.\n\n` +
              `Visit ${webUrl}/certificates to download your CPD certificate.`;
            await sendWhatsAppMessage(learnerPhone, message);
          }
        } catch (err) {
          console.error('[points/bot/credit] Completion notification failed', err);
        }
      })();
    }

    res.json({ attemptId: attempt.id, passed: true, ...result });
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
router.get('/learner/:id', requireAuth, requireRole('ADMIN', 'NCZ_OFFICER'), async (req: AuthRequest, res) => {
  try {
    if (req.user!.role === 'NCZ_OFFICER') {
      const [officer, learner] = await Promise.all([
        db.user.findUnique({ where: { id: req.user!.id }, select: { councilId: true } }),
        db.user.findUnique({ where: { id: req.params.id }, select: { councilId: true } }),
      ]);
      if (!learner) return res.status(404).json({ error: 'Learner not found' });
      if (!officer?.councilId || learner.councilId !== officer.councilId) {
        return res.status(403).json({ error: 'This learner belongs to another council.' });
      }
    }
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
