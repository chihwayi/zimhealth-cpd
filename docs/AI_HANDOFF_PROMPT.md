# NursePro CPD — AI Handoff Prompt

Copy and paste the prompt below into a new AI assistant chat when you want it to continue this project properly.

---

# Standard Handoff Prompt

```text
You are continuing work on the NursePro CPD project.

Before doing anything else, read these files in this exact order:

1. docs/LAUNCH_SEQUENCE.md
2. docs/MASTER_PRE_MOBILE_COMPLETION_CHECKLIST.md
3. docs/UI_UX_STANDARDS.md
4. the relevant sprint doc for the sprint you are working on

Your rules:

- Follow docs/LAUNCH_SEQUENCE.md exactly.
- Follow docs/MASTER_PRE_MOBILE_COMPLETION_CHECKLIST.md as the source of truth for what must be true before mobile.
- Follow docs/UI_UX_STANDARDS.md as the source of truth for all frontend and UX work.
- Do not skip the launch order.
- Do not mark work complete if there are broken flows, fake data, missing enforcement, placeholder logic, or dead buttons.
- Do not rely only on frontend restrictions for business rules; enforce critical rules in the backend as well.
- If product copy claims something, make sure it is actually true in code.
- Validate your work before finishing.
- At the end, tell me clearly:
  1. what you completed
  2. what remains
  3. whether the sprint acceptance criteria were fully met

Working style:

- Do one sprint at a time unless I explicitly ask otherwise.
- If the current sprint was already attempted before, audit it first and fix gaps instead of assuming it is done.
- Focus on real product completion, not surface-level UI completion.

Important:

- Do not leave placeholder data.
- Do not leave fake charts.
- Do not leave dead buttons.
- Do not leave fake “coming soon” behavior unless the sprint explicitly requires it.
- Do not stop at analysis if implementation is expected.

Now identify the next unfinished sprint in docs/LAUNCH_SEQUENCE.md and execute it fully.
```

---

# Review Handoff Prompt

Use this when you want the assistant to review an already implemented sprint or feature.

```text
You are reviewing existing NursePro CPD work.

Before doing anything else, read these files in this exact order:

1. docs/LAUNCH_SEQUENCE.md
2. docs/MASTER_PRE_MOBILE_COMPLETION_CHECKLIST.md
3. docs/UI_UX_STANDARDS.md
4. the relevant sprint doc

Review the implementation against all of them.

Review rules:

- Prioritize product gaps, broken flows, trust risks, monetization rule gaps, backend enforcement gaps, fake analytics, missing offline behavior, sync integrity risks, and missing validation.
- Do not give a soft review.
- Do not confuse “UI exists” with “feature is complete.”
- Say clearly whether the sprint is truly complete or not.
- If it is not complete, list the gaps in order of severity with file references.
```

---

# Fix-Previously-Done Sprint Prompt

Use this when a sprint was already “done” by another AI or developer, but you want the assistant to correct it properly.

```text
You are auditing and fixing an already-attempted NursePro CPD sprint.

Before doing anything else, read these files in this exact order:

1. docs/LAUNCH_SEQUENCE.md
2. docs/MASTER_PRE_MOBILE_COMPLETION_CHECKLIST.md
3. docs/UI_UX_STANDARDS.md
4. the relevant sprint doc

Your job is to:

- audit the existing implementation carefully
- identify all gaps against the sprint, the master checklist, and the UI/UX standards
- fix the gaps fully instead of only describing a plan
- validate important flows before finishing

Do not assume previous work is correct just because files exist.
Do not mark the sprint complete unless it actually satisfies the sprint requirements and moves the project toward pre-mobile completion.
```

---

# Minimal Short Prompt

Use this if you want a shorter version.

```text
Read docs/LAUNCH_SEQUENCE.md, docs/MASTER_PRE_MOBILE_COMPLETION_CHECKLIST.md, docs/UI_UX_STANDARDS.md, and the relevant sprint doc first.
Follow them as source of truth.
Do the next unfinished sprint in the launch order.
Do not leave placeholders, fake data, dead buttons, or frontend-only enforcement.
Validate before finishing and tell me what is complete, what remains, and whether the sprint fully passed.
```

