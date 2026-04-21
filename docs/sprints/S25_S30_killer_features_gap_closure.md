# Sprints 25–30 — Killer Feature Gap Closure Before Mobile

---

# Purpose

This document closes the gap between the current NursePro CPD implementation and the actual product promise:

1. Three ways to connect
2. Work-anywhere offline mode
3. Personal AI tutor on WhatsApp
4. Smart, personalized learning
5. Effortless NCZ credit tracking
6. Free-to-start monetization with premium upsell

This is a **hardening + product-truth sprint pack**. The goal is not to add surface UI. The goal is to make sure the product actually does what the business promise says, with no hidden integrity or access-control gaps before mobile app work begins.

Use `docs/UI_UX_STANDARDS.md` as the source of truth for any frontend touched here.

---

# Current Validation Summary

## What is already materially present

- Web learner app exists and is reasonably complete
- WhatsApp bot exists with routing, registration, learning, quiz, points, and AI tutor flows
- PWA/offline foundation exists
- AI recommendations exist
- NCZ sync foundation exists
- Certificates and subscription/payment flows exist
- Creator, NCZ, and Admin portals exist

## What is not yet fully true in product terms

- WhatsApp CPD credit integrity is not safe enough yet
- Free-tier limits and premium entitlements are not enforced
- Offline mode is only partially real
- NCZ sync has an important correctness bug
- Personalized learning exists, but it is still too shallow for the promise
- WhatsApp AI tutor exists, but the commercial gating and clinical safety loop are incomplete

---

# Sprint 25 — CPD Integrity and Free-Tier Enforcement

**Goal:** Make CPD crediting trustworthy and enforce the actual business model.

## Why this sprint is mandatory

Right now, WhatsApp quiz crediting can be repeated without strong deduplication, and the free-tier promise is not enforced in code. This means point totals can drift away from reality, and the premium model is not actually protecting premium features.

## Problems to fix

- `apps/whatsapp-bot/src/handlers/quizHandler.ts` credits WhatsApp quiz points using only phone and quiz score
- `backend/src/routes/points.ts` accepts bot credit without `courseId`, `quizId`, or a dedupe key
- `backend/src/services/cpd-engine.ts` only dedupes quiz credit when `quizId` exists
- No backend rule enforces the "Free tier gets enough WhatsApp points only" promise
- No backend rule gates advanced AI tutor behind paid access
- No backend rule restricts premium web library/certificate behavior by subscription tier

## Tasks

### T25.1 — Introduce explicit entitlement rules

CREATE FILE: `backend/src/services/entitlements.ts`

Implement a single source of truth for:

- whether learner can use advanced AI tutor
- whether learner can access premium web courses
- whether learner can generate certificates
- whether learner has remaining free WhatsApp CPD allowance this cycle
- whether learner can take a given WhatsApp quiz for credit

Functions to expose:

- `getLearnerEntitlements(learnerId: string)`
- `canUseAiTutor(learnerId: string)`
- `canGenerateCertificate(learnerId: string, cycleYear: number)`
- `canEarnWhatsAppPoints(learnerId: string, cycleYear: number)`
- `canAccessPremiumCourse(learnerId: string, courseId: string)`

Business rules:

- `FREE`
  - can use WhatsApp learning
  - can earn CPD via WhatsApp only
  - maximum credited WhatsApp points per cycle: `12`
  - cannot use advanced AI tutor beyond a small free allowance
  - cannot access premium web-only courses
  - cannot generate formal certificates
- `STANDARD`
  - full web library
  - full AI tutor
  - certificates enabled
- `DIASPORA`
  - same as Standard for now
- `INSTITUTION`
  - same as Standard for learner-facing entitlements unless later expanded

### T25.2 — Add stable bot credit deduplication

EDIT FILE: `backend/src/routes/points.ts`

Replace the current bot credit payload with a stricter schema:

- `phone`
- `quizId`
- `courseId` optional
- `moduleId` optional
- `attemptKey`
- `quizScore`

