import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { db } from '../lib/db';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import {
  CreateCourseSchema,
  UpdateCourseSchema,
  CreateModuleSchema,
  CreateSectionSchema,
  CourseApprovalSchema,
} from './courses.schema';
import type { AuthRequest } from '../middleware/auth.middleware';
import { generateCourseFromGuideline } from '../services/ai-content-gen';
import { getAIProvider } from '../lib/redis';
import { canAccessPremiumCourse } from '../services/entitlements';

const router: ExpressRouter = Router();

async function getOwnedCourse(courseId: string, req: AuthRequest) {
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) return { error: { status: 404, body: { error: 'Course not found' } } };
  if (req.user!.role === 'CONTENT_MANAGER' && course.creatorId !== req.user!.id) {
    return { error: { status: 403, body: { error: 'Not authorised to edit this course' } } };
  }

  return { course };
}

// ─── Course CRUD ─────────────────────────────────────────────────────────────

// GET /api/courses — public browsing (published courses only, with filters)
router.get('/', async (req, res) => {
  try {
    const { category, difficulty, cadre, search, page = '1', limit = '12' } = req.query as Record<
      string,
      string
    >;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = { status: 'PUBLISHED' };
    if (category) where.category = category;
    if (difficulty) where.difficulty = difficulty;
    if (cadre) where.targetCadres = { has: cadre };
    if (search)
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { tags: { has: search.toLowerCase() } },
      ];

    const [courses, total] = await Promise.all([
      db.course.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          creator: { select: { fullName: true, avatarUrl: true } },
          _count: { select: { enrollments: true } },
        },
      }),
      db.course.count({ where }),
    ]);

    res.json({ courses, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch {
    res.status(500).json({ error: 'Could not fetch courses' });
  }
});

// GET /api/courses/:id
router.get('/:id', async (req, res) => {
  try {
    const course = await db.course.findUnique({
      where: { id: req.params.id },
      include: {
        creator: { select: { id: true, fullName: true, avatarUrl: true } },
        modules: {
          orderBy: { order: 'asc' },
          include: { sections: { orderBy: { order: 'asc' } }, quizzes: true },
        },
        reviews: { take: 10, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!course) return res.status(404).json({ error: 'Course not found' });
    res.json(course);
  } catch {
    res.status(500).json({ error: 'Could not fetch course' });
  }
});

// POST /api/courses — CONTENT_MANAGER or ADMIN
router.post('/', requireAuth, requireRole('CONTENT_MANAGER', 'ADMIN'), async (req: AuthRequest, res) => {
  try {
    const data = CreateCourseSchema.parse(req.body);
    const course = await db.course.create({
      data: { ...data, creatorId: req.user!.id, status: 'DRAFT' },
    });
    res.status(201).json(course);
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: 'Could not create course' });
  }
});

// GET /api/courses/:id/quizzes — quizzes for this course (creator/admin)
router.get(
  '/:id/quizzes',
  requireAuth,
  requireRole('CONTENT_MANAGER', 'ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const owned = await getOwnedCourse(req.params.id, req);
      if (owned.error) return res.status(owned.error.status).json(owned.error.body);

      const quizzes = await db.quiz.findMany({
        where: { courseId: req.params.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, moduleId: true },
      });
      res.json({ quizzes });
    } catch {
      res.status(500).json({ error: 'Could not fetch quizzes' });
    }
  },
);

// PATCH /api/courses/:id
router.patch(
  '/:id',
  requireAuth,
  requireRole('CONTENT_MANAGER', 'ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const course = await db.course.findUnique({ where: { id: req.params.id } });
      if (!course) return res.status(404).json({ error: 'Course not found' });

      // Creators can only edit their own courses
      if (req.user!.role === 'CONTENT_MANAGER' && course.creatorId !== req.user!.id) {
        return res.status(403).json({ error: 'Not authorised to edit this course' });
      }

      const data = UpdateCourseSchema.parse(req.body);
      const updated = await db.course.update({ where: { id: req.params.id }, data });
      res.json(updated);
    } catch (err: any) {
      if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
      res.status(500).json({ error: 'Could not update course' });
    }
  },
);

