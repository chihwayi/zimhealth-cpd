# NursePro CPD — Master Pre-Mobile Completion Checklist

This is the single control document for deciding whether the current **web + WhatsApp** system is truly complete before moving to mobile apps.

Use this document together with:

- `docs/UI_UX_STANDARDS.md` for all frontend and interaction work
- sprint docs in `docs/sprints/`
- `docs/sprints/S25_S30_killer_features_gap_closure.md` for final gap closure

If an assistant is asked to implement, review, or validate anything before mobile, this file should be treated as the **master release checklist**.

---

# How To Use This Document

## Rule 1 — Always use two documents together

Use:

1. `docs/MASTER_PRE_MOBILE_COMPLETION_CHECKLIST.md`
2. `docs/UI_UX_STANDARDS.md`

Think of them like this:

- `MASTER_PRE_MOBILE_COMPLETION_CHECKLIST.md`
  - defines **what must be true**
  - defines **what complete means**
  - defines **which sprint owns which gap**
- `UI_UX_STANDARDS.md`
  - defines **how frontend work must look and behave**
  - prevents broken, inconsistent, or placeholder-feeling UI

## Rule 2 — Start every future sprint/task with this sequence

When using an AI assistant, tell it to do this in order:

1. Read `docs/MASTER_PRE_MOBILE_COMPLETION_CHECKLIST.md`
2. Read `docs/UI_UX_STANDARDS.md`
3. Read the relevant sprint doc
4. Implement only against those requirements
5. Validate against the checklist again before finishing

## Rule 3 — Never mark a feature complete just because UI exists

A feature is only complete if:

- backend behavior works
- entitlements/rules are enforced
- empty/loading/error states exist where needed
- copy matches real behavior
- analytics or audit behavior exists if the feature is operationally important
- tests or validation paths exist for high-risk flows

## Rule 4 — If this checklist and a sprint conflict

Use this order of precedence:

1. Truth of implemented product promise
2. `docs/MASTER_PRE_MOBILE_COMPLETION_CHECKLIST.md`
3. `docs/UI_UX_STANDARDS.md`
4. sprint doc

If a sprint says something weaker than the product promise, the product promise wins.

---

# Product Promise

This project exists to offer features that competitors in Zimbabwe do not offer yet.

Those competitive advantages are:

1. Three ways to connect
2. Work-anywhere offline mode
3. Personal AI tutor on WhatsApp
4. Smart, personalized learning
5. Effortless NCZ credit tracking
6. Free-to-start model with premium upsell

The system is not complete before mobile unless all six are genuinely true in the web + WhatsApp product.

---

# Release Decision

Before mobile work begins, the answer to all of these must be **YES**:

- Can a nurse learn on web?
- Can a nurse learn on WhatsApp?
- Does low-connectivity/offline use actually work in the ways we claim?
- Is the AI tutor safe, useful, and productized?
- Are recommendations meaningfully personalized?
- Are NCZ sync states trustworthy and auditable?
- Are free-tier and premium features actually enforced?
- Does the UI feel calm, professional, and trustworthy?
- Do copy and feature behavior match exactly?

If any answer is **NO**, the system is not yet pre-mobile complete.

---

# Feature Matrix

## 1. Three Ways To Connect

### Promise

A nurse can access the platform by:

- computer/web
- smartphone app later
- WhatsApp now

For pre-mobile completion, web + WhatsApp must already be complete enough that mobile is an extension, not a rescue mission.

### Already Covered By

- `docs/sprints/S13_S14_whatsapp_bot.md`
- `docs/sprints/S15_bot_ai_tutor.md`
- learner web sprints before that

### Remaining Closure Sprint

- `docs/sprints/S25_S30_killer_features_gap_closure.md`
  - Sprint 25
  - Sprint 27
  - Sprint 30

### Done Means

- learner can register and return via WhatsApp
- learner can browse and continue learning via WhatsApp
- learner can use web learning flows
- points/status remain coherent across channels
- WhatsApp and web do not contradict each other

### Validation Questions