Rules:

- reject bot credit calls missing `quizId` or `attemptKey`
- pass `quizId` into `creditPoints`
- store `attemptKey` in CPD record meta or a dedicated field
- if the same learner + quiz + cycle already has a credited WhatsApp pass, return success with `pointsEarned: 0`

### T25.3 — Fix WhatsApp quiz submission payload

EDIT FILE: `apps/whatsapp-bot/src/handlers/quizHandler.ts`

When a learner passes:

- send `quizId`
- send `courseId` if known from learning state
- generate deterministic `attemptKey`
- do not claim `+1 CPD point awarded` unless backend confirms `pointsEarned > 0`
- if backend returns `0`, send a message like:
  - `You passed, but this quiz was already credited for this cycle.`

### T25.4 — Store course/module context in bot session

EDIT FILE: `apps/whatsapp-bot/src/sessionManager.ts`

Extend `quizState` and `learningState` to store:

- `courseId`
- `moduleId`
- `moduleTitle`
- `quizSource` enum: `MODULE_QUIZ | MICRO_QUIZ`

EDIT FILE: `apps/whatsapp-bot/src/handlers/learnHandler.ts`

When starting a module quiz:

- populate course/module context into `quizState`

EDIT FILE: `apps/whatsapp-bot/src/handlers/quizHandler.ts`

For standalone micro-quizzes:

- treat them as practice by default
- do not credit CPD unless product explicitly allows that path

### T25.5 — Enforce free-tier and premium access on the backend

EDIT FILE: `backend/src/routes/certificates.ts`

- block certificate generation for `FREE`
- return a clear upgrade-needed error

EDIT FILE: `backend/src/routes/recommendations.ts`

- recommendations may still show premium courses, but must label them as locked if learner is `FREE`

EDIT FILE: `backend/src/routes/courses.ts`

- add `isPremium` filtering logic if course monetization is the chosen model
- or add course access metadata in response if gating is done client-side

### T25.6 — Gate AI tutor by entitlement

EDIT FILE: `apps/whatsapp-bot/src/handlers/aiTutor.ts`

Before calling AI:

- fetch learner identity via bot lookup if needed
- call an entitlement endpoint
- allow limited AI tutor for `FREE` only if product wants a teaser allowance
- otherwise require upgrade

CREATE FILE: `backend/src/routes/entitlements.ts`

Expose a bot-safe endpoint:

- `GET /api/entitlements/bot/:phone`

Response should include:

- `subscriptionTier`
- `aiTutorAllowed`
- `remainingWhatsappPoints`
- `certificateEligible`
- `premiumWebAccess`

### T25.7 — Surface upgrade reasons in UI and bot copy

EDIT FILE: `apps/web/src/pages/learner/Subscription.tsx`
EDIT FILE: `apps/whatsapp-bot/src/handlers/paymentHandler.ts`

Update copy so it exactly matches implemented rules.

Do not leave text claiming:

- free tier gets 12 points if code does not enforce it
- certificates are premium if backend still allows them for free

## Acceptance Criteria

- A learner cannot farm unlimited CPD points from WhatsApp repeats
- Free-tier allowance is enforced at the backend, not only in copy
- Premium features are actually premium
- Bot messages accurately reflect backend outcomes
- Certificate generation respects entitlements

---

# Sprint 26 — Offline Mode Reality Upgrade

**Goal:** Make offline mode true for actual use, not just partial progress sync.

## Why this sprint is mandatory

The current offline implementation caches module metadata and reading content, but not enough quiz payload or media to fulfill the promise that a learner can complete lessons and quizzes offline and sync later.

## Problems to fix

- Offline cache stores only quiz IDs/titles, not question payload
- `QuizPlayer` requires live API fetch and live submit
- Media is not truly downloaded for offline use
- Completion sync exists, but offline quiz attempt sync does not

## Tasks

### T26.1 — Expand offline schema

EDIT FILE: `apps/web/src/lib/offlineDB.ts`

