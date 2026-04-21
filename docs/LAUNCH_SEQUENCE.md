# NursePro CPD — Launch Sequence Before Mobile

This document tells any AI assistant exactly what to do next, in what order, and what rules must be followed while doing it.

Use this document when you want an assistant to continue the project toward launch readiness before mobile apps begin.

---

# Core Rule

Every future assistant must use these documents together:

1. `docs/LAUNCH_SEQUENCE.md`
2. `docs/MASTER_PRE_MOBILE_COMPLETION_CHECKLIST.md`
3. `docs/UI_UX_STANDARDS.md`
4. the sprint doc for the sprint currently being executed

If an assistant skips any of those, it is not following project instructions correctly.

---

# What “Done” Means

The system is only ready to move to mobile when:

- the killer features are genuinely true
- the backend rules enforce the business model
- offline behavior matches the product promise
- WhatsApp and web are consistent
- NCZ sync is trustworthy
- the UI follows the standards
- copy matches real behavior
- the master checklist is satisfied

Do not let any assistant claim “done” just because UI exists or because a feature works partially.

---

# Execution Order

Do the remaining launch work in this exact order:

## Step 1 — Sprint 25

Document:

- `docs/sprints/S25_S30_killer_features_gap_closure.md`

Section:

- **Sprint 25 — CPD Integrity and Free-Tier Enforcement**

Why first:

- CPD credit integrity and monetization rules are foundational
- if these are wrong, the product cannot be trusted

Expected outcome:

- WhatsApp points cannot be farmed
- free-tier and premium rules are enforced in backend code
- certificate and AI access rules are truthful

---

## Step 2 — Sprint 29

Document:

- `docs/sprints/S25_S30_killer_features_gap_closure.md`

Section:

- **Sprint 29 — NCZ Sync Trustworthiness**

Why second:

- regulator-facing correctness is more important than polish
- false sync state is unacceptable

Expected outcome:

- no unsent record can be marked synced
- blocked and failed records are visible and actionable

---

## Step 3 — Sprint 26

Document:

- `docs/sprints/S25_S30_killer_features_gap_closure.md`

Section:

- **Sprint 26 — Offline Mode Reality Upgrade**

Why third:

- offline is one of the core competitive advantages
- it must be real before launch

Expected outcome:

- offline lessons and quizzes work properly
- queued progress and quiz sync behave safely

---

## Step 4 — Sprint 27

Document:

- `docs/sprints/S25_S30_killer_features_gap_closure.md`

Section:

- **Sprint 27 — WhatsApp AI Tutor Safety, Quality, and Commercial Readiness**

Why fourth:

- the AI tutor already exists
- after integrity and offline are fixed, it can be hardened into a true differentiator

Expected outcome:

- safer tutor behavior
- entitlement-aware access
- analytics and provider health visibility

---

## Step 5 — Sprint 28

Document:

- `docs/sprints/S25_S30_killer_features_gap_closure.md`

Section:

- **Sprint 28 — Personalized Learning Upgrade**

Why fifth:

- recommendations already exist
- now they need to become truly smart, not just acceptable

Expected outcome:

- recommendations use meaningful learner performance signals
- guideline-to-course workflow is real and reviewable

---

## Step 6 — Sprint 30

Document:

- `docs/sprints/S25_S30_killer_features_gap_closure.md`

Section:

- **Sprint 30 — Final Product-Truth Polish Before Mobile**

Why last:

- this sprint validates truth, launch safety, copy alignment, telemetry, and tests

Expected outcome:

- no over-promising
- no hidden launch blockers
- clean final pre-mobile validation state

---

# Rules For Each Sprint

Every assistant working on any sprint in this launch sequence must do all of the following:

## Before starting work

Read:

1. `docs/LAUNCH_SEQUENCE.md`
2. `docs/MASTER_PRE_MOBILE_COMPLETION_CHECKLIST.md`
3. `docs/UI_UX_STANDARDS.md`
4. the sprint section being executed

## During implementation

- do not invent behavior outside the product promise unless clearly helpful and documented
- do not leave dead buttons, placeholder flows, or fake analytics
- do not rely only on frontend restrictions for business rules
- enforce critical rules in the backend
- preserve consistency between WhatsApp, web, creator, admin, and NCZ flows

## Before finishing

The assistant must verify:

- type-check passes where relevant
- key flow behavior is validated
- copy matches actual functionality
- the sprint acceptance criteria are satisfied
- the master checklist is still moving toward full completion

---

# How To Ask An AI Assistant To Do A Sprint Properly

Use this exact prompt template.

## Standard Sprint Execution Prompt

```text
Read docs/LAUNCH_SEQUENCE.md first.
Then read docs/MASTER_PRE_MOBILE_COMPLETION_CHECKLIST.md.
Then read docs/UI_UX_STANDARDS.md.
Then read the relevant sprint doc and execute only the next sprint in the launch order.

Rules:
- Follow the launch order exactly.
- Follow the master checklist and UI/UX standards as source of truth.
- Do not mark anything complete if there are broken flows, fake data, missing enforcement, or placeholder behavior.
- Enforce important product and monetization rules in the backend, not only in the frontend.
- Validate your work before finishing.
- At the end, tell me what was completed, what remains, and whether the sprint acceptance criteria were fully met.
```

---

## Prompt For “Do The Next Sprint”

```text
Read docs/LAUNCH_SEQUENCE.md, docs/MASTER_PRE_MOBILE_COMPLETION_CHECKLIST.md, and docs/UI_UX_STANDARDS.md first.
Then identify the next unfinished sprint in the launch order and execute it fully.
Do not skip ahead.
Do not stop at analysis.
Implement, verify, and report whether the sprint is fully complete.
```

---

## Prompt For Review / Validation

```text
Read docs/LAUNCH_SEQUENCE.md, docs/MASTER_PRE_MOBILE_COMPLETION_CHECKLIST.md, docs/UI_UX_STANDARDS.md, and the relevant sprint doc first.
Review the implementation against all of them.
Prioritize product gaps, broken flows, trust risks, monetization rule gaps, backend enforcement gaps, fake analytics, and missing validation.
Do not give a soft review.
Say clearly whether the sprint is truly complete or not.
```

---

## Prompt For Fixing A Previously “Done” Sprint

```text
Read docs/LAUNCH_SEQUENCE.md, docs/MASTER_PRE_MOBILE_COMPLETION_CHECKLIST.md, docs/UI_UX_STANDARDS.md, and the sprint doc first.
Audit the existing implementation carefully.
If it is incomplete, fix it to full completion instead of describing a plan only.
Validate all important flows before finishing.
```

---

# What You Should Tell Assistants Not To Do

If you want stronger results, include these instructions:

```text
Do not treat surface UI as completion.
Do not leave placeholder data.
Do not leave fake charts.
Do not leave dead buttons.
Do not rely on copy for business rules.
Do not skip verification.
If something is claimed in product copy, make sure it is true in code.
```

---

# Recommended Working Style

For best results, tell assistants to work one sprint at a time.

Best cadence:

1. ask assistant to do one sprint fully
2. ask assistant to review whether that sprint was actually completed correctly
3. only then move to the next sprint in `LAUNCH_SEQUENCE.md`

Do not ask assistants to do all remaining sprints at once unless you are okay with lower reliability.

---

# Final Instruction

Until mobile starts, this file should be treated as the operational order of the project.

If an assistant asks “what next?”, the answer should be:

- follow `docs/LAUNCH_SEQUENCE.md`

