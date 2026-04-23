# Sprint Index: S07–S13 — Bug fixes and system hardening

Generated: 2026-04-23
Review source: Critical review of content creation + learner completion flows.

---

## How to use this index

Each sprint is a standalone document. Assign them in order because S08 depends
on the backend being correct (which it already is), but S10 should be done before
S07 reaches production (so points are only awarded for genuinely completed courses).

After the agent completes each sprint, the reviewer (Ignatious) should verify
the acceptance criteria in that sprint's document before the agent moves to the next.

---

## Sprint order and dependencies

| Sprint | File | Priority | Depends on |
|--------|------|----------|------------|
| S07 | `S07_cpd_credit_on_course_completion.md` | 🔴 CRITICAL | None |
| S08 | `S08_docx_pptx_upload_saves_processed_pdf_url.md` | 🔴 CRITICAL | None |
| S09 | `S09_resubmit_status_and_ai_query_key.md` | 🟠 HIGH | None |
| S10 | `S10_progress_validation_server_side.md` | 🟠 HIGH | S07 (without S10, a fixed S07 could still be gamed) |
| S11 | `S11_dual_prisma_schema_and_under_review_content_leak.md` | 🟡 MEDIUM | None |
| S12 | `S12_docx_pptx_upload_filter_and_admin_publish_guard.md` | 🟡 MEDIUM | S08 |
| S13 | `S13_cleanup_dead_code_and_duplicate_endpoints.md` | 🟢 LOW | None |

---

## One-line summary of each sprint

- **S07** — Add `creditPoints()` call in `enrollments.ts` when `justCompleted = true`.
- **S08** — Poll for `processedCdnUrl` (PDF) after DOCX/PPTX upload instead of saving the raw office file URL.
- **S09** — Reset `Course.status` to `UNDER_REVIEW` on resubmit; fix AI generate React Query key.
- **S10** — Compute `totalSections` from the DB in progress handler; validate `sectionId` belongs to the course.
- **S11** — Delete `backend/src/db/schema.prisma` (duplicate); block learners from reading UNDER_REVIEW course structure.
- **S12** — Add DOCX/PPTX to the file picker accept filter; return a warning when admin publishes with no council approvals.
- **S13** — Remove `cpdPoints` from the creator form schema; consolidate `/api/points` and `/api/points/records` into one endpoint.

---

## Files touched across all sprints

### Backend
| File | Changed in |
|------|-----------|
| `backend/src/routes/enrollments.ts` | S07, S10 |
| `backend/src/routes/courses.ts` | S09, S11, S12 |
| `backend/src/routes/points.ts` | S13 |
| `backend/src/db/schema.prisma` | S11 (DELETE) |

### Frontend
| File | Changed in |
|------|-----------|
| `apps/web/src/pages/creator/CourseBuilder.tsx` | S08, S09, S12, S13 |

### No changes needed
- `backend/src/services/cpd-engine.ts` — duplicate prevention already works correctly.
- `backend/src/services/course-eligibility.ts` — eligibility logic is correct.
- `backend/src/routes/media.ts` — backend media handling is correct.
- `backend/src/jobs/mediaWorker.ts` — LibreOffice conversion pipeline is correct.
- `backend/src/middleware/upload.middleware.ts` — DOCX/PPTX already allowed.
- `apps/web/src/pages/learner/CoursePlayer.tsx` — learner player is correct.

---

## Verification checklist for the reviewer

After all sprints are implemented, run through this checklist manually or via tests:

### Content creation
- [ ] Creator creates a course, adds modules + sections, uploads a video → video processes and URL is saved.
- [ ] Creator uploads a DOCX or PPTX → polling runs, PDF URL is saved to the section, learner sees inline PDF.
- [ ] Creator selects DOCX/PPTX from the file picker (they are visible in the picker).
- [ ] Creator submits course for review → status becomes UNDER_REVIEW.
- [ ] Creator resubmits to a council → status resets to UNDER_REVIEW (not stuck at PUBLISHED).
- [ ] AI Generate button → modules appear in curriculum panel immediately without page reload.
- [ ] Learner cannot read module/section content of an UNDER_REVIEW course via direct API call.

### Council review
- [ ] Council officer sees PENDING_REVIEW courses in their queue.
- [ ] Council approves with points → learners from that council can now see the course.
- [ ] Admin publishes a course with no council approvals → response includes a warning message.

### Learner completion + CPD credit
- [ ] Learner marks all sections complete → `CPDRecord` row exists with correct `pointsEarned`.
- [ ] Learner's CPD summary shows the points after completion.
- [ ] Marking sections complete a second time does NOT create duplicate `CPDRecord`.
- [ ] Sending `totalSections: 1` from the client does NOT result in `progress = 1` for a multi-section course.
- [ ] Sending a random `sectionId` not in the course returns HTTP 400.

### Code quality
- [ ] Only one Prisma schema file exists: `backend/prisma/schema.prisma`.
- [ ] `CourseBuilder.tsx` form payload does not include `cpdPoints`.
- [ ] `GET /api/points` redirects to `GET /api/points/records`.
