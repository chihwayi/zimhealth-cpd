# ZimHealth CPD: Proposal Claims vs. System Reality — Gap Analysis

**Source proposal:** `docs/Proposal for Strategic Partnership 11 Sept .docx` (Healthbeat → NCZ, 11 Sept 2026)
**Audit date:** 2026-09-11
**Purpose:** Verify every claim made to NCZ against the actual codebase, surface gaps vs. global CPD/LMS platforms, and produce a backlog precise enough to cut into sprints.

Verdict legend: ✅ Implemented · 🟡 Partial/stub · ❌ Not implemented · ⚠️ Messaging risk (claim conflicts with reality)

---

## 1. Claim-by-claim verification

| # | Proposal claim | Verdict | Evidence |
|---|---|---|---|
| 1 | "Discipline-specific curriculum" — Midwifery, Nursing Education, Nursing Administration, OT Nursing, Mental Health, Pediatric Nursing tracks | ❌ | `CPDCategory` enum only has `CLINICAL, MANAGEMENT, ETHICS, RESEARCH`. No track/specialty entity. `Course.specialtyArea` is a free-text string used once in seed data. |
| 2 | "Continuously expanding library" | ❌ | `backend/prisma/seed.ts` seeds **exactly one course** ("Essential Infection Prevention and Control", 3 points). No content pipeline or cadence exists. |
| 3 | Cross-cutting courses: Nursing Research, Data Analytics, Health Informatics, Data Protection, Nursing Entrepreneurship | ❌ | Zero matches anywhere in repo. Names exist only in the letter. |
| 4 | WhatsApp Learning Gateway — micro-courses, quizzes, reading materials in-chat | ✅ | `apps/whatsapp-bot/src/` has full handler set (menu, learn, quiz, points, aiTutor, payment, registration) wired to `backend/src/routes/bot.ts`. Functionally complete, just has no course content to serve (see #2). |
| 5 | "Just add the API key and it starts working" (env-driven WhatsApp) | ✅ | Provider selected via `WHATSAPP_PROVIDER` env var (Meta Cloud API / 360dialog / Twilio-dev). No hardcoded numbers or keys anywhere in `apps/whatsapp-bot` or `notificationWorker.ts`. Missing credentials → clean dry-run/log mode, not a crash. This part of the pitch is **true today**. |
| 6 | Web portal — studying, downloads, progress tracking | 🟡 | Learner dashboard, enrollment, progress % all real. "Resource downloading" beyond the certificate PDF is not confirmed. |
| 7 | NCZ back-office: content review & approval before publication | ✅ | Real state machine `DRAFT → UNDER_REVIEW → PUBLISHED/ARCHIVED` plus council-scoped `CouncilCourseReview` (PENDING_REVIEW/APPROVED/REJECTED) with reviewer, timestamp, rejection reason, and `AuditLog` entries. |
| 8 | "Real-time" CPD point validation + automated compliance reports for re-registration | 🟡 | Point tracking and `AuditLog` are real (`backend/src/services/cpd-engine.ts`, `points.ts`). There is **no PDF/CSV compliance-report export** and no council officer reporting UI — an officer can query one learner at a time, not generate a batch re-registration report. |
| 9 | Instant certificate generation | ✅ | PDFKit + QR-code verification, S3-hosted, generated on completion (`backend/src/services/certificate.ts`). |
| 10 | $10/year subscription | ⚠️ | Actual pricing: FREE tier, STANDARD **$5**/yr, DIASPORA $15/yr, INSTITUTION $99. The $10 figure in the letter matches neither the code nor (per the letter's own claim) MyCPD's fee — reconcile before sending externally. |
| 11 | Automated point sync with NCZ registration database | 🟡 | `backend/src/services/ncz-sync.ts` is real, idempotent, retry-aware code — but runs in `dry_run` by default and needs `COUNCIL_SYNC_API_URL`/`COUNCIL_SYNC_API_KEY` from an NCZ-side API that **does not exist yet**. This is infrastructure waiting for a partner endpoint, not a working integration. Say so plainly in any live demo. |
| 12 | Payment gateway integration ("zero technical overhead for NCZ") | ✅ | Paynow (EcoCash/OneMoney) and Stripe both fully implemented with webhook confirmation, hash verification, and a subscription table. Voucher/sponsored-access system also exists (NGO bulk codes). |
| 13 | Partnership framed as NCZ-specific | ⚠️ | The platform is **already multi-council** — 8 councils seeded (NCZ, PCZ, MDPCZ, MLCSCZ, AHPCZ, MRPCZ, EHPCZ, NTCZ) with independent point rules and course review. If the letter implies NCZ exclusivity or a bespoke build, that's inaccurate and could become an awkward conversation later — decide up front whether NCZ gets exclusivity, first-mover terms, or co-exists with other councils, and word the letter accordingly. |

---

## 2. What genuinely works today (safe to demo)

- Full course lifecycle: creator drafts → submits → admin/council review → publish, with audit trail.
- Multi-council data model already generalizes past NCZ (NCZ/PCZ/MDPCZ/etc.), each with its own point rules.
- WhatsApp bot: enrollment, module delivery, quiz taking, points check, AI tutor, payment — all wired to real backend routes, entirely env-configured (no code change needed once a paid Meta/360dialog number is provisioned).
- Certificates: instant PDF + QR verification, stored in S3.
- Payments: Paynow + Stripe live integrations, plus a voucher system for sponsored/NGO cohorts.
- Renewal reminders: a Bull job (`notificationWorker.ts`) sends WhatsApp nudges at 90/60/30/7 days before year-end, using an AI-drafted message — also dry-runs safely without credentials.
- Mobile app (Expo, offline-first) exists as a third channel, not mentioned in the proposal at all — likely worth adding as a selling point.

## 3. What's missing before the letter's claims are literally true

| Gap | Blocks which claim | Priority |
|---|---|---|
| No specialty/discipline course taxonomy (only 4 generic categories) | Claim #1 | P0 |
| Only 1 seeded course; none of the named specialty/cross-cutting topics exist | Claims #1–#3 | P0 |
| No compliance-report export (CSV/PDF) for council officers | Claim #8 | P0 |
| No council officer bulk/audit dashboard (only single-learner lookup) | Claim #8 | P1 |
| NCZ sync has no real endpoint to talk to — needs NCZ IT counterpart | Claim #11 | P0 (needs NCZ, not just us) |
| Pricing mismatch ($5 in code vs $10 in letter) | Claim #10 | P0 (fix before sending) |
| No confirmation "resource downloading" beyond certificates is implemented | Claim #6 | P2 |
| Proposal doesn't disclose existing multi-council scope | Claim #13 | P0 (messaging, not code) |

---

## 4. Gaps vs. best-in-class global CPD/LMS platforms

Benchmarked against typical features of mature CPD systems (e.g., CE Broker, Medbridge, RELIAS, ANCC-accredited providers, Coursera-for-business style LMS):

| Capability | Industry norm | ZimHealth CPD | Priority |
|---|---|---|---|
| Content depth per specialty | Dozens of courses per track, refreshed quarterly | 1 course total | P0 |
| Regulator self-service reporting | Council can pull its own compliance/audit reports on demand | Manual per-learner API query only | P0 |
| License/registration verification | Two-way sync with regulator registry (status, renewal, discipline actions) | One-way stub, not connected | P0 (joint w/ NCZ) |
| Offline learning | Full offline course + quiz caching with background sync | Mobile app has an `offline/` module — needs verification of course-content caching, not just points | P1 |
| Multi-language | Local language support (Shona/Ndebele) for rural/older nurses | None found | P1 |
| Accessibility | WCAG 2.1 AA (screen readers, captions) | Not evidenced | P2 |
| Assessment integrity | Timed/randomized quiz pools, attempt limits, proctoring for high-stakes exams | Quiz model exists but no anti-cheating controls confirmed | P2 |
| Personalization | Recommended courses based on cadre/specialty/history | Not implemented | P2 |
| Employer/institution view | Hospitals bulk-enroll and track staff compliance | Voucher batches exist (NGO), but no institution admin dashboard | P1 |
| Gamification | Streaks, leaderboards, badges to drive engagement | `Badge.tsx` is a UI atom only, no streak/leaderboard system | P2 |
| Notifications | Email + SMS + push + WhatsApp multi-channel reminders | WhatsApp-only reminders today | P1 |
| Data protection compliance | Explicit compliance with Zimbabwe's Cyber and Data Protection Act (2021) / POPIA-equivalent | Not evidenced in repo (may exist as policy, not code) | P1 |
| Disaster recovery / uptime SLA | Documented backup cadence, RTO/RPO | Not found in repo (deploy scripts exist, no DR doc) | P2 |

---

## 5. Recommended sprint backlog (derived from above)

**Sprint A — Fix the letter before it goes out (no code, ship this week)**
- Correct $5 vs $10 pricing discrepancy — either raise price in code or fix the letter.
- Rewrite proposal section 1 to describe content as "roadmap" not "existing library" until real courses exist, or delay sending until Sprint B/C content lands.
- Add a line disclosing the multi-council architecture and proposing NCZ's specific commercial terms (exclusivity window, revenue share tier, or first-integration-partner status) rather than implying exclusivity.
- Add one caveat: WhatsApp channel is code-complete and env-configured; needs a paid Meta/360dialog business number before go-live.

**Sprint B — Content taxonomy + seed content (P0)**
- Add `SpecialtyTrack` (or extend `CPDCategory`) for Midwifery, Nursing Education, Nursing Administration, OT Nursing, Mental Health, Pediatric Nursing.
- Author/import at least 2–3 real courses per named track and the 5 cross-cutting topics before any demo to NCZ.

**Sprint C — Council compliance reporting (P0)**
- Build a compliance-report endpoint + UI: council officer selects date range/cadre, exports CSV/PDF of learner points, sync status, renewal risk.
- Add a council-level audit dashboard (aggregate, not single-learner lookup).

**Sprint D — NCZ integration readiness (P0, joint)**
- Define and document the exact API contract `ncz-sync.ts` expects (already scaffolded) and share with NCZ IT as an integration spec, so "system integration" becomes a real conversation, not a slide.

**Sprint E — Engagement & reach (P1)**
- Multi-channel reminders (email/SMS in addition to WhatsApp).
- Institution/employer bulk-enrollment dashboard building on the existing voucher batch model.
- Verify and document mobile offline course-content caching (not just point sync).

**Sprint F — Polish vs. global bar (P2)**
- Shona/Ndebele localization pass.
- Accessibility audit (WCAG 2.1 AA).
- Quiz integrity controls (randomized pools, attempt caps) for high-stakes points.
- Real streak/badge/leaderboard engagement layer.

---

## 6. One-paragraph summary for internal use

The platform's *infrastructure* is genuinely strong and mostly matches the proposal's technical promises — WhatsApp delivery, payments, certificates, and the review workflow are real, working, and cleanly env-configured. The proposal's *content* claims are aspirational: there is one seeded course against a letter that names eleven specific specialty and cross-cutting tracks, and the NCZ-side integration has no partner endpoint to connect to yet. The letter should be corrected on price and framed as a content roadmap (or delayed until Sprint B lands) before it reaches the Registrar, since a live demo today would expose the one-course gap immediately.
