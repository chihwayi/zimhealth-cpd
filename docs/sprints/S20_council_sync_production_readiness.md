# Sprint S20 — Council sync production readiness

### Priority: CRITICAL
### Feature: Feature 3 (AI tutor), Feature 4 (Adaptive learning), Feature 5 (Council credit tracking)

---

## The Problem

The platform has a council sync adapter and dashboard surface, but "automatic council
submission" is only production-complete when it is generic, testable, observable, and
verified against the actual council integration contract.

This sprint also closes two final audit gaps that do not belong cleanly inside the
mobile or WhatsApp sprints:

- The AI tutor must explicitly report whether Anthropic/Claude is configured for production.
- Adaptive learning must either provide module-level next-step suggestions or stop claiming
  module-level adaptation in product copy.

---

## Scope

Use generic council terminology everywhere touched by this sprint. Do not introduce
new council-specific product names in visible UI, sprint docs, routes, or user-facing logs.

Intentionally unchanged unless a separate migration is approved:

- Existing role enum/database names that are already persisted.
- Existing legacy router files or aliases that still serve `/api/council`.
- Backward-compatible redirects from older admin URLs to generic council URLs.

---

## Exact files to inspect

The current codebase may still keep the implementation in legacy-named files. That is
acceptable if routes and UI are generic.

1. `backend/src/app.ts`
2. Current council sync router/service/job files
3. `apps/web/src/pages/admin/AdminDashboard.tsx`
4. Current council dashboard page
5. `backend/src/services/adaptive-learning.ts`
6. Current AI tutor/provider config files
7. `.env.example`

---

## Part A — Council sync contract and terminology

### A1 — Make mode explicit

The sync service must expose one of these modes in logs and dashboard summary:

- `dry_run`: credentials or endpoint missing; records are not submitted.
- `live`: endpoint and credentials configured; records are submitted.
- `disabled`: sync intentionally disabled by env flag.

Acceptance:

- Admin dashboard can tell which mode is active.
- Dry-run cannot be mistaken for real submission.
- Missing env vars do not silently pretend to submit records.

### A2 — Add contract validation around outbound payloads

Before sending records to a council endpoint, validate the payload shape with a schema.
The schema should cover at least:

- learner identity
- registration number
- council identifier
- cycle year
- points earned
- course/activity reference
- completed timestamp
- certificate/record identifier

Acceptance:

- Invalid local data marks the item as blocked/invalid, not failed network sync.
- The dashboard exposes blocked items separately from transient failed items.

### A3 — Add acknowledgement/reconciliation handling

The sync response must store enough data to prove what happened:

- outbound request id or generated idempotency key
- remote acknowledgement/reference if provided
- submitted timestamp
- response status/body summary
- next retry timestamp for retryable failures

Acceptance:

- Retrying the same local record uses a stable idempotency key.
- A successful acknowledgement prevents duplicate submission.
- A failed request can be retried without losing audit history.

---

## Part B — Dashboard and routes

### B1 — Generic route surface

All new UI/API-facing instructions should use `/api/council/...` and generic labels:

- "Council Sync Status"
- "Council Sync Schedule"
- "registration number"
- "submitted to your council"

Acceptance:

- No new visible copy uses a legacy council-specific name.
- Existing backward-compatible aliases may remain, but new code should call `/api/council`.

### B2 — Operator workflow

The admin/council dashboard should let an operator:

- see mode (`dry_run`, `live`, or `disabled`)
- see pending/synced/failed/blocked counts
- retry failed items
- inspect the latest sync response summary
- export or view an audit trail for a learner or cycle

Acceptance:

- Operators can distinguish "not configured", "configured but failing", and "successfully submitted".

---

## Part C — AI provider readiness

### C1 — Health check provider reporting

Add or verify an admin/internal health endpoint that reports:

- configured AI provider
- whether Anthropic/Claude credentials are present
- whether fallback providers are enabled
- last successful AI tutor completion timestamp if tracked

Do not expose API keys.

Acceptance:

- Production can verify whether the WhatsApp AI tutor is actually backed by Claude.
- If another provider is active, product copy can avoid claiming Claude specifically.

---

## Part D — Adaptive learning precision

### D1 — Add module-level next step or correct copy

Choose one:

1. Implement module-level next recommendations based on quiz weaknesses, cadre, course progress,
   and incomplete modules.
2. Keep current course-level recommendations, but update product/admin copy to say
   "AI-powered course recommendations" instead of "module-level adaptive learning".

Acceptance:

- Product behavior and product language match.
- AI failure returns a deterministic fallback recommendation list.
- Tests cover fallback behavior without requiring live AI credentials.

---

## Final acceptance criteria

- No sprint doc or new visible UI copy uses a legacy council-specific product label.
- Council sync mode is visible and unambiguous.
- Dry-run, live success, retryable failure, and blocked invalid-record cases are tested.
- Sync submissions are idempotent and store acknowledgement/audit metadata.
- AI provider health makes the Claude/Anthropic status explicit.
- Adaptive learning either supports module-level next steps or is described accurately.
- Backend and web TypeScript compile cleanly.

---

## Do NOT change

- Do not rename persisted database enum values or columns in this sprint unless a migration
  plan is separately approved.
- Do not remove backward-compatible legacy routes if existing deployments or redirects still need them.
- Do not expose council credentials, AI provider secrets, or full raw clinical prompts in dashboard output.