// POST /api/courses/:id/submit-review — Creator submits for admin review
router.post(
  '/:id/submit-review',
  requireAuth,
  requireRole('CONTENT_MANAGER'),
  async (req: AuthRequest, res) => {
    try {
      const course = await db.course.findUnique({ where: { id: req.params.id } });
      if (!course) return res.status(404).json({ error: 'Course not found' });
      if (course.creatorId !== req.user!.id) return res.status(403).json({ error: 'Not your course' });
      if (course.status !== 'DRAFT')
        return res.status(400).json({ error: 'Course must be in DRAFT status to submit for review' });

      const updated = await db.course.update({
        where: { id: req.params.id },
        data: { status: 'UNDER_REVIEW' },
      });
      res.json(updated);
    } catch {
      res.status(500).json({ error: 'Could not submit course for review' });
    }
  },
);

// POST /api/courses/:id/approve — Admin approves or rejects
router.post('/:id/approve', requireAuth, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { action, reason, reviewerNotes } = CourseApprovalSchema.parse(req.body);
    const newStatus = action === 'APPROVE' ? 'PUBLISHED' : 'DRAFT';
    const updated = await db.course.update({
      where: { id: req.params.id },
      data: { status: newStatus, aiReviewNotes: reviewerNotes ?? undefined },
    });
    await db.auditLog.create({
      data: {
        userId: req.user!.id,
        action: action === 'APPROVE' ? 'ADMIN_COURSE_APPROVED' : 'ADMIN_COURSE_REJECTED',
        entityType: 'Course',
        entityId: req.params.id,
        meta: { action, reason, reviewerNotes, newStatus },
      },
    });
    res.json({ course: updated, action, reason });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: 'Could not process approval' });
  }
});

// ─── Module CRUD ─────────────────────────────────────────────────────────────

// POST /api/courses/:id/modules
router.post(
  '/:id/modules',
  requireAuth,
  requireRole('CONTENT_MANAGER', 'ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const data = CreateModuleSchema.parse(req.body);
      const owned = await getOwnedCourse(req.params.id, req);
      if (owned.error) return res.status(owned.error.status).json(owned.error.body);

      const module = await db.module.create({ data: { ...data, courseId: req.params.id } });
      res.status(201).json(module);
    } catch (err: any) {
      if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
      res.status(500).json({ error: 'Could not create module' });
    }
  },
);

// POST /api/courses/:courseId/modules/:moduleId/sections
router.post(
  '/:courseId/modules/:moduleId/sections',
  requireAuth,
  requireRole('CONTENT_MANAGER', 'ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const data = CreateSectionSchema.parse(req.body);
      const owned = await getOwnedCourse(req.params.courseId, req);
      if (owned.error) return res.status(owned.error.status).json(owned.error.body);

      const module = await db.module.findFirst({
        where: { id: req.params.moduleId, courseId: req.params.courseId },
      });
      if (!module) return res.status(404).json({ error: 'Module not found' });

      const section = await db.contentSection.create({ data: { ...data, moduleId: req.params.moduleId } });
      res.status(201).json(section);
    } catch (err: any) {
      if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
      res.status(500).json({ error: 'Could not create section' });
    }
  },
);

// PATCH /api/courses/:courseId/modules/:moduleId/sections/:sectionId
router.patch(
  '/:courseId/modules/:moduleId/sections/:sectionId',
  requireAuth,
  requireRole('CONTENT_MANAGER', 'ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const data = CreateSectionSchema.partial().parse(req.body);
      const owned = await getOwnedCourse(req.params.courseId, req);
      if (owned.error) return res.status(owned.error.status).json(owned.error.body);

      const section = await db.contentSection.findFirst({
        where: { id: req.params.sectionId, moduleId: req.params.moduleId },
      });
      if (!section) return res.status(404).json({ error: 'Section not found' });

      const updated = await db.contentSection.update({
        where: { id: req.params.sectionId },
        data,
      });
      res.json(updated);
    } catch (err: any) {
      if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
      res.status(500).json({ error: 'Could not update section' });
    }
  },
);

