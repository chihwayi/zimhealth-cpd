## Sprint S07 — CPD points must be credited when a learner completes a course

### Priority: CRITICAL
### Affects: Learner flow — course completion awards no CPD points at all.

---

### The Problem

When a learner marks all sections complete, `Enrollment.completedAt` is set in
`PATCH /api/enrollments/:id/progress`, but `creditPoints()` is **never called**.
The learner sees "+X CPD points earned" on the completion screen but no `CPDRecord`
row is ever written. The CPD engine exists and is correct — it is simply never
triggered from the enrollment flow.

---

### Exact files to change

1. `backend/src/routes/enrollments.ts`
2. `backend/src/routes/enrollments.schema.ts` (read first to understand the schema)

---

### Step-by-step implementation

#### Step 1 — Add the import at the top of `enrollments.ts`

At the top of `backend/src/routes/enrollments.ts`, after the existing imports, add:

```ts
import { creditPoints } from '../services/cpd-engine';
```

#### Step 2 — Trigger `creditPoints` when a course is just completed

Inside the `PATCH /:id/progress` handler, immediately after the `db.enrollment.update()`
call that writes `completedAt`, add this block **before** the `res.json(...)` call:

```ts
// Award CPD points exactly once when the enrollment transitions to completed.
if (justCompleted) {
  try {
    const enrollmentWithCourse = await db.enrollment.findUnique({
      where: { id: req.params.id },
      select: { courseId: true },
    });
    if (enrollmentWithCourse?.courseId) {
      await creditPoints({
        learnerId: req.user!.id,
        courseId: enrollmentWithCourse.courseId,
        activityType: 'VIDEO_WATCH', // represents full course completion
      });
    }
  } catch (creditErr) {
    // Log but do not fail the progress update — points can be corrected manually.
    console.error('CPD credit failed after course completion', creditErr);
  }
}
```

#### Step 3 — Verify duplicate prevention already works

Open `backend/src/services/cpd-engine.ts` and confirm the block around line 86:

```ts
} else if (courseId) {
  const existing = await db.cPDRecord.findFirst({
    where: { learnerId, courseId, activityType, cycleYear },
  });
  if (existing) {
    // returns early — no duplicate record created
    return { recordId: existing.id, pointsEarned: 0 };
  }
}
```

This already prevents a second record if the learner somehow triggers completion
twice. No change needed here.

---

### Acceptance criteria

- After a learner marks the last section complete in the course player, a `CPDRecord`
  row exists in the database with `activityType = 'VIDEO_WATCH'` and `pointsEarned`
  matching the council-assigned points (or `cpdPoints` fallback).
- Calling the endpoint a second time (e.g., refreshing progress) does NOT create a
  second `CPDRecord` for the same course + learner + year.
- The `/api/points/summary` response shows the correct total after completion.
- If `creditPoints` throws (e.g., DB error), the progress update still succeeds and
  returns 200 — the error is only logged.

---

### Do NOT change

- Do not change the CPD engine (`cpd-engine.ts`) logic.
- Do not change the frontend (`CoursePlayer.tsx`) — it already calls the progress
  endpoint correctly.
- Do not change the quiz pass CPD credit path in `quizzes.ts`.