- Can a learner start on WhatsApp and later see consistent points on web?
- Can a learner start on web and continue core learning through WhatsApp?
- Are bot menus, point totals, and upgrade messages accurate?

---

## 2. Work-Anywhere Offline Mode

### Promise

A nurse can download course materials online, then continue lessons and quizzes offline, and sync later.

### Already Covered By

- existing PWA and offline work in web app

### Remaining Closure Sprint

- `docs/sprints/S25_S30_killer_features_gap_closure.md`
  - Sprint 26
  - Sprint 30

### Done Means

- reading content works offline
- downloaded modules are clearly marked
- offline quiz play works
- offline progress sync works
- offline quiz attempt sync works
- no misleading UI about unsupported offline media

### Validation Questions

- Can a learner complete a downloaded module while fully offline?
- Can a learner complete a quiz while fully offline?
- After reconnecting, do progress and points sync once and correctly?
- Does the UI clearly show what is downloaded and what is not?

---

## 3. Personal AI Tutor On WhatsApp

### Promise

A nurse can chat with a WhatsApp AI assistant that:

- answers clinical questions
- gives short lessons
- reinforces learning
- works affordably on WhatsApp bundles

### Already Covered By

- `docs/sprints/S15_bot_ai_tutor.md`

### Remaining Closure Sprint

- `docs/sprints/S25_S30_killer_features_gap_closure.md`
  - Sprint 25
  - Sprint 27
  - Sprint 30

### Done Means

- AI tutor responds on WhatsApp
- provider switching works
- caching works
- fallback works
- entitlement gating works
- safety rules are strong enough for clinical education use
- AI tutor usage is measurable
- upgrade path is clear for restricted users

### Validation Questions

- Does the tutor work when the default provider fails?
- Is unsafe or off-topic behavior blocked?
- Are free and paid users treated according to plan?
- Do admins have visibility into provider health and usage?

---

## 4. Smart, Personalized Learning

### Promise

The system should learn from:

- cadre
- specialty
- progress
- weak knowledge areas
- renewal urgency

And recommend useful next steps, not generic content.

### Already Covered By

- existing recommendation engine
- creator AI content generation foundation

### Remaining Closure Sprint

- `docs/sprints/S25_S30_killer_features_gap_closure.md`
  - Sprint 28
  - Sprint 30

### Done Means

- recommendations use learner profile
- recommendations use course completion history
- recommendations use quiz weakness/performance signals
- reasons are visible to learner
- AI-generated content workflow is operational and reviewable

### Validation Questions

- If two learners have different cadres or weaknesses, do they get different recommendations?
- Are recommendations influenced by renewal urgency?
- Is there a real workflow for turning guidelines into reviewed learning content?

---

## 5. Effortless NCZ Credit Tracking

### Promise

Credits should move to NCZ reliably so nurses do not need manual follow-up.

### Already Covered By

- `docs/sprints/S19_S20_ncz_portal.md`
- existing NCZ sync and dashboards

### Remaining Closure Sprint

- `docs/sprints/S25_S30_killer_features_gap_closure.md`
  - Sprint 29
  - Sprint 30

### Done Means

- only valid records are synced
- blocked records are visible
- failed records are retryable
- dry-run cannot corrupt real sync state
- sync logs are audit-friendly
- NCZ-related statuses shown to operators are truthful

### Validation Questions

- Can any unsent record be incorrectly marked synced?
- Can operators see why a record is blocked?
- Can failed syncs be retried safely?

---

## 6. Free-To-Start Model

### Promise

Nurses can start for free with enough value to remove friction, while premium features remain monetizable.

### Already Covered By

- subscription and payment foundations

### Remaining Closure Sprint

- `docs/sprints/S25_S30_killer_features_gap_closure.md`
  - Sprint 25
  - Sprint 27
  - Sprint 30

### Done Means

- free-tier entitlements are enforced in backend code
- premium features are actually premium
- upgrade messaging is honest and consistent
- WhatsApp free allowance is enforced if promised
- certificates and advanced AI access follow business rules

### Validation Questions

- Can a free user get premium behavior accidentally?
- Does all bot/web copy match what the backend really allows?
- Is there a clean upgrade path where restriction occurs?