// ─── POST /api/courses/:id/ai-generate-content ───────────────────────────────
// Accepts a block of guideline text + target cadre; generates and persists
// a full set of modules + sections + quizzes on the course via AI.
router.post(
  '/:id/ai-generate-content',
  requireAuth,
  requireRole('CONTENT_MANAGER', 'ADMIN'),
  async (req: AuthRequest, res) => {
    const { guidelineText, targetCadre } = req.body as {
      guidelineText?: string;
      targetCadre?: string;
      sourceName?: string;
    };

    if (!guidelineText || guidelineText.trim().length < 50) {
      return res.status(400).json({ error: 'guidelineText must be at least 50 characters' });
    }

    const owned = await getOwnedCourse(req.params.id, req);
    if (owned.error) return res.status(owned.error.status).json(owned.error.body);

    try {
      const provider = await getAIProvider().catch(() => null);
      const generated = await generateCourseFromGuideline(
        guidelineText,
        owned.course!.title,
        targetCadre ?? 'Registered General Nurse',
      );

      // Persist generated content to the database inside a transaction
      const result = await db.$transaction(async (tx) => {
        const createdModules: string[] = [];

        for (const genModule of generated.modules) {
          const module = await tx.module.create({
            data: {
              courseId: req.params.id,
              title: genModule.title,
              order: genModule.order,
            },
          });

          // Create reading sections
          for (const sec of genModule.sections) {
            await tx.contentSection.create({
              data: {
                moduleId: module.id,
                type: sec.type,
                title: sec.title,
                order: sec.order,
                content: sec.content,
              },
            });
          }

          // Create quiz
          const quiz = await tx.quiz.create({
            data: {
              courseId: req.params.id,
              moduleId: module.id,
              title: genModule.quiz.title,
              passMark: genModule.quiz.passMark,
            },
          });

          // Create quiz questions + options
          for (const q of genModule.quiz.questions) {
            const question = await tx.question.create({
              data: {
                quizId: quiz.id,
                text: q.text,
                order: q.order,
                type: 'MULTIPLE_CHOICE',
              },
            });

            for (const opt of q.options) {
              await tx.questionOption.create({
                data: {
                  questionId: question.id,
                  text: opt.text,
                  isCorrect: opt.isCorrect,
                },
              });
            }
          }

          createdModules.push(module.id);
        }

        return createdModules;
      });

      await db.course.update({
        where: { id: req.params.id },
        data: {
          aiGeneratedAt: new Date(),
          aiGeneratedProvider: provider ?? 'auto',
          aiSourceName: (req.body as any)?.sourceName ? String((req.body as any).sourceName).slice(0, 200) : 'Guideline text',
        },
      });

      await db.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'CREATOR_AI_GENERATED_COURSE_CONTENT',
          entityType: 'Course',
          entityId: req.params.id,
          meta: { targetCadre, provider: provider ?? 'auto', sourceName: (req.body as any)?.sourceName ?? 'Guideline text' },
        },
      });

      res.status(201).json({
        message: `Generated ${result.length} module(s) with sections and quizzes`,
        moduleIds: result,
        preview: {
          title: generated.title,
          subtitle: generated.subtitle,
          description: generated.description,
          estimatedMinutes: generated.estimatedMinutes,
          cpdPoints: generated.cpdPoints,
          moduleCount: generated.modules.length,
        },
      });
    } catch (err: any) {
      if (err?.message?.includes('AI did not return')) {
        return res.status(422).json({ error: 'AI generation failed — try again or use simpler input text' });
      }
      if (err?.name === 'ZodError') {
        return res.status(422).json({ error: 'AI returned malformed content structure', details: err.errors });
      }
      res.status(500).json({ error: 'Content generation failed' });
    }
  },
);

// POST /api/courses/:id/enroll — Learner enrolls
router.post('/:id/enroll', requireAuth, requireRole('LEARNER'), async (req: AuthRequest, res) => {
  try {
    const course = await db.course.findUnique({
      where: { id: req.params.id },
      select: { id: true, status: true, title: true },
    });
    if (!course || course.status !== 'PUBLISHED') {
      return res.status(404).json({ error: 'Course not found' });
    }

    const hasPremiumAccess = await canAccessPremiumCourse(req.user!.id, course.id);
    if (!hasPremiumAccess) {
      return res.status(402).json({
        error: 'Upgrade required to access the full web course library.',
        code: 'UPGRADE_REQUIRED',
      });
    }

    const enrollment = await db.enrollment.upsert({
      where: { learnerId_courseId: { learnerId: req.user!.id, courseId: req.params.id } },
      create: { learnerId: req.user!.id, courseId: req.params.id },
      update: { lastAccessAt: new Date() },
    });
    res.json(enrollment);
  } catch {
    res.status(500).json({ error: 'Could not enroll in course' });
  }
});

export default router;