Add support for:

- full offline quiz payload:
  - question IDs
  - question text
  - options
  - pass mark
  - showAnswersAfter
- pending offline quiz attempts:
  - `quizId`
  - `answers`
  - `attemptedAt`
  - `courseId`
  - `moduleId`
- optional downloaded media metadata

### T26.2 — Cache full quiz data during module download

EDIT FILE: `apps/web/src/pages/learner/CoursePlayer.tsx`

When downloading a module:

- save full quizzes, not only `id` and `title`
- preserve enough data for offline rendering and grading

### T26.3 — Add offline quiz player path

EDIT FILE: `apps/web/src/components/course/QuizPlayer.tsx`

Support two modes:

- online mode:
  - existing API behavior
- offline mode:
  - read questions from offline store
  - grade locally
  - queue attempt sync
  - show result immediately

If a learner is offline and quiz exists in local cache:

- quiz must still be playable

### T26.4 — Add offline quiz attempt sync

EDIT FILE: `apps/web/src/lib/offlineDB.ts`
EDIT FILE: `apps/web/src/hooks/useOnlineStatus.ts`
EDIT FILE: `backend/src/routes/quizzes.ts`

Create a sync path for queued offline quiz attempts:

- preserve attempt timestamp
- prevent duplicate sync
- award points once
- return whether points were awarded, already-awarded, or denied

### T26.5 — Improve offline UX clarity

EDIT FILE: `apps/web/src/pages/learner/CoursePlayer.tsx`
EDIT FILE: `apps/web/src/components/ui/OfflineBanner.tsx`

Add explicit UI states for:

- downloaded and safe for offline
- partially downloaded
- quiz available offline
- media unavailable offline
- pending sync count

Use the shared calm/trustworthy design patterns from `docs/UI_UX_STANDARDS.md`.

### T26.6 — Add real media prefetch strategy

EDIT FILE: `apps/web/src/pages/learner/CoursePlayer.tsx`

For downloadable modules:

- prefetch images and documents
- for video/audio, either:
  - truly download blobs into IndexedDB/Cache Storage, or
  - explicitly mark them as streaming-only if full offline download is not feasible

Do not imply video/audio works offline unless it really does.

## Acceptance Criteria

- Downloaded quizzes work offline
- Quiz attempts sync later and do not duplicate CPD credit
- Reading content works offline
- Learner clearly sees what is and is not available offline
- Product copy matches actual offline capability

---

# Sprint 27 — WhatsApp AI Tutor Safety, Quality, and Commercial Readiness

**Goal:** Make the AI tutor a trustworthy differentiator rather than just a raw LLM wrapper.

## Why this sprint is mandatory

The AI tutor exists and the multi-provider setup is mostly in place, so S15 was not a failure. But this feature is central to the product strategy, so it needs stronger clinical safety, better product control, and cleaner monetization behavior.

## Validation of Sprint 15

### Done correctly

- Multi-provider AI client wiring exists
- Redis cache exists
- WhatsApp AI tutor handler exists
- Admin AI provider config exists
- Public AI feature flag endpoint exists
- Type-check passes for the WhatsApp bot package

### Not fully complete relative to the product promise

- no citation or source-grounding for clinical answers
- no escalation path for high-risk advice
- no entitlement gating for advanced tutor access
- no follow-up quiz capture loop
- no analytics on tutor usage, deflection, failures, or upgrade conversions

## Tasks

### T27.1 — Add AI tutor analytics and audit trail

CREATE FILE: `backend/src/routes/bot-analytics.ts`
or extend admin analytics routes.

Track:

- tutor request count
- cache hit rate
- provider used
- fallback usage
- failures
- average latency
- top prompt themes
- upgrade conversions from tutor paywall

### T27.2 — Add safe-answer wrapper

EDIT FILE: `apps/whatsapp-bot/src/handlers/aiTutor.ts`
EDIT FILE: `packages/ai-client/src/index.ts`

Strengthen output rules:

