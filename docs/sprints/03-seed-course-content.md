# Sprint 03 — Seed real course content

**Status: DONE (2026-09-13).** 15 new courses seeded (16 total, up from 1), covering all 12 specialty tracks with 2 modules + a 3-question quiz each, defined in `backend/prisma/seed-courses.ts` and invoked from `seed.ts`. Zimbabwe-only (targets NCZ + MDPCZ) per the pan-African pivot decision not to invent content for countries without a real council yet ([[project_pan_african_pivot]]-equivalent note). Verified idempotent (seed re-run twice, no duplicates/errors), every quiz question has exactly one correct option (automated sweep across all 16 quizzes), and the whole thing was run against **production** via `docker exec` into the live backend container (`npx ts-node prisma/seed.ts`) — no new migration needed since Sprint 02 already added the `specialtyTrack` column. Confirmed live: `publishedCourses: 16` via `/api/admin/stats`, filtering by track works for a real learner account, and a full enrollment on a new course succeeded end-to-end. Content quality note: generic WHO/ICN-level guidance only, no invented dosages/clinical thresholds, per the safety guidance in this file's original scope section.

**Track:** Content. **Priority:** P0. **Depends on:** Sprint 02 (specialty taxonomy must exist).

## Goal
Populate at least 2–3 real, complete courses per specialty track named in the proposal, so a live demo to NCZ shows an actual library instead of one seeded course.

## Why
`backend/prisma/seed.ts` currently seeds exactly one course. The proposal claims "an expansive, discipline-specific curriculum." Gap analysis §1, §3.

## Scope
For each `SpecialtyTrack` value from Sprint 02, add 2–3 courses to `backend/prisma/seed.ts` (or a new `backend/prisma/seed-courses/` directory imported by `seed.ts`, if the file is getting unwieldy — check current line count first with `wc -l backend/prisma/seed.ts`). Each course needs, following the existing seeded course as a template:
- `title`, `subtitle`, `description`, `category` (CPDCategory), `specialtyTrack`, `difficulty`, `estimatedMinutes`, `cpdPoints` (or council-specific points via `CouncilCourseReview` — check how the one existing course wires this and replicate exactly).
- At least 2 `Module`s each, with real `ContentSection` reading material (short, but genuine — not lorem ipsum) and a `Quiz` with 3-5 real multiple-choice questions with correct answers marked.
- `status: PUBLISHED` and a `CouncilCourseReview` row per relevant council (at minimum NCZ) with `status: APPROVED` so the courses are actually visible/enrollable.

Priority order if time-constrained: Midwifery, Mental Health Nursing, Operating Theatre Nursing, General Refresher first (highest nurse-count specialties in Zimbabwe); cross-cutting topics (Data Analytics, Health Informatics, Data Protection, Entrepreneurship, Nursing Research) second.

Content should be accurate at a "CPD refresher" level — pull from publicly available WHO/ICN nursing guidance summaries, not fabricated clinical claims. If an AI agent is generating this content, it must not invent dosages, drug names, or clinical thresholds without citing a real, checkable source; when uncertain, write generically ("follow your institution's protocol for...") rather than inventing specifics.

## Non-goals
- Do not build a content-authoring UI in this sprint — this is seed-data content, entered via Prisma seed script or admin UI manually, not a new feature.
- Do not attempt video content (`promoVideoUrl`) — text/quiz only for now.

## Acceptance criteria
- [ ] At least 12 specialty tracks × 2 courses = ~24+ published courses after `pnpm db:seed`.
- [ ] Every course has ≥2 modules and a working quiz.
- [ ] `GET /api/courses?specialtyTrack=X` returns non-empty results for every track.
- [ ] Web course browse page and WhatsApp bot course menu both show the new content.

## Verification
- `cd backend && pnpm db:seed` runs clean, no FK errors.
- Spot-check 3 courses end-to-end: enroll as the seeded demo learner, complete a module, take the quiz, confirm points post to `CPDRecord`.
- Run through the WhatsApp bot flow (`apps/whatsapp-bot`) locally against the dev backend to confirm new courses are reachable via chat menu.
