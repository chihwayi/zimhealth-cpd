# Sprint 03 — Seed real course content

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
