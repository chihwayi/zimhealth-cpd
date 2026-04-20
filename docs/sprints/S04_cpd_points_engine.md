# Sprint 04 — CPD Points Engine

**Phase:** 1 — Core Platform
**Duration:** 1 week
**Goal:** Build the authoritative CPD points calculation and crediting system. This is the core business logic of the platform — it must be correct, testable, and auditable.

---

## Inputs
- [ ] S03 complete — auth working
- [ ] CPDRecord, AuditLog, Certificate models in Prisma

---

## Tasks

### T04.1 — CPD rules configuration

CREATE FILE: `backend/src/services/cpd-rules.ts`
```typescript
import type { Cadre } from '@prisma/client';

// Points required per annual cycle by cadre
export const REQUIRED_POINTS: Record<string, number> = {
  NURSE: 12,
  MIDWIFE: 12,
  PHARMACIST: 15,
  CLINICAL_OFFICER: 12,
  LAB_TECH: 10,
  DEFAULT: 12,
};

// Points awarded per activity type (defaults — Admin can override via platform config)
export const ACTIVITY_POINTS: Record<string, number> = {
  VIDEO_WATCH: 1,
  QUIZ_PASS: 3,     // per course completion
  READING: 1,
  WEBINAR: 2,
  WHATSAPP_QUIZ: 1,
};

export function getRequiredPoints(cadre?: string | null): number {
  if (!cadre) return REQUIRED_POINTS.DEFAULT;
  return REQUIRED_POINTS[cadre] ?? REQUIRED_POINTS.DEFAULT;
}

export function getCurrentCycleYear(): number {
  return new Date().getFullYear();
}
```

---

### T04.2 — CPD Engine service

CREATE FILE: `backend/src/services/cpd-engine.ts`
```typescript
import type { ActivityType } from '@prisma/client';
import { db } from '../lib/db';
import { getRequiredPoints, getCurrentCycleYear } from './cpd-rules';
import { logger } from '../lib/logger';

export interface CreditPointsInput {
  learnerId: string;
  courseId?: string;
  activityType: ActivityType;
  quizScore?: number;
  pointsOverride?: number;  // Admin manual override
  overrideNote?: string;
  isManualOverride?: boolean;
}

export interface CPDSummary {
  learnerId: string;
  cycleYear: number;
  totalPoints: number;
  requiredPoints: number;
  percentComplete: number;
  recordCount: number;
}

/**
 * Credit CPD points to a learner after activity completion.
 * This is the ONLY function that should write CPD records.
 * All calls are logged for audit purposes.
 */
export async function creditPoints(input: CreditPointsInput): Promise<{ recordId: string; pointsEarned: number }> {
  const { learnerId, courseId, activityType, quizScore, pointsOverride, overrideNote, isManualOverride } = input;

  // Determine points to award
  let pointsEarned: number;
  if (typeof pointsOverride === 'number') {
    pointsEarned = pointsOverride;
  } else if (courseId) {
    const course = await db.course.findUnique({ where: { id: courseId }, select: { cpdPoints: true } });
    pointsEarned = course?.cpdPoints ?? 0;
  } else {
    const { ACTIVITY_POINTS } = await import('./cpd-rules');
    pointsEarned = ACTIVITY_POINTS[activityType] ?? 1;
  }

  const cycleYear = getCurrentCycleYear();

  // Check for duplicate: same learner + course + activityType in same cycle year
  if (courseId) {
    const existing = await db.cPDRecord.findFirst({
      where: { learnerId, courseId, activityType, cycleYear },
    });
    if (existing && !isManualOverride) {
      logger.warn('Duplicate CPD credit prevented', { learnerId, courseId, activityType });
      return { recordId: existing.id, pointsEarned: 0 };
    }
  }

  const record = await db.cPDRecord.create({
    data: {
      learnerId,
      courseId,
      activityType,
      pointsEarned,
      quizScore,
      cycleYear,
      isManualOverride: isManualOverride ?? false,
      overrideNote,
    },
  });

  // Audit log
  await db.auditLog.create({
    data: {
      userId: learnerId,
      action: isManualOverride ? 'CPD_POINTS_MANUAL_OVERRIDE' : 'CPD_POINTS_CREDITED',
      entityType: 'CPDRecord',
      entityId: record.id,
      meta: { pointsEarned, activityType, courseId, quizScore, overrideNote },
    },
  });

  logger.info('CPD points credited', { learnerId, pointsEarned, activityType, cycleYear });
  return { recordId: record.id, pointsEarned };
}

/**
 * Get CPD summary for a learner in the current (or specified) cycle year.
 */
export async function getLearnerCPDSummary(learnerId: string, cycleYear?: number): Promise<CPDSummary> {
  const year = cycleYear ?? getCurrentCycleYear();

  const learner = await db.user.findUnique({
    where: { id: learnerId },
    select: { cadre: true },
  });

  const records = await db.cPDRecord.findMany({
    where: { learnerId, cycleYear: year },
  });

  const totalPoints = records.reduce((sum, r) => sum + r.pointsEarned, 0);
  const requiredPoints = getRequiredPoints(learner?.cadre);
  const percentComplete = Math.min(100, Math.round((totalPoints / requiredPoints) * 100));

  return {
    learnerId,
    cycleYear: year,
    totalPoints,
    requiredPoints,
    percentComplete,
    recordCount: records.length,
  };
}

/**
 * Check if a learner has already earned points for a specific course/activity
 */
export async function hasEarnedPoints(learnerId: string, courseId: string, activityType: ActivityType): Promise<boolean> {
  const record = await db.cPDRecord.findFirst({
    where: { learnerId, courseId, activityType, cycleYear: getCurrentCycleYear() },
  });
  return !!record;
}
```

