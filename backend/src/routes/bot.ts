import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { db } from '../lib/db';
import { requireBotSecret } from '../middleware/auth.middleware';
import { randomBytes } from 'crypto';
import { z } from 'zod';

const router: ExpressRouter = Router();

// ─── GET /api/bot/courses?phone=+263771234567 ─────────────────────────────────
// Returns the learner's enrolled published courses (ordered by last access)
router.get('/courses', requireBotSecret, async (req, res) => {
  const phone = typeof req.query.phone === 'string' ? req.query.phone.trim() : '';
  if (!phone) return res.status(400).json({ error: 'phone required' });

  try {
    const learner = await db.user.findUnique({ where: { phone } });
    if (!learner) return res.status(404).json({ error: 'Learner not found' });

    const enrollments = await db.enrollment.findMany({
      where: { learnerId: learner.id },
      orderBy: [{ lastAccessAt: 'desc' }, { enrolledAt: 'desc' }],
      include: {
        course: {
          select: {
            id: true,
            title: true,
            status: true,
            cpdPoints: true,
            _count: { select: { modules: true } },
          },
        },
      },
    });

    const courses = enrollments
      .filter((e) => e.course.status === 'PUBLISHED')
      .map((e) => ({
        id: e.course.id,
        title: e.course.title,
        cpdPoints: e.course.cpdPoints,
        moduleCount: e.course._count.modules,
        progressPercent: Math.round(e.progress * 100),
      }));

    res.json({ learnerId: learner.id, courses });
  } catch {
    res.status(500).json({ error: 'Could not fetch courses' });
  }
});

