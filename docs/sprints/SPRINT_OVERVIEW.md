# NursePro CPD — Sprint Master Overview

> 6 phases · 24 sprints · ~24 weeks
> Each sprint = 1 week · Sprint docs are self-contained instructions for any AI assistant to execute.
> **Validator:** Claude Code (you). Review each sprint's output before marking complete.

---

## Sprint Map

| Sprint | Phase | Title | Key Deliverable |
|---|---|---|---|
| S01 | 1 | Monorepo Foundation | Repo, tooling, Docker, env |
| S02 | 1 | Database Schema & Prisma | All models, migrations, seed |
| S03 | 1 | Auth API | Register, login, JWT, RBAC |
| S04 | 1 | CPD Points Engine | Rules, crediting, audit log |
| S05 | 1 | Course & Module API | CRUD, publishing workflow |
| S06 | 1 | Media Upload Pipeline | S3, image resize, video queue |
| S07 | 1 | Web App Shell & Routing | App shell, sidebar, route guards |
| S08 | 1 | Learner Dashboard | CPD ring, stat cards, activity feed |
| S09 | 1 | Course Browser & Player | Browse, enroll, video player |
| S10 | 1 | Quiz Engine (Web) | Take quiz, score, point credit |
| S11 | 1 | Payments Integration | Paynow + Stripe, subscription tiers |
| S12 | 1 | Certificate Generation | PDF cert, UUID verify |
| S13 | 2 | WhatsApp Bot Foundation | Twilio webhook, session, router |
| S14 | 2 | Bot Learning & Quiz Flow | Micro-lessons, stateful quiz |
| S15 | 2 | Bot AI Tutor | Claude + multi-provider AI |
| S16 | 3 | Creator Portal — Course Builder | Drag-drop builder, TipTap editor |
| S17 | 3 | Creator Portal — Quiz Builder | Question bank, AI question gen |
| S18 | 3 | Creator Portal — Analytics | Enrollment charts, completion rates |
| S19 | 4 | NCZ Portal | Learner search, reports, export |
| S20 | 4 | NCZ Sync Adapter | Auto-submit, retry, sync logs |
| S21 | 5 | Admin Portal — Core | User mgmt, course approvals |
| S22 | 5 | Admin Portal — Analytics & Config | Platform analytics, AI config |
| S23 | 5 | AI Features — Adaptive & Reminders | Recommendations, smart reminders |
| S24 | 6 | Hardening & Launch Prep | Security, a11y, load test, Sentry |

---

## How to Use These Sprint Docs

1. Open the sprint document for the current sprint (e.g. `docs/sprints/S01.md`)
2. Read the **Goal**, **Inputs**, and **Acceptance Criteria** first
3. Follow **Tasks** in order — each task is a numbered step
4. Each task specifies the **exact files to create or edit** with full content
5. Run the **Validation Checklist** at the end
6. Claude Code will review and sign off before you move to the next sprint

---

## Conventions Used in Sprint Docs

- `CREATE FILE` — create a new file at the exact path given
- `EDIT FILE` — modify an existing file (exact changes described)
- `RUN COMMAND` — terminal command to execute
- `TEST` — specific thing to verify works
- `✅ DONE` — mark when complete

---

*Last updated: April 2026*
