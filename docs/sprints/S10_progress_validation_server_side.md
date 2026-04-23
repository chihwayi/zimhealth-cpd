## Sprint S10 — Server-side validation of totalSections to prevent progress manipulation

### Priority: HIGH
### Affects: Security — learners can send a manipulated `totalSections` value to instantly complete any course and potentially earn CPD points without doing the work.

---

### The Problem

`PATCH /api/enrollments/:id/progress` accepts `totalSections` from the client and
uses it directly to calculate progress:

```ts
// Current vulnerable code in enrollments.ts
if (data.sectionId) {
  if (!newCompletedSections.includes(data.sectionId)) {
    newCompletedSections = [...newCompletedSections, data.sectionId];
  }
  if (data.totalSections && data.totalSections > 0) {
    newProgress = newCompletedSections.length / data.totalSections;  // ← trusts client
  }
}
```

A malicious learner could send `totalSections: 1` regardless of how many sections
the course actually has, causing `newProgress = 1` after just one section mark,
which triggers `justCompleted = true` and (after S07 is implemented) awards CPD
points for a course they never actually completed.

### Fix: compute `totalSections` from the database, not from the request body

---

### Exact files to change

1. `backend/src/routes/enrollments.ts`
2. `backend/src/routes/enrollments.schema.ts`

---

### Step-by-step implementation

#### Step 1 — Read `enrollments.schema.ts` to understand `UpdateProgressSchema`

Open `backend/src/routes/enrollments.schema.ts`.

Find `UpdateProgressSchema`. It currently has a `totalSections` field. We will keep
this field in the schema for backwards compatibility (the frontend still sends it)
but we will IGNORE the client value and compute the real count from the DB instead.

Do NOT remove `totalSections` from the schema — this would break existing clients.
Simply stop using the client-supplied value for calculations.

#### Step 2 — In the progress handler, load the real section count from the DB

In `backend/src/routes/enrollments.ts`, inside the `PATCH /:id/progress` handler,
**after** the enrollment lookup (`db.enrollment.findUnique`), add a DB query to get
the real section count:

```ts
// Look up the real section count from the DB — never trust the client value.
const courseModules = await db.module.findMany({
  where: { courseId: enrollment.courseId },
  select: { _count: { select: { sections: true } } },
});
const realTotalSections = courseModules.reduce(
  (sum, m) => sum + m._count.sections,
  0,
);
```

#### Step 3 — Replace `data.totalSections` with `realTotalSections` in the progress calculation

Find this block (around line 131):

```ts
if (data.sectionId) {
  if (!newCompletedSections.includes(data.sectionId)) {
    newCompletedSections = [...newCompletedSections, data.sectionId];
  }
  if (data.totalSections && data.totalSections > 0) {
    newProgress = newCompletedSections.length / data.totalSections;
  }
}
```

Replace it with:

```ts
if (data.sectionId) {
  if (!newCompletedSections.includes(data.sectionId)) {
    newCompletedSections = [...newCompletedSections, data.sectionId];
  }
  if (realTotalSections > 0) {
    newProgress = newCompletedSections.length / realTotalSections;
  }
}
```

#### Step 4 — Guard against invalid sectionId

Also add a check that the submitted `sectionId` actually belongs to the course,
to prevent marking arbitrary section IDs as complete. Add this immediately after
the enrollment lookup:

```ts
if (data.sectionId) {
  const sectionExists = await db.contentSection.findFirst({
    where: {
      id: data.sectionId,
      module: { courseId: enrollment.courseId },
    },
    select: { id: true },
  });
  if (!sectionExists) {
    return res.status(400).json({ error: 'Section does not belong to this course.' });
  }
}
```

---

### Acceptance criteria

- Sending `{ sectionId: 'any-valid-section-id', totalSections: 1 }` does NOT
  cause `progress = 1` if the course has more than one section.
- Progress is computed as `completedSections.length / realTotalSections` where
  `realTotalSections` comes from the DB.
- Sending a `sectionId` that does not belong to the enrolled course returns HTTP 400.
- Normal learner flow still works: marking sections complete one by one eventually
  causes `progress = 1` and `completedAt` to be set correctly.

---

### Do NOT change

- Do not change the frontend `CoursePlayer.tsx` — it still sends `totalSections`,
  which is now harmlessly ignored on the server.
- Do not remove `totalSections` from `UpdateProgressSchema` — this would be a
  breaking change to the API contract.
- Do not change any other endpoints in `enrollments.ts`.
