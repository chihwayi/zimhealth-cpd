import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { db } from '../lib/db';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { upload } from '../middleware/upload.middleware';
import {
  CreateCourseSchema,
  UpdateCourseSchema,
  CreateModuleSchema,
  CreateSectionSchema,
  CourseApprovalSchema,
} from './courses.schema';
import type { AuthRequest } from '../middleware/auth.middleware';
import { generateCourseFromGuideline } from '../services/ai-content-gen';
import { resolveGuidelineText } from '../services/guideline-ingestion';
import { getAIProvider } from '../lib/redis';
import { verifyAccessToken } from '../services/auth.service';
import { assertLearnerCanAccessCourse, buildEligibleCourseWhere } from '../services/course-eligibility';

const router: ExpressRouter = Router();

async function getOwnedCourse(courseId: string, req: AuthRequest) {
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) return { error: { status: 404, body: { error: 'Course not found' } } };
  if (req.user!.role === 'CONTENT_MANAGER' && course.creatorId !== req.user!.id) {
    return { error: { status: 403, body: { error: 'Not authorised to edit this course' } } };
  }

  return { course };
}

async function getRequestLearner(req: any) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const payload = verifyAccessToken(header.slice(7));
    if (payload.role !== 'LEARNER') return null;
    return db.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, councilId: true, professionalTitle: true, cadre: true },
    });
  } catch {
    return null;
  }
}

async function getRequestRole(req: any): Promise<string | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const payload = verifyAccessToken(header.slice(7));
    return payload.role ?? null;
  } catch {
    return null;
  }
}

// ─── Course CRUD ─────────────────────────────────────────────────────────────

