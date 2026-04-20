# Sprint 05 — Course & Module API

**Phase:** 1 — Core Platform
**Duration:** 1 week
**Goal:** Full CRUD for courses, modules, content sections, and the publishing workflow. Creators manage their own courses; Admin can touch all.

---

## Tasks

### T05.1 — Course validation schemas

CREATE FILE: `backend/src/routes/courses.schema.ts`
```typescript
import { z } from 'zod';

export const CreateCourseSchema = z.object({
  title: z.string().min(3).max(100),
  subtitle: z.string().max(200).optional(),
  description: z.string().min(10),
  category: z.enum(['CLINICAL','MANAGEMENT','ETHICS','RESEARCH']),
  targetCadres: z.array(z.string()).min(1),
  specialtyArea: z.string().optional(),
  difficulty: z.enum(['FOUNDATION','INTERMEDIATE','ADVANCED']).default('FOUNDATION'),
  language: z.enum(['ENGLISH','SHONA','NDEBELE']).default('ENGLISH'),
  cpdPoints: z.number().int().min(1).max(50),
  estimatedMinutes: z.number().int().min(5),
  accreditationBody: z.string().optional(),
  tags: z.array(z.string()).default([]),
  expiresAt: z.string().datetime().optional(),
  priceOverride: z.number().positive().optional(),
});

export const UpdateCourseSchema = CreateCourseSchema.partial();

export const CreateModuleSchema = z.object({
  title: z.string().min(2).max(200),
  order: z.number().int().min(1),
  isOfflineReady: z.boolean().default(false),
});

export const CreateSectionSchema = z.object({
  type: z.enum(['VIDEO','READING','AUDIO','INTERACTIVE','QUIZ']),
  title: z.string().min(2),
  order: z.number().int().min(1),
  content: z.string().default(''),
  mediaUrl: z.string().url().optional(),
  completionThreshold: z.number().min(0).max(1).default(0.8),
});
```

---

### T05.2 — Course routes

CREATE FILE: `backend/src/routes/courses.ts`
```typescript
import { Router } from 'express';
import { db } from '../lib/db';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { CreateCourseSchema, UpdateCourseSchema, CreateModuleSchema, CreateSectionSchema } from './courses.schema';
import type { AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// ─── Course CRUD ─────────────────────────────────────────────────────────────

// GET /api/courses — public browsing (published courses only, with filters)
router.get('/', async (req, res) => {
  try {
    const { category, difficulty, cadre, search, page = '1', limit = '12' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = { status: 'PUBLISHED' };
    if (category) where.category = category;
    if (difficulty) where.difficulty = difficulty;
    if (cadre) where.targetCadres = { has: cadre };
    if (search) where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { tags: { has: search.toLowerCase() } },
    ];

    const [courses, total] = await Promise.all([
      db.course.findMany({
        where, skip, take: parseInt(limit),
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
        modules: { orderBy: { order: 'asc' }, include: { sections: { orderBy: { order: 'asc' } }, quizzes: true } },
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

// PATCH /api/courses/:id
router.patch('/:id', requireAuth, requireRole('CONTENT_MANAGER', 'ADMIN'), async (req: AuthRequest, res) => {
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
});

// POST /api/courses/:id/submit-review — Creator submits for admin review
router.post('/:id/submit-review', requireAuth, requireRole('CONTENT_MANAGER'), async (req: AuthRequest, res) => {
  try {
    const course = await db.course.findUnique({ where: { id: req.params.id } });
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (course.creatorId !== req.user!.id) return res.status(403).json({ error: 'Not your course' });
    if (course.status !== 'DRAFT') return res.status(400).json({ error: 'Course must be in DRAFT status to submit for review' });

    const updated = await db.course.update({
      where: { id: req.params.id },
      data: { status: 'UNDER_REVIEW' },
    });
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Could not submit course for review' });
  }
});

// POST /api/courses/:id/approve — Admin approves or rejects
router.post('/:id/approve', requireAuth, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { action, reason } = req.body as { action: 'APPROVE' | 'REJECT'; reason?: string };
    const newStatus = action === 'APPROVE' ? 'PUBLISHED' : 'DRAFT';
    const updated = await db.course.update({
      where: { id: req.params.id },
      data: { status: newStatus },
    });
    // TODO S22: send notification to creator
    res.json({ course: updated, action, reason });
  } catch {
    res.status(500).json({ error: 'Could not process approval' });
  }
});

// ─── Module CRUD ──────────────────────────────────────────────────────────────

// POST /api/courses/:id/modules
router.post('/:id/modules', requireAuth, requireRole('CONTENT_MANAGER', 'ADMIN'), async (req: AuthRequest, res) => {
  try {
    const data = CreateModuleSchema.parse(req.body);
    const module = await db.module.create({ data: { ...data, courseId: req.params.id } });
    res.status(201).json(module);
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: 'Could not create module' });
  }
});

// POST /api/courses/:courseId/modules/:moduleId/sections
router.post('/:courseId/modules/:moduleId/sections', requireAuth, requireRole('CONTENT_MANAGER', 'ADMIN'), async (req: AuthRequest, res) => {
  try {
    const data = CreateSectionSchema.parse(req.body);
    const section = await db.contentSection.create({ data: { ...data, moduleId: req.params.moduleId } });
    res.status(201).json(section);
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: 'Could not create section' });
  }
});

// POST /api/courses/:id/enroll — Learner enrolls
router.post('/:id/enroll', requireAuth, requireRole('LEARNER'), async (req: AuthRequest, res) => {
  try {
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
```

---

### T05.3 — Wire courses router into app.ts

EDIT FILE: `backend/src/app.ts`
Add:
```typescript
import coursesRouter from './routes/courses';
// ...
app.use('/api/courses', coursesRouter);
```

---

## Validation Checklist

- [ ] `GET /api/courses` returns only PUBLISHED courses
- [ ] `POST /api/courses` (as CONTENT_MANAGER) creates course in DRAFT status
- [ ] `POST /api/courses/:id/submit-review` moves status to UNDER_REVIEW
- [ ] `POST /api/courses/:id/approve` (ADMIN) moves to PUBLISHED
- [ ] Creator cannot edit another creator's course — 403
- [ ] Learner can enroll in a published course
- [ ] Module and section creation work correctly

**Sign-off:** Claude Code verifies all 7 checklist items before S06 begins.
