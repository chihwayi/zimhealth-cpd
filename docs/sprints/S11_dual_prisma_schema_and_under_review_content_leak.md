## Sprint S11 — Consolidate duplicate Prisma schema + prevent UNDER_REVIEW content leak

### Priority: MEDIUM
### Affects: Developer experience (dual schema) and security (learners can read unpublished course content).

---

## Bug A: Two Prisma schema files — one must be deleted

### The Problem

The repository has two Prisma schema files:
- `backend/prisma/schema.prisma` — the file used by `prisma migrate` and `prisma generate`
- `backend/src/db/schema.prisma` — appears to be a stale copy or an IDE artifact

Both are listed as modified in git. If they diverge, migrations run against the wrong
model and the generated Prisma client will be out of sync.

### Exact steps

#### Step 1 — Read both files

Read `backend/prisma/schema.prisma` and `backend/src/db/schema.prisma`.

Compare them. One of them will be identical to (or an older version of) the other.

#### Step 2 — Determine the canonical file

The canonical schema is `backend/prisma/schema.prisma`. This is the file that
`package.json`'s `prisma` script points to, and where migrations are generated.

#### Step 3 — Delete the duplicate

If `backend/src/db/schema.prisma` is identical to or older than
`backend/prisma/schema.prisma`, delete it:

```
backend/src/db/schema.prisma   ← DELETE THIS FILE
```

#### Step 4 — Check for imports

Search the entire codebase for any import or reference to `src/db/schema.prisma`.
If any file references it, update those references to point to the correct schema
location or remove the reference.

Run this search:
```
grep -r "src/db/schema" backend/src/
```

If no results, the file is safe to delete.

#### Step 5 — Verify

After deletion, run `npx prisma validate` from `backend/` to confirm the remaining
schema is valid and points to the correct datasource.

---

## Bug B: UNDER_REVIEW courses expose their full module/section structure to authenticated learners

### The Problem

`GET /api/courses/:id` includes full modules + sections in its response. The
eligibility check is only applied when `course.status === 'PUBLISHED' && learner`.
When a course is `UNDER_REVIEW`, an authenticated learner can fetch the full course
structure (all modules, sections, content) by hitting this endpoint directly.

While learners cannot enroll (the enroll endpoint checks `status !== 'PUBLISHED'`),
they can read the content without enrolling.

### Exact file to change

`backend/src/routes/courses.ts` — the `GET /:id` handler.

### Step-by-step fix

#### Step 1 — Find the eligibility check in the GET /:id handler

In `courses.ts`, find the route `router.get('/:id', ...)` (around line 118).

Inside the handler, after the `db.course.findUnique` call, find:

```ts
if (course.status === 'PUBLISHED' && learner) {
  const allowed = await assertLearnerCanAccessCourse(learner.id, course.id);
  if (!allowed) return res.status(403).json({ error: 'This course is not assigned to your council or professional title.' });
}
```

#### Step 2 — Also block learners from reading UNDER_REVIEW course content

Replace the existing condition with a broader check:

```ts
// Only ADMIN and CONTENT_MANAGER can read courses that are not PUBLISHED.
// Learners (and unauthenticated users) must only see PUBLISHED courses.
if (course.status !== 'PUBLISHED') {
  // Allow the request only if it is coming from a creator/admin.
  const isStaff = req.headers.authorization
    ? (() => {
        try {
          const header = req.headers.authorization;
          if (!header?.startsWith('Bearer ')) return false;
          const { verifyAccessToken } = require('../services/auth.service');
          const payload = verifyAccessToken(header.slice(7));
          return payload.role === 'ADMIN' || payload.role === 'CONTENT_MANAGER';
        } catch {
          return false;
        }
      })()
    : false;

  if (!isStaff) {
    return res.status(404).json({ error: 'Course not found' });
  }
}

// For published courses, verify that a learner's council has approved the course.
if (course.status === 'PUBLISHED' && learner) {
  const allowed = await assertLearnerCanAccessCourse(learner.id, course.id);
  if (!allowed) return res.status(403).json({ error: 'This course is not assigned to your council or professional title.' });
}
```

**Important implementation note:** Instead of the inline `require()` above (which is
messy), use the already-imported `verifyAccessToken` at the top of the file to check
the role. The function `getRequestLearner` at the top of `courses.ts` only returns
the user if their role is `LEARNER`. You need a parallel helper that checks for
staff roles. Here is the cleaner version:

Add a new helper function near the top of `courses.ts` (after `getRequestLearner`):

```ts
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
```

Then update the `GET /:id` handler to use this helper:

```ts
router.get('/:id', async (req, res) => {
  try {
    const learner = await getRequestLearner(req);
    const role = await getRequestRole(req);

    const course = await db.course.findUnique({
      where: { id: req.params.id },
      include: { ... }, // keep existing include unchanged
    });

    if (!course) return res.status(404).json({ error: 'Course not found' });

    // Non-published courses are only visible to staff (ADMIN / CONTENT_MANAGER).
    if (course.status !== 'PUBLISHED') {
      const isStaff = role === 'ADMIN' || role === 'CONTENT_MANAGER';
      if (!isStaff) {
        return res.status(404).json({ error: 'Course not found' });
      }
    }

    // For published courses, check council eligibility for learners.
    if (course.status === 'PUBLISHED' && learner) {
      const allowed = await assertLearnerCanAccessCourse(learner.id, course.id);
      if (!allowed) return res.status(403).json({ error: 'This course is not assigned to your council or professional title.' });
    }

    // ... rest of the handler (effectivePoints logic, etc.) unchanged
```

---

### Acceptance criteria

**Bug A:**
- Only one Prisma schema file exists: `backend/prisma/schema.prisma`.
- `npx prisma validate` runs without errors from the `backend/` directory.
- No source file in `backend/src/` imports from `src/db/schema.prisma`.

**Bug B:**
- An authenticated learner calling `GET /api/courses/:id` on a course with
  `status = 'UNDER_REVIEW'` receives HTTP 404.
- An authenticated `CONTENT_MANAGER` or `ADMIN` calling the same endpoint
  receives the full course object (modules, sections included) — their workflow
  is not broken.
- An authenticated learner calling `GET /api/courses/:id` on a `PUBLISHED` course
  that their council has approved receives the full course object as before.

---

### Do NOT change

- Do not change `GET /api/courses` (the list endpoint) — it already correctly
  uses `buildEligibleCourseWhere` which only returns published+approved courses.
- Do not change the enroll endpoint — it already blocks enrollment on non-published
  courses.
- Do not change any frontend files for this sprint.
