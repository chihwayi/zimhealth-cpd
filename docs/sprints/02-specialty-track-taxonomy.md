# Sprint 02 — Specialty track taxonomy

**Track:** Content model (Prisma + backend + web filters). **Priority:** P0. **Depends on:** nothing.

## Goal
Give the platform a real, filterable taxonomy for nursing specialty tracks so course content can be organized the way the proposal describes: Midwifery, Nursing Education, Nursing Administration, Operating Theatre Nursing, Mental Health Nursing, Pediatric Nursing, General Nursing Refresher, plus cross-cutting topics (Nursing Research, Data Analytics in Healthcare, Health Informatics, Data Protection/Privacy, Nursing Entrepreneurship).

## Why
Today `Course.specialtyArea` is a free-text nullable string used once in seed data, and `CPDCategory` only has `CLINICAL, MANAGEMENT, ETHICS, RESEARCH`. There's no way to browse/filter "all Midwifery courses." See gap analysis §1, §3.

## Scope
- `backend/prisma/schema.prisma`:
  - Add enum `SpecialtyTrack` with values: `MIDWIFERY, NURSING_EDUCATION, NURSING_ADMINISTRATION, OPERATING_THEATRE, MENTAL_HEALTH, PEDIATRIC, GENERAL_REFRESHER, NURSING_RESEARCH, DATA_ANALYTICS, HEALTH_INFORMATICS, DATA_PROTECTION, ENTREPRENEURSHIP`.
  - Replace `Course.specialtyArea String?` with `Course.specialtyTrack SpecialtyTrack?` (keep column name migration clean — write a Prisma migration, don't hand-edit `migrations/`).
  - Add `@@index([specialtyTrack])`.
- New Prisma migration under `backend/prisma/migrations/`.
- `backend/src/routes/courses.ts` (and its Zod schema file `courses.schema.ts`): accept/validate `specialtyTrack` on create/update, support `?specialtyTrack=` filter on the course list endpoint (mirror however `category` filtering currently works — grep for `category` in that file to match the pattern exactly).
- `apps/web/src/pages` course browse/list page: add a specialty track filter dropdown (mirror the existing category filter UI component).
- `apps/whatsapp-bot`: if the course menu currently groups by category, add specialty track as a browse dimension too (check `botRouter`/`menuHandler` — only if trivial; otherwise leave for Sprint 03 once real content exists to browse).

## Non-goals
- Do not write course content in this sprint (that's Sprint 03).
- Do not remove the existing `CPDCategory` enum — tracks are additive, not a replacement for clinical/management/ethics/research categorization.

## Acceptance criteria
- [ ] Migration applies cleanly on a fresh `pnpm db:migrate`.
- [ ] `POST /api/courses` and `PATCH /api/courses/:id` accept `specialtyTrack`.
- [ ] `GET /api/courses?specialtyTrack=MIDWIFERY` filters correctly.
- [ ] Web course list has a working specialty filter.
- [ ] Existing seeded course ("Essential Infection Prevention and Control") is assigned a sensible track (`GENERAL_REFRESHER`) so nothing breaks.

## Verification
- `cd backend && pnpm db:migrate && pnpm build`
- `pnpm test` in backend (if course route tests exist, extend one for the new filter)
- Manually hit `GET /api/courses?specialtyTrack=MIDWIFERY` against a dev server and confirm empty-but-valid response before Sprint 03 adds content.