- distinguish educational guidance from emergency care
- require "seek urgent in-person escalation" for red-flag symptoms
- disallow diagnosis certainty
- disallow patient-specific dosing as final authority
- add a short "verify against local guideline/supervisor" footer for medication and emergency topics

### T27.3 — Add structured follow-up quiz behavior

Instead of relying on the prompt alone:

- parse or generate a short follow-up question explicitly
- let learner answer in WhatsApp
- optionally store as reinforcement telemetry

This should be a real stateful bot flow, not only a prompt suggestion.

### T27.4 — Add provider health fallback and admin visibility

EDIT FILE: `backend/src/routes/admin.ts`
EDIT FILE: `apps/web/src/pages/admin/AdminDashboard.tsx`

Expose:

- active provider
- configured providers
- last provider failures
- health check summary
- last fallback event

### T27.5 — Add upgrade/paywall experience for AI tutor

EDIT FILE: `apps/whatsapp-bot/src/handlers/aiTutor.ts`
EDIT FILE: `apps/whatsapp-bot/src/handlers/paymentHandler.ts`
EDIT FILE: `apps/web/src/pages/learner/Subscription.tsx`

Make the AI tutor monetization path explicit and smooth:

- free allowance messaging
- upgrade CTA
- quick link to payment
- post-upgrade success copy

## Acceptance Criteria

- AI tutor is clinically safer
- usage can be measured
- entitlement rules are enforced
- tutor responses feel like a product feature, not just a raw model output

---

# Sprint 28 — Personalized Learning Upgrade

**Goal:** Make recommendations actually "smart" enough to justify the product claim.

## Why this sprint is mandatory

Recommendations exist, but they are still mostly profile/course-history driven. The product promise is stronger: specialization-aware suggestions, deadline-aware prioritization, and AI-generated content from real guidelines.

## Problems to fix

- recommendation prompt does not use quiz weaknesses
- recommendation payload does not expose why a course is urgent versus merely relevant
- learner dashboard does not explain locked versus recommended courses
- AI content generation exists, but there is no end-to-end creator/admin workflow turning guidelines into reviewed courses

## Tasks

### T28.1 — Feed assessment weakness data into recommendations

EDIT FILE: `backend/src/services/adaptive-learning.ts`

Add to learner context:

- quiz attempts
- average scores by category/topic
- repeated failure themes
- unfinished enrollments

Prompt must prioritize:

- renewal gap closure
- weak knowledge areas
- cadre fit
- specialty fit

### T28.2 — Add recommendation reasons with categories

Return structured reasons:

- `deadline`
- `specialty_fit`
- `knowledge_gap`
- `points_efficiency`

EDIT FILE: `backend/src/routes/recommendations.ts`
EDIT FILE: `apps/web/src/pages/learner/Dashboard.tsx`

Render reasons in the UI cleanly.

### T28.3 — Add profile completeness prompts

EDIT FILE: `apps/web/src/pages/learner/Profile.tsx`
EDIT FILE: `apps/web/src/pages/learner/Dashboard.tsx`

If specialty area, institution, or cadre are missing:

- show targeted prompts explaining why that data improves recommendations

### T28.4 — Create guideline-to-course workflow

CONNECT existing AI generation to an actual workflow:

- upload guideline
- parse text
- generate draft course
- save as creator draft
- review and submit

Likely files:

- `backend/src/services/ai-content-gen.ts`
- `backend/src/routes/courses.ts`
- creator portal pages
- admin review screens

### T28.5 — Add admin review trail for AI-generated content

AI-generated content must be visibly marked in creator/admin workflows:

- source document name
- generation timestamp
- generated-by provider
- review status
- reviewer notes

## Acceptance Criteria

- recommendations reflect weaknesses and deadlines, not just profile basics
- AI-generated course creation has a real reviewed workflow
- learners understand why something was recommended

---

# Sprint 29 — NCZ Sync Trustworthiness

**Goal:** Ensure "effortless credit tracking" is operationally trustworthy.

