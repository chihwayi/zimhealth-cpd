# Learner/Nurse Experience & Design System

Reference document for a redesign pass. Describes what exists **today**, verified against the
actual code (not aspirational) — file paths included so any claim can be checked. Written for
handing to another AI/designer to propose a redesign; it does not prescribe a redesign itself.

---

## 1. Who this is for

A nurse, midwife, doctor, pharmacist, or other clinician (`Cadre` enum: `NURSE`, `MIDWIFE`,
`PHARMACIST`, `CLINICAL_OFFICER`, `LAB_TECH`) working toward their country's regulatory council's
annual Continuing Professional Development (CPD) point requirement. They interact with the
platform two ways — a responsive web app and a WhatsApp bot — both writing to the same account,
same points ledger, same streak.

---

## 2. Learner-facing pages (web)

All under `apps/web/src/pages/learner/*.tsx` unless noted, rendered inside `AppShell` +
`Sidebar` (dark sidebar, `bg-[#150a26]`, violet/orange ambient gradient — see §5).

### Dashboard (`Dashboard.tsx`)
The landing page after login. Hero banner (`bg-gradient-to-br from-[#150a26] via-[#2e1065] to-[#1a0f2e]`)
with a time-of-day greeting, a circular CPD progress ring (`ProgressRing` component,
color-coded green/amber/violet by urgency), and a renewal countdown that turns urgent (≤60 days)
in red. Below: three stat cards (points earned, points still needed, days to renewal), a
"Continue Learning" strip of up to 3 in-progress enrollments with progress bars, an AI-powered
"Recommended for you" section (`/api/recommendations`, refreshable), a recent-activity feed (last
5 CPD records), an `EngagementCard` (streak + achievement badges, see §4), and a WhatsApp shortcut
button linking straight to `wa.me/...`.

### Courses (`Courses.tsx`)
Browse/discover. Sticky filter sidebar (search, category, specialty track, difficulty, language),
a "matched to your council" badge, sort dropdown (newest / most points / highest rated /
shortest), grid↔list view toggle, 12-per-page pagination. Server-side filtering
(`buildEligibleCourseWhere()`) means a learner only ever sees courses their own council has
approved — there's no "browse everything, get blocked later" pattern.

