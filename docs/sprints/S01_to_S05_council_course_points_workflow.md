## Sprint S01 — Council-owned points data model

### Goal
Move CPD points ownership from creators/courses to councils, enabling council approval + point assignment before learner visibility.

### Delivered
- **DB model**: `CouncilCourseReview` with `status`, `points`, `rejectionReason`, `reviewedAt`, `reviewedByUserId`
- **Role support**: `COUNCIL_OFFICER` with `/api/ncz/*` kept as alias for `/api/council/*`
- **Seed**: multi-council seed data + sample approved reviews w/ points

### Acceptance criteria
- A course can have different points per council.
- Council decisions are auditable and tied to a reviewer.

---

## Sprint S02 — Creator submit flow (no creator-set points)

### Goal
Creators submit courses to councils for approval/points; creators do **not** set CPD points.

### Delivered
- Creator submit endpoint ensures `CouncilCourseReview` rows exist/reset to `PENDING_REVIEW`
- `Course.cpdPoints` defaults to `0` for backwards compatibility
- Creator UI: CPD points input removed; replaced with guidance (“council assigns points”)

### Acceptance criteria
- Course cannot be submitted without at least one target council.
- Resubmission resets prior rejection/points for targeted councils.

---

## Sprint S03 — Council portal review + points assignment

### Goal
Council officers approve/reject courses for their council and assign/update CPD points.

### Delivered
- APIs (scoped to officer’s council):
  - List reviews (pending/approved/rejected)
  - Approve + assign points
  - Reject with reason
  - Update points later
- Web council dashboard UI: “Course Reviews” queue + modal actions

### Acceptance criteria
- Council can see its “waiting for points” queue.
- Council can approve with points and later update points.
- Council can reject with a clear reason.

---

## Sprint S04 — Creator inbox (per-council decisions + resubmit)

### Goal
Creators can see per-council status and resubmit after rejection.

### Delivered
- `GET /api/creator/courses` now includes `councilReviews[]` summary
- Creator UI shows per-council decision chips (Pending/Approved/Rejected + points)
- “Resubmit” action resets targeted council review rows back to `PENDING_REVIEW`

### Acceptance criteria
- Creator can see which council rejected and resubmit to councils.

---

## Sprint S05 — Learner visibility + crediting uses council points

### Goal
Learners only see courses after their council approves + assigns points, and CPD credit uses council-assigned points.

### Delivered
- Eligibility requires `CouncilCourseReview(APPROVED, points != null)` for learner’s council
- `/api/courses` and `/api/courses/:id` include `effectivePoints` for learners
- CPD credit awards `CouncilCourseReview.points` (fallback to legacy)
- UI labels points as “Council CPD” with tooltip
- Consistency pass: enrollments + points history + council learner history include effective points

### Acceptance criteria
- Learner cannot access/enroll unless their council approved & assigned points.
- Points earned match the council-assigned points.

