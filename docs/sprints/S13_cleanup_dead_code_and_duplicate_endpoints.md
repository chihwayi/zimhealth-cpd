## Sprint S13 — Remove dead `cpdPoints` field from frontend schema + consolidate duplicate CPD record endpoints

### Priority: LOW
### Affects: Code quality, developer clarity, and API consistency.

---

## Cleanup A: Remove `cpdPoints` from the Course Builder form schema

### The Problem

`CourseBuilder.tsx` still includes `cpdPoints` in the Zod form schema and in
`DEFAULT_VALUES`, and sends it in every create/update payload to the backend.
The UI correctly replaced the input with informational text ("Councils assign CPD
points after review"), but the field is still being transmitted. This is dead code
that misleads future developers and wastes payload space.

The backend schema (`courses.schema.ts`) also allows `cpdPoints` to be set — this
should be preserved for backwards compatibility (admin/AI flows may set it), but the
creator frontend should not send it.

### Exact file to change

`apps/web/src/pages/creator/CourseBuilder.tsx`

### Step-by-step fix

#### Step 1 — Remove `cpdPoints` from the Zod schema

Find `courseSchema` (around line 37). Remove the line:

```ts
cpdPoints: z.number().int().min(0).max(50).default(0),
```

#### Step 2 — Remove from `DEFAULT_VALUES`

Find `DEFAULT_VALUES` (around line 113). Remove the line:

```ts
cpdPoints: 0,
```

#### Step 3 — Remove from the `useEffect` reset that loads the existing course

Find the `useEffect` that calls `reset({...})` when `course` loads (around line 213).
Remove the line:

```ts
cpdPoints: course.cpdPoints ?? 0,
```

#### Step 4 — Remove from `CourseResponse` type

Find the `CourseResponse` type (around line 82). If it extends `CourseFormData`,
removing `cpdPoints` from the schema handles it. If `CourseResponse` has an explicit
`cpdPoints` field, remove it from the type but keep it in the API response type if
the course card or course player reads it from the API response directly — check
usages carefully.

Search `CourseBuilder.tsx` for all occurrences of `cpdPoints`:

```
grep -n "cpdPoints" apps/web/src/pages/creator/CourseBuilder.tsx
```

Remove each occurrence that is in the form schema, defaults, or form submission
payload. Do NOT remove `cpdPoints` from type definitions that describe what the
API returns (the API still returns it).

#### Step 5 — Verify TypeScript compiles cleanly

Run `tsc --noEmit` in `apps/web/` to confirm no type errors.

---

## Cleanup B: Consolidate duplicate CPD record endpoints

### The Problem

`backend/src/routes/points.ts` has two endpoints that both return CPD records for
the authenticated learner:

- `GET /api/points` (line ~23) — returns records, optionally filtered by year
- `GET /api/points/records` (line ~81) — returns records for the current year by default

Both endpoints include the same `effectivePoints` council lookup logic. Having two
endpoints means future changes must be applied in two places. The frontend should
use a single endpoint.

### Exact files to change

1. `backend/src/routes/points.ts`
2. Search frontend files that call either `/api/points` or `/api/points/records`

### Step-by-step fix

#### Step 1 — Identify which endpoint the frontend uses

Search the frontend for all API calls to these endpoints:

```
grep -rn "api/points" apps/web/src/
```

Note which pages call `/api/points` vs `/api/points/records`.

#### Step 2 — Decide on the canonical endpoint

Keep `GET /api/points/records` as the canonical endpoint because:
- It defaults to the current year (more useful).
- The path is more explicit.
- Update it to also support `?year=` and `?limit=` query params (matching `/api/points`
  which already supports them).

#### Step 3 — Update `GET /api/points/records` to be the full-featured endpoint

In `points.ts`, update the `GET /api/points/records` handler to accept the same
query parameters as `GET /api/points`:

```ts
router.get('/records', requireAuth, async (req: AuthRequest, res) => {
  try {
    const learner = await db.user.findUnique({ where: { id: req.user!.id }, select: { councilId: true } });
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 100);
    const yearRaw = req.query.year;
    const where: { learnerId: string; cycleYear?: number } = { learnerId: req.user!.id };
    if (yearRaw !== undefined && yearRaw !== '') {
      const y = parseInt(String(yearRaw), 10);
      if (!Number.isNaN(y)) where.cycleYear = y;
    } else {
      // Default to current year when no year filter supplied
      where.cycleYear = new Date().getFullYear();
    }

    const records = await db.cPDRecord.findMany({
      where,
      orderBy: { completedAt: 'desc' },
      take: limit,
      include: { course: { select: { id: true, title: true, category: true, cpdPoints: true } } },
    });

    const courseIds = records.map((r) => r.course?.id).filter(Boolean) as string[];
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

    const withEffective = records.map((r: any) => {
      const effectivePoints =
        r.course?.id && pointsByCourseId[r.course.id] != null
          ? pointsByCourseId[r.course.id]
          : (r.course?.cpdPoints ?? null);
      return {
        ...r,
        course: r.course ? { title: r.course.title, category: r.course.category, effectivePoints } : null,
      };
    });

    res.json(withEffective);
  } catch {
    res.status(500).json({ error: 'Could not fetch CPD records' });
  }
});
```

#### Step 4 — Deprecate `GET /api/points` (the root endpoint)

Replace the body of the `GET /api/points` handler with a redirect to `/api/points/records`
to maintain backwards compatibility without running duplicate logic:

```ts
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  // Deprecated: use GET /api/points/records instead.
  // Redirect with the same query string.
  const qs = new URLSearchParams(req.query as Record<string, string>).toString();
  return res.redirect(307, `/api/points/records${qs ? `?${qs}` : ''}`);
});
```

Note: a 307 Temporary Redirect preserves the GET method. The client will follow it
automatically. If any frontend code is using `api.get('/api/points')`, update it
to use `api.get('/api/points/records')` so it doesn't rely on the redirect.

#### Step 5 — Update frontend callers

For each frontend file found in Step 1 that calls `/api/points` (the root), change
the call to `/api/points/records`. If any call was using `/api/points/records`
already, leave it unchanged.

---

### Acceptance criteria

**Cleanup A:**
- `CourseBuilder.tsx` form schema has no `cpdPoints` field.
- Submitting the create/update course form payload does not include `cpdPoints` in
  the request body.
- TypeScript compiles with no errors (`tsc --noEmit`).
- The course builder UI is visually unchanged — the "Councils assign CPD points"
  info box still appears where the input was.

**Cleanup B:**
- `GET /api/points/records` accepts `?year=` and `?limit=` query params and returns
  the same shaped data as the old `GET /api/points` endpoint.
- `GET /api/points` (the root) returns a 307 redirect to `/api/points/records` with
  the same query string, for backwards compatibility.
- No duplicate effectivePoints lookup logic exists in `points.ts`.
- All frontend pages that previously called `/api/points` now call `/api/points/records`.

---

### Do NOT change

- Do not change `GET /api/points/summary` — it returns aggregate totals, not records,
  and is a separate endpoint with a separate purpose.
- Do not change `GET /api/points/bot/:phone` or `POST /api/points/bot/credit`.
- Do not remove `cpdPoints` from the backend Prisma schema or from `UpdateCourseSchema`
  — those are needed for backwards compatibility and for the admin override flow.
