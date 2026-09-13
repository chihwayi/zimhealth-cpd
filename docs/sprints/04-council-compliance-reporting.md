# Sprint 04 — Council compliance reporting

**Status: DONE (2026-09-14).** Discovered most of this sprint's scope already existed under `/api/council/compliance` and `/api/council/export/csv` (`backend/src/routes/ncz.ts`, mounted at `/api/council` primary + `/api/ncz` alias) and `apps/web/src/pages/council/CouncilDashboard.tsx`'s Reports tab — built earlier without being tracked against this sprint file. Closed the remaining gaps instead of duplicating the endpoints under `/api/reports/*`: added `cadre` filter, explicit `councilId` override for `ADMIN` (with a 403 for non-admins requesting another council), `format=json` alongside the existing CSV, `nczSyncStatus` + points-required columns in the export, and a `COMPLIANCE_REPORT_GENERATED` `AuditLog` entry per pull (who, council, cadre, cycle year, format, row count). Web Reports tab gained year/cadre filter dropdowns wired to both the summary cards and the CSV download. Renamed the CSV filename from `ncz-compliance-*.csv` to `council-compliance-*.csv` per the pan-African pivot (country-neutral naming, no new NCZ-specific code). Added `backend/src/routes/council.compliance.test.ts` (403 cross-council on both endpoints, CSV shape, cadre filtering, audit log row created) — full `pnpm test` suite passes (36/36). Verified live locally end-to-end (login as `officer@council.co.zw`, filtered CSV/JSON export, confirmed `AuditLog` rows).

**Track:** Backend + Web. **Priority:** P0. **Depends on:** nothing (can run parallel to 02/03).

## Goal
Give council officers a batch reporting view instead of the current single-learner-only lookup, matching the proposal's claim of "automated compliance reports for annual re-registration."

## Why
Today `GET /api/points/learner/:id` (`backend/src/routes/points.ts:249`) only returns one learner at a time, scoped to `ADMIN`/`NCZ_OFFICER`. There's no aggregate/export capability. Gap analysis §1 claim #8.

## Scope
Backend (`backend/src/routes/points.ts` or a new `backend/src/routes/reports.ts`):
- `GET /api/reports/compliance?councilId=&cycleYear=&cadre=&format=csv|json` — for the requesting officer's council (or any council if `ADMIN`), return every learner's: name, registration number, cadre, points earned this cycle, points required (from `Council` config), compliant boolean, `nczSyncStatus`.
- Reuse `getLearnerCPDSummary` from `backend/src/services/cpd-engine.ts` in a loop, or write a single aggregate Prisma query for performance if learner counts are large — check current learner count in seed/prod before deciding (a loop is fine under ~500 learners, use `Promise.all` in batches).
- `format=csv` returns `text/csv` with a simple in-house CSV serializer (no new dependency needed for a flat table — check if one's already in `package.json` first, e.g. under S3/export utilities).
- Auth: `requireAuth, requireRole('ADMIN', 'NCZ_OFFICER', 'COUNCIL_OFFICER')`, and scope non-admins to their own `councilId` (mirror the existing scoping logic at `points.ts:249` for the pattern).
- Log a `ComplianceReportGenerated` entry to `AuditLog` on every report pull (who, council, cycleYear, row count) — the proposal specifically claims audit rigor, so make it real.

Web (`apps/web/src/pages/council/CouncilDashboard.tsx` or a new `apps/web/src/pages/council/ComplianceReport.tsx`):
- A page with filters (cycle year, cadre) and a "Download CSV" button hitting the new endpoint, plus an on-screen summary table (compliant vs. at-risk counts).

## Non-goals
- Do not build a scheduled/emailed report in this sprint — on-demand pull only. (Could be a follow-up sprint.)
- Do not build PDF export — CSV is sufficient for a regulator's re-registration filing workflow; add PDF later if requested.

## Acceptance criteria
- [ ] `GET /api/reports/compliance?councilId=<ncz-id>&cycleYear=2026&format=csv` returns a valid CSV with every NCZ learner's compliance row.
- [ ] Non-admin council officers cannot pull another council's data (403).
- [ ] Web page renders the summary table and download button, gated to `COUNCIL_OFFICER`/`NCZ_OFFICER`/`ADMIN` roles.
- [ ] `AuditLog` row created per report pull.

## Verification
- `cd backend && pnpm test` (add a route test asserting 403 cross-council access and a happy-path CSV shape check).
- Manual: log in as `officer@ncz.co.zw` (seeded demo account) and pull a report through the new web page.