// ─── GET /api/bot/courses/available?phone=+263771234567 ─────────────────────
// Returns published courses the learner can start from WhatsApp.
router.get('/courses/available', requireBotSecret, async (req, res) => {
  const phone = typeof req.query.phone === 'string' ? req.query.phone.trim() : '';
  if (!phone) return res.status(400).json({ error: 'phone required' });

  try {
    const learner = await db.user.findUnique({
      where: { phone },
      select: { id: true, councilId: true },
    });
    if (!learner) return res.status(404).json({ error: 'Learner not found' });

    const enrolled = await db.enrollment.findMany({
      where: { learnerId: learner.id },
      select: { courseId: true },
    });
    const enrolledIds = enrolled.map((entry) => entry.courseId);

    const courses = await db.course.findMany({
      where: {
        status: 'PUBLISHED',
        id: { notIn: enrolledIds },
        OR: [
          { isPublicToAll: true },
          ...(learner.councilId ? [{ targetCouncilIds: { has: learner.councilId } }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        cpdPoints: true,
        estimatedMinutes: true,
        _count: { select: { modules: true } },
      },
    });

    return res.json({
      learnerId: learner.id,
      courses: courses.map((course) => ({
        id: course.id,
        title: course.title,
        cpdPoints: course.cpdPoints,
        estimatedMinutes: course.estimatedMinutes,
        moduleCount: course._count.modules,
        progressPercent: 0,
      })),
    });
  } catch {
    return res.status(500).json({ error: 'Could not fetch available courses' });
  }
});

// ─── POST /api/bot/enroll ────────────────────────────────────────────────────
router.post('/enroll', requireBotSecret, async (req, res) => {
  const { phone, courseId } = req.body as { phone?: string; courseId?: string };
  if (!phone || !courseId) {
    return res.status(400).json({ error: 'phone and courseId are required' });
  }

  try {
    const learner = await db.user.findUnique({
      where: { phone },
      select: { id: true, councilId: true },
    });
    if (!learner) return res.status(404).json({ error: 'Learner not found' });

    const course = await db.course.findFirst({
      where: {
        id: courseId,
        status: 'PUBLISHED',
        OR: [
          { isPublicToAll: true },
          ...(learner.councilId ? [{ targetCouncilIds: { has: learner.councilId } }] : []),
        ],
      },
      select: { id: true, title: true },
    });
    if (!course) return res.status(404).json({ error: 'Course not available' });

    const enrollment = await db.enrollment.upsert({
      where: { learnerId_courseId: { learnerId: learner.id, courseId } },
      create: { learnerId: learner.id, courseId, progress: 0 },
      update: {},
    });

    return res.json({ enrollmentId: enrollment.id, courseTitle: course.title });
  } catch {
    return res.status(500).json({ error: 'Enrolment failed' });
  }
});

// ─── GET /api/bot/course/:courseId/modules ────────────────────────────────────
// Returns module list for a course (for bot navigation)
router.get('/course/:courseId/modules', requireBotSecret, async (req, res) => {
  try {
    const modules = await db.module.findMany({
      where: { courseId: req.params.courseId },
      select: {
        id: true,
        title: true,
        order: true,
        _count: { select: { sections: true } },
      },
      orderBy: { order: 'asc' },
    });
    res.json({ modules: modules.map((m) => ({ ...m, sectionCount: m._count.sections })) });
  } catch {
    res.status(500).json({ error: 'Could not fetch modules' });
  }
});

// ─── GET /api/bot/module/:moduleId ───────────────────────────────────────────
// Returns module sections + quiz data formatted for WhatsApp delivery
router.get('/module/:moduleId', requireBotSecret, async (req, res) => {
  try {
    const module = await db.module.findUnique({
      where: { id: req.params.moduleId },
      include: {
        sections: { orderBy: { order: 'asc' } },
        quizzes: {
          include: {
            questions: {
              include: { options: true },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!module) return res.status(404).json({ error: 'Module not found' });

    const letters = ['A', 'B', 'C', 'D', 'E'];

    res.json({
      id: module.id,
      title: module.title,
      order: module.order,
      sections: module.sections.map((s) => ({
        id: s.id,
        type: s.type,
        title: s.title,
        order: s.order,
        content: s.content,
        mediaUrl: s.mediaUrl,
      })),
      quizzes: module.quizzes.map((q) => ({
        id: q.id,
        title: q.title,
        passMark: q.passMark,
        questions: q.questions.map((ques) => {
          const correctIndex = ques.options.findIndex((o) => o.isCorrect);
          return {
            id: ques.id,
            text: ques.text,
            options: ques.options.map((opt, i) => ({
              letter: letters[i] ?? String(i + 1),
              text: opt.text,
            })),
            correctLetter: letters[correctIndex] ?? 'A',
          };
        }),
      })),
    });
  } catch {
    res.status(500).json({ error: 'Could not fetch module content' });
  }
});

// ─── GET /api/bot/lookup?phone=+263771234567 ─────────────────────────────────
// Check whether a phone number has a registered account
router.get('/lookup', requireBotSecret, async (req, res) => {
  const phone = typeof req.query.phone === 'string' ? req.query.phone.trim() : '';
  if (!phone) return res.status(400).json({ error: 'phone required' });

  try {
    const user = await db.user.findUnique({
      where: { phone },
      select: { id: true, fullName: true, cadre: true, subscriptionTier: true },
    });
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Lookup failed' });
  }
});

// ─── POST /api/bot/register ───────────────────────────────────────────────────
// Create a WhatsApp-only account (phone is the auth factor — verified by Twilio)
router.post('/register', requireBotSecret, async (req, res) => {
  const { phone, fullName, cadre, councilId, nczRegistrationNumber, institution, province } = req.body as {
    phone?: string;
    fullName?: string;
    cadre?: string;
    councilId?: string;
    nczRegistrationNumber?: string;
    institution?: string;
    province?: string;
  };

  if (!phone || !fullName || !cadre) {
    return res.status(400).json({ error: 'phone, fullName, and cadre are required' });
  }

  try {
    const existing = await db.user.findUnique({ where: { phone } });
    if (existing) return res.json({ userId: existing.id, fullName: existing.fullName, existing: true });

    // Generate a placeholder email so the unique constraint is satisfied
    const safeSuffix = phone.replace(/\D/g, '');
    const placeholderEmail = `wa_${safeSuffix}@zimhealth.internal`;

    const user = await db.user.create({
      data: {
        email: placeholderEmail,
        passwordHash: randomBytes(32).toString('hex'), // unusable random hash — login is via WhatsApp only
        fullName,
        phone,
        cadre: cadre as any,
        councilId: councilId || null,
        nczRegistrationNumber: nczRegistrationNumber || null,
        institution: institution || null,
        province: province || null,
      },
      select: { id: true, fullName: true, cadre: true },
    });

    res.status(201).json({ userId: user.id, fullName: user.fullName, existing: false });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      // Duplicate phone or NCZ number — look up and return existing
      const existing = await db.user.findUnique({ where: { phone }, select: { id: true, fullName: true } });
      if (existing) return res.json({ userId: existing.id, fullName: existing.fullName, existing: true });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ─── POST /api/bot/issues ──────────────────────────────────────────────────────
// Lets a nurse report a bug/issue directly from WhatsApp; helpdesk triages via
// GET/PATCH /api/issues.
const BotCreateIssueSchema = z.object({
  phone: z.string().min(5),
  title: z.string().min(3).max(150),
  description: z.string().min(5).max(2000),
});

router.post('/issues', requireBotSecret, async (req, res) => {
  try {
    const data = BotCreateIssueSchema.parse(req.body);
    const reporter = await db.user.findUnique({ where: { phone: data.phone }, select: { id: true } });
    const issue = await db.issueReport.create({
      data: {
        reporterId: reporter?.id,
        reporterContact: reporter ? undefined : data.phone,
        title: data.title,
        description: data.description,
        source: 'WHATSAPP',
      },
    });
    res.status(201).json({ id: issue.id });
  } catch (err: any) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: 'Could not submit issue report' });
  }
});

// ─── POST /api/bot/analytics/ai-tutor ─────────────────────────────────────────
// Bot-only analytics + audit trail for AI tutor interactions.
const AiTutorAnalyticsSchema = z.object({
  phone: z.string().min(5),
  event: z.enum(['REQUEST', 'CACHE_HIT', 'PAYWALL', 'FAILURE', 'FOLLOWUP_ANSWER', 'UPGRADE_CTA']),
  provider: z.string().optional(),
  latencyMs: z.number().int().nonnegative().optional(),
  cacheHit: z.boolean().optional(),
  fallbackUsed: z.boolean().optional(),
  success: z.boolean().optional(),
  theme: z.string().optional(),
  meta: z.unknown().optional(),
});

router.post('/analytics/ai-tutor', requireBotSecret, async (req, res) => {
  try {
    const data = AiTutorAnalyticsSchema.parse(req.body);
    const learner = await db.user.findUnique({ where: { phone: data.phone }, select: { id: true } });
    if (!learner) return res.status(404).json({ error: 'Learner not found' });

    await db.auditLog.create({
      data: {
        userId: learner.id,
        action: `BOT_AI_TUTOR_${data.event}`,
        entityType: 'AiTutor',
        entityId: data.provider ?? 'unknown',
        meta: {
          provider: data.provider,
          latencyMs: data.latencyMs,
          cacheHit: data.cacheHit,
          fallbackUsed: data.fallbackUsed,
          success: data.success,
          theme: data.theme,
          ...(data.meta && typeof data.meta === 'object' ? { extra: data.meta } : {}),
        },
      },
    });

    return res.json({ ok: true });
  } catch (err: any) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: 'Could not record analytics' });
  }
});

export default router;