---

# Sprint Map

## Completed or Mostly Implemented Foundations

- `S13_S14_whatsapp_bot.md`
- `S15_bot_ai_tutor.md`
- `S16_S18_creator_portal.md`
- `S19_S20_ncz_portal.md`
- `S21_S23_admin_portal.md`
- `S24_hardening_launch.md`

## Final Gap-Closure Pack

- `S25_S30_killer_features_gap_closure.md`

### Order To Execute

1. Sprint 25
2. Sprint 29
3. Sprint 26
4. Sprint 27
5. Sprint 28
6. Sprint 30

This order is important because:

- first fix integrity and monetization
- then fix regulator-facing correctness
- then finish offline depth
- then harden the AI differentiator
- then deepen personalization
- then do final launch-truth validation

---

# Master Done Checklist

Use this as the final yes/no sheet before mobile.

## Access Channels

- [ ] Web learner journey works end to end
- [ ] WhatsApp learner journey works end to end
- [ ] Points stay consistent across channels
- [ ] Upgrade messaging is consistent across channels

## Offline

- [ ] Downloaded modules work offline
- [ ] Downloaded quizzes work offline
- [ ] Offline progress sync works after reconnect
- [ ] Offline quiz sync works after reconnect
- [ ] UI clearly shows offline availability and pending sync state

## AI Tutor

- [ ] Tutor works on WhatsApp
- [ ] Off-topic guard works
- [ ] Clinical safety framing is strong enough
- [ ] Provider fallback works
- [ ] AI usage is measurable
- [ ] Entitlement gating works

## Personalization

- [ ] Recommendations use learner profile
- [ ] Recommendations use performance/weakness signals
- [ ] Recommendations use renewal urgency
- [ ] Learner sees clear reasons for recommendations
- [ ] AI guideline-to-course workflow is operational

## NCZ Sync

- [ ] Unsynced records remain unsynced until real success
- [ ] Dry-run cannot falsely mark records synced
- [ ] Blocked records are visible and actionable
- [ ] Failed records are retryable
- [ ] Sync logs are trustworthy

## Monetization

- [ ] Free-tier restrictions are enforced in backend
- [ ] Premium features are gated correctly
- [ ] Certificates follow entitlement rules
- [ ] AI tutor access follows entitlement rules
- [ ] Free WhatsApp allowance follows entitlement rules

## UX Truthfulness

- [ ] All touched frontend follows `docs/UI_UX_STANDARDS.md`
- [ ] No page has placeholder-feeling flows
- [ ] All loading/empty/error states are present
- [ ] No copy over-promises unsupported behavior
- [ ] No important operational state is hidden from the user/operator

## Verification

- [ ] High-risk flows have automated tests or strong verification
- [ ] Bot type-check passes
- [ ] Web type-check passes
- [ ] Backend type-check passes
- [ ] Manual QA checklist completed

If any box above is unchecked, the system is not fully complete before mobile.

---

# Recommended Prompt To Give Future AI Assistants

Use this prompt pattern:

> Read `docs/MASTER_PRE_MOBILE_COMPLETION_CHECKLIST.md` first, then read `docs/UI_UX_STANDARDS.md`, then read the relevant sprint doc. Implement and validate the task against all three. Do not mark the work complete unless the product promise, master checklist, and UI standards are all satisfied.

For review tasks:

> Review this work against `docs/MASTER_PRE_MOBILE_COMPLETION_CHECKLIST.md`, `docs/UI_UX_STANDARDS.md`, and the relevant sprint doc. Focus first on product gaps, behavioral mismatches, broken flows, trust risks, and missing enforcement.

---

# Final Meaning Of “Complete Before Mobile”

The system is complete before mobile only when:

- the killer features are truly real, not just partially scaffolded
- the web + WhatsApp product is trustworthy on its own
- entitlements and sync rules are enforced at backend level
- offline mode works in the ways we publicly claim
- the AI tutor is safe, measured, and productized
- the UI matches the standards and feels production-ready

Mobile should be the next expansion layer, not the thing that fixes unfinished core product behavior.