---

### T04.3 — CPD API routes

CREATE FILE: `backend/src/routes/points.ts`
```typescript
import { Router } from 'express';
import { db } from '../lib/db';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { getLearnerCPDSummary, creditPoints } from '../services/cpd-engine';
import { z } from 'zod';
import type { AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// GET /api/points/summary  — learner's own summary
router.get('/summary', requireAuth, async (req: AuthRequest, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const summary = await getLearnerCPDSummary(req.user!.id, year);
    res.json(summary);
  } catch {
    res.status(500).json({ error: 'Could not fetch CPD summary' });
  }
});

// GET /api/points/records  — learner's own records
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

// POST /api/points/override  — Admin only
const OverrideSchema = z.object({
  learnerId: z.string(),
  courseId: z.string().optional(),
  activityType: z.enum(['VIDEO_WATCH','QUIZ_PASS','READING','WEBINAR','WHATSAPP_QUIZ']),
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

// GET /api/points/learner/:id  — Admin or NCZ Officer
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
```

---

### T04.4 — Wire points routes into app.ts

EDIT FILE: `backend/src/app.ts`
Add after the auth router import:
```typescript
import pointsRouter from './routes/points';
```
And after `app.use('/api/auth', authRouter);`:
```typescript
app.use('/api/points', pointsRouter);
```

---

### T04.5 — CPD Engine unit tests

CREATE FILE: `backend/src/services/cpd-engine.test.ts`
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { creditPoints, getLearnerCPDSummary, hasEarnedPoints } from './cpd-engine';
import { db } from '../lib/db';

// Uses the seeded Grace learner
const GRACE_EMAIL = 'grace@nursepro.co.zw';
let graceId: string;

beforeAll(async () => {
  const grace = await db.user.findUnique({ where: { email: GRACE_EMAIL } });
  graceId = grace!.id;
});

describe('CPD Engine', () => {
  it('credits points for a WhatsApp quiz', async () => {
    const result = await creditPoints({
      learnerId: graceId,
      activityType: 'WHATSAPP_QUIZ',
    });
    expect(result.pointsEarned).toBeGreaterThan(0);
  });

  it('returns accurate CPD summary', async () => {
    const summary = await getLearnerCPDSummary(graceId, 2026);
    expect(summary.totalPoints).toBeGreaterThan(0);
    expect(summary.requiredPoints).toBe(12); // NURSE = 12
    expect(summary.percentComplete).toBeGreaterThanOrEqual(0);
  });

  it('prevents duplicate course point crediting', async () => {
    const COURSE_ID = 'course-seed-001';
    // Credit once
    await creditPoints({ learnerId: graceId, courseId: COURSE_ID, activityType: 'QUIZ_PASS' });
    // Attempt duplicate — should return 0 new points
    const result = await creditPoints({ learnerId: graceId, courseId: COURSE_ID, activityType: 'QUIZ_PASS' });
    expect(result.pointsEarned).toBe(0);
  });

  it('detects earned points correctly', async () => {
    const earned = await hasEarnedPoints(graceId, 'course-seed-001', 'QUIZ_PASS');
    expect(earned).toBe(true);
  });
});
```

---

## Validation Checklist

- [ ] `GET /api/points/summary` returns correct totals for seeded learner
- [ ] `creditPoints()` creates a CPD record AND an audit log entry
- [ ] Duplicate crediting for same course+activity in same year returns `pointsEarned: 0`
- [ ] Admin override creates record with `isManualOverride: true` and `overrideNote`
- [ ] NCZ Officer can read `/api/points/learner/:id`
- [ ] Learner cannot access another learner's points
- [ ] All CPD engine unit tests pass

**Sign-off:** Claude Code validates test results and business logic correctness.
