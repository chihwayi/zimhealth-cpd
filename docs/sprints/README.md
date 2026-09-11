# Sprints

Derived from `docs/PROPOSAL-VS-REALITY-GAP-ANALYSIS.md`. Each file is self-contained: an AI coding agent should be able to open one sprint file and ship it without reading the others. Do them in order within a track; tracks can run in parallel.

| # | Sprint | Track | Priority |
|---|---|---|---|
| 00 | [Deployment reconciliation (Coolify)](00-deployment-reconciliation.md) | Infra | P0 — do first |
| 01 | [Fix the proposal letter](01-fix-proposal-letter.md) | Docs (no code) | P0 |
| 02 | [Specialty track taxonomy](02-specialty-track-taxonomy.md) | Content model | P0 |
| 03 | [Seed real course content](03-seed-course-content.md) | Content | P0 |
| 04 | [Council compliance reporting](04-council-compliance-reporting.md) | Backend + Web | P0 |
| 05 | [NCZ sync integration spec](05-ncz-sync-integration-spec.md) | Backend + Docs | P0 |
| 06 | [Multi-channel reminders](06-multichannel-reminders.md) | Backend | P1 |
| 07 | [Institution bulk enrollment dashboard](07-institution-dashboard.md) | Backend + Web | P1 |
| 08 | [Mobile offline content verification](08-mobile-offline-verification.md) | Mobile | P1 |
| 09 | [Shona/Ndebele localization](09-localization.md) | Content + Web | P2 |
| 10 | [Quiz integrity controls](10-quiz-integrity.md) | Backend | P2 |
| 11 | [Engagement layer (streaks/badges)](11-engagement-gamification.md) | Backend + Web | P2 |
| 12 | [Accessibility audit (WCAG 2.1 AA)](12-accessibility-audit.md) | Web | P2 |

Conventions used in every sprint file: **Goal**, **Why**, **Scope** (files/models to touch), **Non-goals**, **Acceptance criteria**, **Verification**.

## Deployment is part of "done"

The app already runs on a Contabo server managed via Coolify (see `server-properties.txt` and `/Users/devoop/Dev/coolify-infra/README.md`). Sprint 00 makes Coolify the real, auto-deploying pipeline for this repo. Once Sprint 00 is complete, **every other sprint's definition of done includes shipping to the live server** — push to `main`, confirm the Coolify deployment fires, smoke-test on the live URL. A sprint that only exists in `git log` is not finished.
