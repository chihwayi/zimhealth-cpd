# Proposed RBAC Access-Control Matrix

Companion to `docs/rbac-audit-report.md`. This is the design proposal for review — **no code has
been changed yet.** Once you confirm/adjust this, it becomes the spec for implementation and later
`docs/rbac.md`.

## Proposed role set

| Role (proposed) | Maps from | Scope |
|---|---|---|
| `PLATFORM_OWNER` | New — carved out of today's `ADMIN` | Global, cross-country, infrastructure |
| `COUNTRY_ADMIN` | New — carved out of today's `ADMIN` | One country's operations only |
| `COUNCIL_OFFICER` | Today's `NCZ_OFFICER` + `COUNCIL_OFFICER` merged (pending your answer to open question 1) | One council's content governance + compliance only |
| `CONTENT_MANAGER` | Unchanged | Own draft content only, until council-approved |
| `LEARNER` | Unchanged | Own account only |
| `HELPDESK` | Unchanged | Issue-report triage, cross-country (not content/PII scoped) |

`countryCode`/`councilId` scoping reuses the existing, already-correct pattern from
`ncz.ts`'s `getOfficerCouncilId()` — extended to `COUNTRY_ADMIN` with an equivalent
`getAdminCountryCode()`.

## Access matrix

Legend: ✅ full access · 🔶 own-scope only · 🚫 no access

| Resource / Action | PLATFORM_OWNER | COUNTRY_ADMIN | COUNCIL_OFFICER | CONTENT_MANAGER | LEARNER | HELPDESK |
|---|---|---|---|---|---|---|
| **Content approval** |
| Approve/reject course for a council | 🚫 (not their call, even as owner — see below) | 🚫 | 🔶 own council only | 🚫 | 🚫 | 🚫 |
| Publish course (final PUBLISHED flip) | 🚫 direct override — must require ≥1 council approval, same as everyone | 🚫 | ✅ triggers publish when they approve | 🚫 | 🚫 | 🚫 |
| Create/edit draft course & quiz content | ✅ (support only, logged) | 🚫 | 🚫 | 🔶 own drafts | 🚫 | 🚫 |
| View pending-approval queue | ✅ global | 🔶 own country, read-only | 🔶 own council | 🔶 own submissions | 🚫 | 🚫 |
| **Users** |
| Manage clinician accounts (create/deactivate/reset) | ✅ | 🔶 own country only | 🚫 | 🚫 | 🔶 own account | 🚫 |
| Assign `COUNTRY_ADMIN` role | ✅ only | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| Assign `COUNCIL_OFFICER` role | ✅ only (per open question 2) | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| Assign `CONTENT_MANAGER`/`HELPDESK` role | ✅ | 🔶 own country's users only | 🚫 | 🚫 | 🚫 | 🚫 |
| View user PII | ✅ global | 🔶 own country only | 🔶 own council's registrants, compliance view only (no editing) | 🚫 | 🔶 self | 🚫 |
| **Council governance** |
| Create/deactivate a council (tenant provisioning) | ✅ only | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| Set council CPD requirements (points/renewal date) | ✅ (bounds only) | 🚫 | 🔶 own council, within global bounds | 🚫 | 🚫 | 🚫 |
| **Secrets & infrastructure** |
| WhatsApp/AI/payment/email provider keys | ✅ only | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| Trigger (not configure) WhatsApp/email notifications | ✅ | 🔶 own country's users | 🚫 | 🚫 | 🚫 | 🚫 |
| AI provider selection / maintenance mode | ✅ only | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| **Reporting** |
| Cross-country analytics/aggregates | ✅ only | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| Own-country reporting | ✅ | 🔶 | 🚫 | 🚫 | 🚫 | 🚫 |
| Own-council compliance report | ✅ | 🚫 | 🔶 | 🚫 | 🚫 | 🚫 |
| Global audit log | ✅ only | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| Own-country/council audit trail | ✅ | 🔶 (own country's actions) | 🔶 (own council's actions) | 🚫 | 🚫 | 🚫 |
| **Vouchers / institutions** |
| Create voucher batches | ✅ | 🔶 own country | 🚫 | 🚫 | 🚫 | 🚫 |
| **Support** |
| Issue-report triage | ✅ | 🔶 own country's reports (new scoping) | 🚫 | 🚫 | own reports only (submit) | ✅ global |
| **Localization (Section 5)** |
| Canonical translation key set (add/rename/delete keys) | ✅ only | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| Enable a new language slot platform-wide | ✅ only | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| Upload/edit translated strings for own country | ✅ | 🔶 own country only | 🚫 | 🚫 | 🚫 | 🚫 |
| Approve regulated-tier string changes | 🚫 (not their call) | 🚫 | 🔶 own council, same queue as content approval | 🚫 | 🚫 | 🚫 |
| Choose which enabled languages are active for own country | ✅ | 🔶 | 🚫 | 🚫 | 🚫 | 🚫 |
| Rollback a country's language file | ✅ only | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| Default/fallback (English) locale | ✅ only, never overwritten by upload | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |

## Key behavioral rules this matrix implies (to be enforced server-side, not just in this table)

1. **No direct-publish override for anyone, including Platform Owner.** A course reaches
   `PUBLISHED` only via a `COUNCIL_OFFICER` approval on their own council's review row. This
   directly fixes audit finding #1. Platform Owner's "content" access above is read/support-only
   (e.g. fixing a stuck record), not a bypass button — logged if used.
2. **Role assignment is strictly downward and single-tier-gated:** `PLATFORM_OWNER` can assign any
   role; `COUNTRY_ADMIN` can assign only `CONTENT_MANAGER`/`HELPDESK`-equivalent within their own
   country (no `COUNCIL_OFFICER`, no `COUNTRY_ADMIN`, no `PLATFORM_OWNER`); no other role can
   assign any role. This fixes audit finding #2.
3. **Every `COUNTRY_ADMIN` query gets an implicit `countryCode` filter**, mirroring the existing
   `getOfficerCouncilId()` pattern — extend it, don't reinvent it.
4. **Regulated-tier locale strings route through the same `CouncilCourseReview`-style approval
   queue as content**, not a separate mechanism — reuses existing audit-logging plumbing.

## What I need from you before writing code

- Confirm or adjust the matrix above (especially any 🔶/🚫 cell that surprises you).
- Answers to the four open questions in `docs/rbac-audit-report.md` §4 (NCZ_OFFICER/COUNCIL_OFFICER
  merge, who creates Country Admins, HELPDESK placement, impersonation scope).
- Confirmation that fixing audit finding #1 (council-approval bypass) can ship immediately/
  independently, since it's a self-contained bug fix that doesn't depend on the new roles existing.