// GET /api/courses — public browsing (published courses only, with filters)
router.get('/', async (req, res) => {
  try {
    const { category, specialtyTrack, difficulty, language, cadre, search, page = '1', limit = '12' } = req.query as Record<
      string,
      string
    >;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const learner = await getRequestLearner(req);
    const where: any = learner
      ? buildEligibleCourseWhere(learner)
      : {
          status: 'PUBLISHED',
          OR: [
            { isPublicToAll: true },
            { AND: [{ targetCouncilIds: { isEmpty: true } }, { targetTitles: { isEmpty: true } }, { targetCadres: { isEmpty: true } }] },
          ],
        };
    if (category) where.category = category;
    if (specialtyTrack) where.specialtyTrack = specialtyTrack;
    if (difficulty) where.difficulty = difficulty;
    if (language) where.language = language;
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
          ...(learner?.councilId
            ? {
                councilReviews: {
                  where: { councilId: learner.councilId, status: 'APPROVED', points: { not: null } },
                  select: { points: true },
                  take: 1,
                },
              }
            : {}),
        },
      }),
      db.course.count({ where }),
    ]);

    if (learner?.councilId) {
      const withEffectivePoints = courses.map((course: any) => {
        const effectivePoints = Array.isArray(course.councilReviews) && course.councilReviews.length ? course.councilReviews[0].points : null;
        delete course.councilReviews;
        return { ...course, effectivePoints };
      });
      return res.json({ courses: withEffectivePoints, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    }

    return res.json({ courses, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch {
    res.status(500).json({ error: 'Could not fetch courses' });
  }
});

// GET /api/courses/:id
router.get('/:id', async (req, res) => {
  try {
    const learner = await getRequestLearner(req);
    const role = await getRequestRole(req);
    const course = await db.course.findUnique({
      where: { id: req.params.id },
      include: {
        creator: { select: { id: true, fullName: true, avatarUrl: true } },
        modules: {
          orderBy: { order: 'asc' },
          include: { sections: { orderBy: { order: 'asc' } }, quizzes: true },
        },
        reviews: { take: 10, orderBy: { createdAt: 'desc' } },
        ...(learner?.councilId
          ? {
              councilReviews: {
                where: { councilId: learner.councilId, status: 'APPROVED', points: { not: null } },
                select: { points: true },
                take: 1,
              },
            }
          : {}),
      },
    });
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (course.status !== 'PUBLISHED') {
      const isStaff = role === 'PLATFORM_OWNER' || role === 'CONTENT_MANAGER';
      if (!isStaff) {
        return res.status(404).json({ error: 'Course not found' });
      }
    }
    if (course.status === 'PUBLISHED' && learner) {
      const allowed = await assertLearnerCanAccessCourse(learner.id, course.id);
      if (!allowed) return res.status(403).json({ error: 'This course is not assigned to your council or professional title.' });
    }
    if (learner?.councilId) {
      const c: any = course;
      const effectivePoints = Array.isArray(c.councilReviews) && c.councilReviews.length ? c.councilReviews[0].points : null;
      delete c.councilReviews;
      return res.json({ ...c, effectivePoints });
    }
    return res.json(course);
  } catch {
    res.status(500).json({ error: 'Could not fetch course' });
  }
});

// POST /api/courses — CONTENT_MANAGER or ADMIN
router.post('/', requireAuth, requireRole('CONTENT_MANAGER', 'PLATFORM_OWNER'), async (req: AuthRequest, res) => {
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
  requireRole('CONTENT_MANAGER', 'PLATFORM_OWNER'),
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
  requireRole('CONTENT_MANAGER', 'PLATFORM_OWNER'),
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
      if (!course.isPublicToAll && !course.targetCouncilIds.length && !course.targetTitles.length && !course.targetCadres.length) {
        return res.status(400).json({ error: 'Choose who should view this course, or confirm All users before submitting.' });
      }
      if (!course.targetCouncilIds.length) {
        return res
          .status(400)
          .json({ error: 'Select at least one council for review so the council can assign CPD points before learners see the course.' });
      }

      // Ensure council review rows exist and reset any prior rejection.
      await db.councilCourseReview.updateMany({
        where: { courseId: course.id, councilId: { in: course.targetCouncilIds } },
        data: {
          status: 'PENDING_REVIEW',
          points: null,
          rejectionReason: null,
          reviewedAt: null,
          reviewedByUserId: null,
        },
      });
      await db.councilCourseReview.createMany({
        skipDuplicates: true,
        data: course.targetCouncilIds.map((councilId) => ({
          courseId: course.id,
          councilId,
          status: 'PENDING_REVIEW',
        })),
      });

      const updated = await db.course.update({
        where: { id: req.params.id },
        data: { status: 'UNDER_REVIEW', cpdPoints: 0 },
      });
      res.json({ course: updated, councilTargets: course.targetCouncilIds.length });
    } catch {
      res.status(500).json({ error: 'Could not submit course for review' });
    }
  },
);

// POST /api/courses/:id/resubmit-council — Creator re-queues council review(s) after a rejection
router.post(
  '/:id/resubmit-council',
  requireAuth,
  requireRole('CONTENT_MANAGER'),
  async (req: AuthRequest, res) => {
    try {
      const course = await db.course.findUnique({
        where: { id: req.params.id },
        select: { id: true, creatorId: true, targetCouncilIds: true, status: true },
      });
      if (!course) return res.status(404).json({ error: 'Course not found' });
      if (course.creatorId !== req.user!.id) return res.status(403).json({ error: 'Not your course' });
      if (!course.targetCouncilIds.length) {
        return res.status(400).json({ error: 'This course has no target councils set.' });
      }

      // Reset/recreate council review rows (councils will re-approve and assign points).
      await db.councilCourseReview.updateMany({
        where: { courseId: course.id, councilId: { in: course.targetCouncilIds } },
        data: {
          status: 'PENDING_REVIEW',
          points: null,
          rejectionReason: null,
          reviewedAt: null,
          reviewedByUserId: null,
        },
      });
      await db.councilCourseReview.createMany({
        skipDuplicates: true,
        data: course.targetCouncilIds.map((councilId) => ({
          courseId: course.id,
          councilId,
          status: 'PENDING_REVIEW',
        })),
      });

      await db.course.update({
        where: { id: course.id },
        data: { status: 'UNDER_REVIEW' },
      });

      await db.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'CREATOR_RESUBMITTED_TO_COUNCIL',
          entityType: 'Course',
          entityId: course.id,
          meta: {
            targetCouncilIds: course.targetCouncilIds,
            previousStatus: course.status,
            newStatus: 'UNDER_REVIEW',
          },
        },
      });

      return res.json({ ok: true, councilTargets: course.targetCouncilIds.length });
    } catch {
      return res.status(500).json({ error: 'Could not resubmit course to councils' });
    }
  },
);

// POST /api/courses/:id/approve — PLATFORM_OWNER content-policy takedown only.
// Publishing a course is exclusively the target council's mandate (see
// ncz.ts POST /courses/:courseId/reviews/approve, which flips the course to
// PUBLISHED automatically once a targeted council approves it). Platform
// Owner can never fast-track a publish here — only reject/withdraw a
// submission for policy reasons (e.g. plagiarism, spam) before or instead of
// council review.
router.post('/:id/approve', requireAuth, requireRole('PLATFORM_OWNER'), async (req: AuthRequest, res) => {
  try {
    const { action, reason, reviewerNotes } = CourseApprovalSchema.parse(req.body);
    if (action === 'APPROVE') {
      return res.status(403).json({
        error: 'Publishing is the approving council\'s mandate. Platform Owner can only reject/withdraw a submission here.',
      });
    }
    const updated = await db.course.update({
      where: { id: req.params.id },
      data: { status: 'DRAFT', aiReviewNotes: reviewerNotes ?? undefined },
    });
    await db.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'PLATFORM_OWNER_COURSE_REJECTED',
        entityType: 'Course',
        entityId: req.params.id,
        meta: { action, reason, reviewerNotes, newStatus: 'DRAFT' },
      },
    });
    res.json({ course: updated, action, reason });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: 'Could not process approval' });
  }
});