## Why this sprint is mandatory

This feature is only valuable if sync status is accurate. A single false positive sync can break trust with learners and regulators.

## Problems to fix

- `backend/src/services/ncz-sync.ts` filters payload to records with NCZ registration numbers, but marks all unsynced records as synced afterward
- dry-run mode marks records as synced even when nothing was sent to a real NCZ endpoint
- there is no clear reconciliation workflow for failed records
- missing NCZ numbers are not surfaced as an actionable queue

## Tasks

### T29.1 — Fix sync update scope

EDIT FILE: `backend/src/services/ncz-sync.ts`

Only mark as synced:

- records actually included in payload
- and only after the remote API confirms success

Do not mark dry-run records as synced.

### T29.2 — Add reconciliation states

Extend data model if needed so records can be:

- `PENDING`
- `BLOCKED_MISSING_NCZ`
- `SYNCED`
- `FAILED`

If schema changes are needed:

- add migration
- update NCZ dashboard and admin read views

### T29.3 — Add blocked-record queue

NCZ and Admin views must show:

- learners missing NCZ registration numbers
- records blocked from sync
- exact reason for blockage
- direct action path to resolve

### T29.4 — Add sync retry and replay

Support:

- retry failed batch
- replay specific record
- manual resync after learner profile correction

### T29.5 — Add audit-friendly sync logs

Each sync batch should store:

- batch size
- sent IDs
- blocked IDs
- failed IDs
- response code
- response summary

## Acceptance Criteria

- no unsent record can be marked synced
- dry-run never mutates production sync state
- operators can see blocked and failed records clearly
- NCZ sync status is audit-friendly

---

# Sprint 30 — Final Product-Truth Polish Before Mobile

**Goal:** Align UX, copy, telemetry, and release confidence with the actual feature set.

## Tasks

### T30.1 — Create a feature-truth matrix in-app

Add internal release checklist covering:

- web
- WhatsApp
- offline
- NCZ sync
- subscriptions
- AI tutor

This can be an admin-only page or a markdown doc surfaced in admin.

### T30.2 — Align all copy with actual product behavior

Audit and fix all copy that over-claims:

- offline quizzes
- free-tier entitlements
- certificates
- AI tutor limits
- NCZ automatic sync status

### T30.3 — Add smoke tests for killer features

Add automated checks for:

- WhatsApp quiz crediting dedupe
- offline progress sync
- offline quiz sync
- NCZ sync blocked-record handling
- AI tutor feature flag off
- AI provider switch
- free-tier paywall behavior

### T30.4 — Add launch-readiness manual QA checklist

Create a step-by-step manual checklist for:

- learner on web
- learner on WhatsApp
- content manager
- admin
- NCZ officer
- free user
- paid user
- low-connectivity scenario

### T30.5 — Add release telemetry dashboard

At minimum, track:

- course enrollments
- offline downloads
- pending sync counts
- bot active users
- bot quiz completions
- AI tutor usage
- payment conversion
- NCZ sync success rate

## Acceptance Criteria

- Product claims and implementation match
- Critical killer-feature flows are testable and measurable
- Team can move to mobile with confidence instead of assumptions

---

# Execution Order

Do these in this order:

1. Sprint 25
2. Sprint 29
3. Sprint 26
4. Sprint 27
5. Sprint 28
6. Sprint 30

Reason:

- first protect credit integrity and monetization
- then fix regulator-facing correctness
- then finish offline depth
- then harden the AI differentiator
- then improve personalization sophistication
- then polish and launch-gate everything

---

# Definition of Done

This gap-closure pack is only done when:

- free-tier and premium behavior are enforced in backend code
- WhatsApp CPD crediting is deduped and audit-safe
- offline quizzes really work offline
- NCZ sync never reports false success
- AI tutor is gated, safer, and measurable
- recommendations use meaningful learner performance signals
- all learner-facing copy matches reality
- automated tests cover the killer-feature paths

