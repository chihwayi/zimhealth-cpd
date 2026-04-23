## Sprint S12 — Allow DOCX/PPTX in section upload UI + warn admin when publishing without council approval

### Priority: MEDIUM
### Affects: Content creation UX (upload filter) and admin workflow (publish guard).

---

## Bug A: DOCX/PPTX files cannot be selected in the Course Builder section media upload

### The Problem

In `CourseBuilder.tsx`, the `mediaUploadAccept` function determines which file types
the browser file picker accepts. For READING and INTERACTIVE sections it returns:

```ts
'video/*,audio/*,application/pdf,.pdf,.zip,.html'
```

DOCX and PPTX MIME types are not included, so the OS file picker does not show
those files as selectable — even though the backend accepts and converts them.

### Exact file to change

`apps/web/src/pages/creator/CourseBuilder.tsx`

### Step-by-step fix

#### Step 1 — Find `mediaUploadAccept`

Search for the function `mediaUploadAccept` in `CourseBuilder.tsx` (around line 154):

```ts
function mediaUploadAccept(sectionType: ContentType): string {
  if (sectionType === ContentType.VIDEO) return 'video/*';
  if (sectionType === ContentType.AUDIO) return 'audio/*';
  return 'video/*,audio/*,application/pdf,.pdf,.zip,.html';
}
```

#### Step 2 — Add DOCX and PPTX MIME types for non-video/audio sections

Replace the function with:

```ts
function mediaUploadAccept(sectionType: ContentType): string {
  if (sectionType === ContentType.VIDEO) return 'video/*';
  if (sectionType === ContentType.AUDIO) return 'audio/*';
  return [
    'application/pdf',
    '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.docx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.pptx',
    'application/zip',
    '.zip',
    'text/html',
    '.html',
  ].join(',');
}
```

Note: `video/*` and `audio/*` are intentionally removed from the default (non-video)
case — a READING section should not be offering video file selection.

---

## Bug B: Admin can publish a course that no learner can ever access

### The Problem

`POST /api/courses/:id/approve` with `action: 'APPROVE'` sets `Course.status =
'PUBLISHED'` without checking if any councils have approved the course. If an admin
publishes a course that has 0 `CouncilCourseReview` rows with `status = 'APPROVED'`
and `points != null`, then no learner from any council can see or enroll in that
course. The admin has effectively published a course into a black hole.

The fix is NOT to block the admin from publishing — admins have full authority.
The fix is to add a warning in the API response if the course has no approved
council reviews, so the admin's frontend can surface it.

### Exact file to change

`backend/src/routes/courses.ts` — the `POST /:id/approve` handler.

### Step-by-step fix

#### Step 1 — Find the approve handler

In `courses.ts`, find:

```ts
router.post('/:id/approve', requireAuth, requireRole('ADMIN'), async (req: AuthRequest, res) => {
```

#### Step 2 — After updating the course status, check for approved council reviews

The current handler (simplified) does:
1. Parse body with `CourseApprovalSchema`.
2. `db.course.update(...)` to set status to PUBLISHED or DRAFT.
3. `db.auditLog.create(...)`.
4. `res.json({ course: updated, action, reason })`.

After the `db.course.update(...)` call and before `res.json(...)`, add:

```ts
// Check if the course has at least one approved council review with points.
// If not, include a warning in the response — no learner will be able to see
// this course until a council approves it.
let publishWarning: string | null = null;
if (action === 'APPROVE') {
  const approvedReviewCount = await db.councilCourseReview.count({
    where: {
      courseId: req.params.id,
      status: 'APPROVED',
      points: { not: null },
    },
  });
  if (approvedReviewCount === 0) {
    publishWarning =
      'Course published, but no council has approved it yet. ' +
      'Learners will not see this course until at least one council approves it and assigns CPD points.';
  }
}
```

#### Step 3 — Include the warning in the response

Change the final `res.json(...)` from:

```ts
res.json({ course: updated, action, reason });
```

To:

```ts
res.json({ course: updated, action, reason, warning: publishWarning ?? undefined });
```

#### Step 4 — Surface the warning in the admin frontend (if it exists)

Search the frontend codebase for wherever the admin calls the approve endpoint.
Find any `api.post('/api/courses/:id/approve', ...)` or similar mutation.

In the `onSuccess` handler of that mutation, check if `response.warning` is present
and if so, call `toast.warning(response.warning)` or equivalent.

If no admin course approve UI exists in the frontend yet, skip this step — the
backend warning is enough for now.

---

### Acceptance criteria

**Bug A:**
- Creator opens the section editor for a READING or INTERACTIVE section.
- Clicks "Upload file" — the OS file picker shows `.docx` and `.pptx` files as
  selectable options (not greyed out).
- Selecting a `.docx` triggers the upload + polling flow from S08.

**Bug B:**
- Admin publishes a course that has `CouncilCourseReview` rows all in `PENDING_REVIEW`
  or `REJECTED` state.
- The API response includes `{ ..., warning: "Course published, but no council has approved it yet..." }`.
- Admin publishes a course that already has at least one `APPROVED` review with points.
- The API response does NOT include a `warning` field (or it is `undefined`).
- In both cases, `Course.status` is correctly set to `PUBLISHED`.

---

### Do NOT change

- Do not block the admin from publishing — only add a warning.
- Do not change the learner eligibility logic — it already correctly gates on council
  approval regardless of `Course.status`.
- Do not change the AUDIO section's accept filter — it correctly returns `'audio/*'`.
