## Sprint S09 — Fix resubmit-council status regression + AI generate query key mismatch

### Priority: HIGH
### Affects: Content creation — two separate bugs bundled here because both are small backend + frontend fixes.

---

## Bug A: Resubmit does not reset `Course.status`

### The Problem

`POST /api/courses/:id/resubmit-council` resets the `CouncilCourseReview` rows back
to `PENDING_REVIEW`, but it never updates `Course.status`. This means:

- If the course was `PUBLISHED` (council approved it, admin published it) and the
  creator resubmits to a new or different council, the course stays `PUBLISHED`.
- Learners from the new council can potentially see/enroll in a course that the
  council hasn't approved yet, because the eligibility check looks at the
  `CouncilCourseReview` row for the learner's specific council.
- The creator UI shows "PUBLISHED" status even though the course is pending
  re-review.

### Exact file to change

`backend/src/routes/courses.ts` — the `POST /:id/resubmit-council` handler.

### Step-by-step fix

#### Step 1 — Find the resubmit handler

In `backend/src/routes/courses.ts`, find the route:

```ts
router.post(
  '/:id/resubmit-council',
  requireAuth,
  requireRole('CONTENT_MANAGER'),
  async (req: AuthRequest, res) => {
```

#### Step 2 — Add a course status update after the council review reset

After the `db.councilCourseReview.createMany(...)` call and before the
`db.auditLog.create(...)` call, add:

```ts
// Reset the course status to UNDER_REVIEW so it is not visible as
// PUBLISHED while awaiting council re-review.
await db.course.update({
  where: { id: course.id },
  data: { status: 'UNDER_REVIEW' },
});
```

The final order of DB operations in this handler should be:
1. `updateMany` — reset existing council review rows.
2. `createMany` — create missing rows.
3. `course.update` — set status to `UNDER_REVIEW`. ← ADD THIS
4. `auditLog.create` — log the action.

#### Step 3 — Update the audit log meta to record the status change

Change the `meta` field in `auditLog.create` to:

```ts
meta: {
  targetCouncilIds: course.targetCouncilIds,
  previousStatus: course.status,    // add this
  newStatus: 'UNDER_REVIEW',        // add this
},
```

Note: at the point the audit log runs, `course.status` still holds the value
loaded at the start of the handler (before the update), so it correctly reflects
the previous status.

---

## Bug B: AI Generate invalidates the wrong React Query cache key

### The Problem

After AI content generation succeeds, `CourseBuilder.tsx` invalidates the query key
`['course', id]`, but the Course Builder uses the query key `['course-builder', id]`
to load the course and its modules. The curriculum sidebar does not refresh — the
creator must reload the page to see generated modules.

### Exact file to change

`apps/web/src/pages/creator/CourseBuilder.tsx` — the `aiGenerateMutation` success handler.

### Step-by-step fix

#### Step 1 — Find the `aiGenerateMutation` definition

Search for `aiGenerateMutation` in `CourseBuilder.tsx`. Find the `onSuccess` callback
(around line 357):

```ts
onSuccess: (data) => {
  toast.success(`AI generated ${data.preview.moduleCount} module(s). Check the curriculum panel.`);
  setShowAiPanel(false);
  setAiGuidelineText('');
  setAiSourceUrl('');
  setAiFile(null);
  void queryClient.invalidateQueries({ queryKey: ['course', id] });   // ← WRONG KEY
  if (data.warnings?.length) {
    toast.info(data.warnings[0]);
  }
},
```

#### Step 2 — Fix the invalidation key

Replace:

```ts
void queryClient.invalidateQueries({ queryKey: ['course', id] });
```

With:

```ts
void queryClient.invalidateQueries({ queryKey: ['course-builder', id] });
```

---

### Acceptance criteria

**Bug A:**
- Creator resubmits a `PUBLISHED` course to a council.
- After the API call, `Course.status` in the DB is `UNDER_REVIEW`.
- The creator UI shows the course badge as "Under Review", not "Published".
- An `AuditLog` row exists with `action = 'CREATOR_RESUBMITTED_TO_COUNCIL'` and
  `meta.newStatus = 'UNDER_REVIEW'`.

**Bug B:**
- Creator uses "AI Generate" in the Course Builder.
- After generation completes, the curriculum sidebar refreshes automatically and
  shows the newly generated modules without a page reload.

---

### Do NOT change

- Do not change the `submit-review` endpoint — that one already correctly sets
  `Course.status = 'UNDER_REVIEW'`.
- Do not change anything else in the AI generation backend logic.
- Do not change `createModuleMutation` or any other query invalidation in
  `CourseBuilder.tsx`.