// ─── Module CRUD ─────────────────────────────────────────────────────────────

// GET /api/courses/:id/modules — learner/mobile course player module payload
router.get('/:id/modules', async (req, res) => {
  try {
    const learner = await getRequestLearner(req);
    const role = await getRequestRole(req);
    const course = await db.course.findUnique({
      where: { id: req.params.id },
      select: { id: true, status: true },
    });
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (course.status !== 'PUBLISHED') {
      const isStaff = role === 'PLATFORM_OWNER' || role === 'CONTENT_MANAGER';
      if (!isStaff) return res.status(404).json({ error: 'Course not found' });
    }
    if (course.status === 'PUBLISHED' && learner) {
      const allowed = await assertLearnerCanAccessCourse(learner.id, course.id);
      if (!allowed) return res.status(403).json({ error: 'This course is not assigned to your council or professional title.' });
    }

    const modules = await db.module.findMany({
      where: { courseId: req.params.id },
      orderBy: { order: 'asc' },
      include: {
        sections: { orderBy: { order: 'asc' } },
        quizzes: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, title: true },
        },
      },
    });

    return res.json(
      modules.map((module) => ({
        id: module.id,
        title: module.title,
        order: module.order,
        sections: [
          ...module.sections.map((section) => ({
            id: section.id,
            title: section.title,
            type:
              section.type === 'READING'
                ? 'TEXT'
                : section.type === 'QUIZ'
                  ? 'QUIZ_LINK'
                  : section.type,
            content: section.mediaUrl || section.content,
            order: section.order,
          })),
          ...module.quizzes.map((quiz, index) => ({
            id: `quiz-link:${quiz.id}`,
            title: quiz.title,
            type: 'QUIZ_LINK',
            content: quiz.id,
            order: module.sections.length + index + 1,
          })),
        ].sort((a, b) => a.order - b.order),
      })),
    );
  } catch {
    return res.status(500).json({ error: 'Could not fetch course modules' });
  }
});

// POST /api/courses/:id/modules
router.post(
  '/:id/modules',
  requireAuth,
  requireRole('CONTENT_MANAGER', 'PLATFORM_OWNER'),
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
  requireRole('CONTENT_MANAGER', 'PLATFORM_OWNER'),
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
  requireRole('CONTENT_MANAGER', 'PLATFORM_OWNER'),
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
  requireRole('CONTENT_MANAGER', 'PLATFORM_OWNER'),
  upload.single('file'),
  async (req: AuthRequest, res) => {
    const { guidelineText, targetCadre, sourceUrl } = req.body as {
      guidelineText?: string;
      targetCadre?: string;
      sourceName?: string;
      sourceUrl?: string;
    };

    const owned = await getOwnedCourse(req.params.id, req);
    if (owned.error) return res.status(owned.error.status).json(owned.error.body);

    try {
      const resolved = await resolveGuidelineText({
        text: guidelineText,
        url: sourceUrl,
        fileBuffer: req.file?.buffer,
        fileName: req.file?.originalname,
        mimeType: req.file?.mimetype,
      });
      if (resolved.guidelineText.trim().length < 50) {
        return res.status(400).json({ error: 'Guideline text must be at least 50 characters after extraction' });
      }

      const provider = await getAIProvider().catch(() => null);
      const generated = await generateCourseFromGuideline(
        resolved.guidelineText,
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
          aiSourceName: (req.body as any)?.sourceName
            ? String((req.body as any).sourceName).slice(0, 200)
            : resolved.sourceLabel.slice(0, 200),
        },
      });

      await db.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'CREATOR_AI_GENERATED_COURSE_CONTENT',
          entityType: 'Course',
          entityId: req.params.id,
          meta: {
            targetCadre,
            provider: provider ?? 'auto',
            sourceName: (req.body as any)?.sourceName ?? resolved.sourceLabel,
            sourceType: resolved.sourceType,
            extractedCharacters: resolved.extractedCharacters,
            warnings: resolved.warnings,
          },
        },
      });

      res.status(201).json({
        message: `Generated ${result.length} module(s) with sections and quizzes`,
        moduleIds: result,
        sourceType: resolved.sourceType,
        extractedCharacters: resolved.extractedCharacters,
        warnings: resolved.warnings,
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
      res.status(400).json({ error: err?.message ?? 'Content generation failed' });
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
    const allowed = await assertLearnerCanAccessCourse(req.user!.id, course.id);
    if (!allowed) {
      return res.status(403).json({ error: 'This course is not assigned to your council or professional title.' });
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