### CoursePlayer (`CoursePlayer.tsx`) — the core learning surface, and the most complex page
- **Pre-enrollment**: course overview + "Enroll & Start Learning"; FREE-tier learners see a
  paywall message instead ("Free learners can still use WhatsApp CPD... the full web course
  library is a premium feature") with an upgrade CTA.
- **Player layout**: left column = active content (video/reading/audio/interactive/quiz) with
  Previous/Next + "Mark as Complete"; right sidebar = module/section list with a per-module
  offline download toggle and a progress ring.
- **Content types rendered differently per section**: VIDEO (HTML5 `<video>` + HTML body), READING
  (PDF in an iframe with "open in new tab", or DOCX/PPTX as a download link, + HTML body), AUDIO
  (`<audio>` controls + HTML body), INTERACTIVE (external link button + HTML description), QUIZ
  (delegates to `QuizPlayer`).
- **Completion screen**: trophy icon, "+X CPD points earned", star rating (1–5) + optional comment
  review prompt.
- This is the file with the Moodle-style offline machinery — see §3.

### MyLearning (`MyLearning.tsx`)
Two tabs, In Progress / Completed. Each row: thumbnail, title, category badge, duration, points,
difficulty, progress bar, enrollment date, Continue/Completed state.

### Points (`Points.tsx`)
The CPD ledger. Large progress ring, a 3-stat row (earned / activity count / still needed), a
year picker (current + 2 prior cycles), and a paginated (50/page) activity log — each row is an
activity-type badge (`VIDEO_WATCH`/`QUIZ_PASS`/`READING`/`WEBINAR`/`WHATSAPP_QUIZ`, each
color-coded), course title, date, points.

### Certificates (`Certificates.tsx`)
Hero with learner name, registration number, "Verified Learner" badge, "Generate Certificate".
Certificate cards: gradient top accent bar, seal icon, "CPD Certificate — YYYY", total points +
Verified badge, issue date, `font-mono` UUID, Download PDF (or "PDF generating…"), a public
verification-page link, and the list of courses counted toward that certificate (first 8, "+N
more"). Public verification lives at `/verify/:uuid` (`VerifyCertificate.tsx`, no auth required).

### Subscription (`Subscription.tsx`)
Same dark hero gradient as Dashboard. Current-tier badge + expiry date. Two pricing cards side by
side (STANDARD $10/yr, DIASPORA $15/yr), active tier highlighted with a violet gradient +
"Current plan" label, two payment buttons per tier ("Pay with Card (Stripe)" / "Pay with EcoCash
(Paynow)"). Below: voucher redemption (code format `ZHCPD-XXXX-XXXX-XXXX`) for NGO/institution
sponsorship.

### Profile (`Profile.tsx`)
Same dark hero gradient. Avatar with camera-icon upload. "Council identity" card (gradient
white→emerald-50, `BadgeCheck` icon): council picker (auto-filtered by phone's country), title
picker (filtered by the chosen council's `allowedTitles`), registration number, read-only annual
target ("{requiredPoints} CPD pts"). A plain white card below for personal details (email
read-only, name, phone, specialty, institution, province, district). Subscription summary box
links out to the Subscription page.

### ReportIssue (`pages/ReportIssue.tsx`)
Minimal form: title + description → `POST /api/issues` (`source: 'WEB'`). Any authenticated role
can submit; Platform Owner/Helpdesk triage it.

---

## 3. Offline downloads — the "Moodle-like" feature

This is real and functioning, not a stub. Full mechanism:

- **Storage**: browser **IndexedDB**, database `zimhealth-offline` (`apps/web/src/lib/offlineDB.ts`),
  three object stores: `offline_modules`, `pending_progress`, `pending_quiz_attempts`.
- **What downloads**: clicking the download icon on a module in `CoursePlayer` pulls the *entire
  module* — every section's HTML content, and (for QUIZ sections) the full question/option set —
  and writes one `OfflineModule` record. **Media files themselves (video/PDF/audio) are not
  downloaded** — only their URLs are cached, so playing them still needs a connection. This is the
  one place today's implementation falls short of true Moodle-style full-offline (Moodle's mobile
  app mirrors media too).
- **Reading offline**: if `useOnlineStatus()` reports offline and a module is cached, `CoursePlayer`
  reconstructs a `CourseDetail` straight from IndexedDB instead of hitting the API. If offline and
  *not* cached, it shows a plain "You're offline" message rather than crashing.
- **Progress while offline**: "Mark as Complete" writes to the `pending_progress` store instead of
  calling the API, with an optimistic local UI update so the learner doesn't feel blocked.
- **Quiz attempts while offline**: answers + score + timing go into `pending_quiz_attempts`.
- **Sync on reconnect** (`apps/web/src/hooks/useOnlineStatus.ts`): on the browser's `online` event,
  batches every pending item to `POST /api/enrollments/sync-offline` and
  `POST /api/quizzes/:id/attempt` respectively, clears synced entries, and fires
  `zimhealth:progress-synced` / `zimhealth:quiz-attempts-synced` events that `CoursePlayer` listens
  for to refresh its TanStack Query cache.
- **Fraud guard carries through offline too**: the same "implausibly fast submission"
  `flaggedFast` check applies to synced offline quiz attempts, using the `startedAt` timestamp
  captured at download time.

---

## 4. CPD points, streaks, achievements

- **Points** (`backend/src/services/cpd-engine.ts`): one `CPDRecord` per credited activity
  (`learnerId`, `cycleYear`, `activityType`, `pointsEarned`). Activity types:
  `VIDEO_WATCH` / `QUIZ_PASS` / `READING` / `WEBINAR` / `WHATSAPP_QUIZ`. Points come from the
  course's base `cpdPoints`, overridden by the learner's own council's
  `CouncilCourseReview.points` if set. Double-crediting is blocked per learner+quiz+cycle.
- **Streaks** (`backend/src/services/engagement.ts`, `LearnerStreak` table): consecutive UTC
  calendar days with any credited activity. Same day → no-op; next day → +1; a skipped day →
  resets to 1. `longestStreak` persists even after a reset. **No leaderboard** — purely personal,
  by design.
- **Achievements** — 6 fixed badges, all computed from existing data (no separate gamification
  schema beyond the join table): First Steps (1 course), Committed Learner (5 courses), Quiz Whiz
  (1 quiz pass), Week-Long Streak (7-day), Unstoppable (30-day), Specialty Focus (5 courses in one
  `SpecialtyTrack`). Shown on the Dashboard's `EngagementCard` as a 3-column grid — earned badges
  amber-highlighted, locked ones grayed with a lock icon and a hover tooltip.

---

## 5. Color system (current, as of the 2026-09-14 rebrand)

Brand: **"Central and Southern African CPD Hub"**. The palette was deliberately moved *off* blue
(the old "ZimHealth" identity) onto a violet↔amber "sunrise" pairing. Defined in
`apps/web/tailwind.config.ts`:

| Token | Hex | Used for |
|---|---|---|
| `primary-500`/`600`/`700` | `#8b5cf6` / `#7c3aed` / `#6d28d9` | Buttons, links, focus rings, learner-role sidebar accent, logo gradient start |
| `accent-400`/`500`/`600` | `#fb923c` / `#f97316` / `#ea580c` | Secondary CTAs, warm highlights, logo gradient end |
| Dark base | `#150a26` | Every dark surface — sidebar, auth pages, learner-facing hero banners |

**Gradients in active use:**
- Auth pages (Login/Register): `from-[#2e1065] via-[#6d28d9] to-[#ea580c]` — a violet→amber "sunrise" wash.
- Learner hero banners (Dashboard/Profile/Subscription/Certificates):
  `from-[#150a26] via-[#2e1065] to-[#1a0f2e]` — deep plum, more subdued than the auth pages.
- Logo mark (`components/brand/Logo.tsx`): linear gradient `#7c3aed → #f97316` inside a rounded badge with a white ECG/pulse line, deliberately free of any single country's flag colors.

**Role-coded accents** (`components/layout/Sidebar.tsx`) — used for sidebar active-state borders,
avatar chips, and a couple of chart palettes; not a competing brand color, just functional
differentiation between the 6 roles:
- `LEARNER` → `primary` (violet)
- `CONTENT_MANAGER` → `violet-500` (visually close to but distinct from `primary`)
- `COUNCIL_OFFICER` → `cyan-500`
- `PLATFORM_OWNER` → `rose-600`
- `COUNTRY_ADMIN` → `orange-500`
- `HELPDESK` → `amber-500`

**One deliberate exception**: the WhatsApp CTA buttons/icons use WhatsApp's own brand green
`#25D366`, not the app palette — that's intentional (recognizability of the WhatsApp affordance
matters more than palette purity there).

**Chart colors** (`AdminDashboard.tsx` `PIE_COLOURS`): `['#e11d48', '#7c3aed', '#0891b2', '#f59e0b']`
(rose/violet/cyan/amber) — reused for categorical breakdowns (e.g. subscription tier mix).

**Typography**: `Inter` for UI text, `JetBrains Mono` for monospaced values (e.g. certificate
UUIDs), `"DM Serif Display"` for the Landing page's serif headline treatment only.

**A note for the redesign brief**: the current look is a *dark, saturated, gradient-heavy* violet/
amber identity layered on top of an otherwise fairly conventional card-and-table admin/dashboard
structure (white cards, `slate-*` grays, `rounded-xl`/`rounded-2xl` corners, soft shadows). The
"modern" surface area so far is mostly the auth pages, Landing, and hero banners — the deeper
learner pages (Courses, MyLearning, Points, CoursePlayer) are still fairly utilitarian light-mode
UI. That's probably the most fruitful place for a redesign to focus.

---

## 6. WhatsApp bot — how it links to the same account

Entry: Twilio webhook → `apps/whatsapp-bot/src/botRouter.ts`, session state machine in Redis
(24h TTL per phone number), states: `MENU`, `AWAITING_REGISTRATION`, `LEARNING`, `QUIZ`,
`AI_TUTOR`, `PAYMENT`, `BROWSE`, `REPORT_ISSUE`.

**Account linking is phone-number-based** — every bot lookup is `db.user.findUnique({ where: { phone } })`.
There's no separate "bot account"; it's the exact same `User` row the web app uses, so:
- CPD points earned via WhatsApp micro-quizzes land in the **same `CPDRecord` table** the web
  Points page reads from.
- The **same `LearnerStreak`** increments regardless of which surface the activity happened on.
- Course eligibility uses the **same `buildEligibleCourseWhere()`** council-approval filter as the
  web app — a course a learner's council hasn't approved is invisible on both surfaces.
- Registration via WhatsApp (`registrationHandler.ts`) walks: name → cadre → council (filtered by
  phone's detected country) → language → registration number (optional) → institution (optional) →
  confirm, then calls the same `/api/bot/register` the web `Register` page's data model maps onto.

**What a learner can do purely over WhatsApp**: register, browse/enroll in eligible courses,
read module content section-by-section (HTML converted to plain WhatsApp text, videos/audio/docs
sent as links), take module quizzes (1 question per message, A–D reply) which credit CPD points
exactly like the web quiz flow, take ungated 3-question "micro-quizzes" from a static fallback
bank (no CPD credit, just a knowledge check), check current points/streak, ask an AI tutor
clinical questions (with off-topic/red-flag-symptom guardrails and a 3-follow-ups-per-cycle
paywall for FREE tier), report an issue, and pay/redeem a voucher.

**Deliberate limitations**: WhatsApp's 4096-character message cap means long reading sections get
truncated; quizzes are multiple-choice only (no free text); media is always a link, never
delivered inline.

---

## 7. Subscription tiers

| Tier | Price | What it unlocks |
|---|---|---|
| `FREE` (default) | — | WhatsApp micro-quizzes + capped WhatsApp CPD points per cycle; AI tutor with a 3-follow-up paywall; **no** web course library access |
| `STANDARD` | $10/yr | Full web course library, all content types, AI tutor on WhatsApp, certificates, both web+WhatsApp CPD count |
| `DIASPORA` | $15/yr | Everything in STANDARD + priority support + "sponsor a learner" (marked coming soon) |
| `INSTITUTION` | admin-configured | Bulk/org-wide enrollment, used for sponsor batches (NGOs, employers) |

Payment: Stripe (card) or Paynow (EcoCash, Zimbabwe mobile money) — `POST /api/payments/initiate`
returns a redirect URL; webhook callbacks (`/api/payments/webhook/{stripe,paynow}`) apply the
confirmed payment and set a 1-year `subscriptionExpiresAt`. Vouchers (`ZHCPD-XXXX-XXXX-XXXX`,
single-use, batch-issued by Platform Owner/Country Admin for NGOs/institutions) redeem through the
same `applyConfirmedPayment()` path with `gateway: 'voucher'`.

---

## 8. What this document deliberately does not cover

Out of scope for the redesign brief this feeds: Platform Owner/Country Admin/Council Officer
back-office screens, the Content Creator authoring flow, RBAC internals (see `docs/rbac.md`
instead), and backend architecture beyond what's needed to explain learner-visible behavior.
