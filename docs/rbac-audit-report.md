# RBAC Audit Report

Audited against `docs/rbac-audit-and-redesign-brief.md`. Findings are based on reading the actual
route guards, not the intended design — every claim below cites the file/line it comes from.

## 1. Current role inventory

`backend/prisma/schema.prisma` defines a single flat enum, no hierarchy, no tenancy field on the
role itself:

```
enum Role { ADMIN, CONTENT_MANAGER, NCZ_OFFICER, COUNCIL_OFFICER, LEARNER, HELPDESK }
```

- **ADMIN** — global, unscoped. Reaches: all users (`admin.ts` `/users`), all courses incl. direct
  publish (`courses.ts` `/:id/approve`), all vouchers/batches, all council CRUD (`councils.ts`),
  all locale packs (`locales.ts`), system config + AI provider switch (`admin.ts` `/config/*`),
  audit log, telemetry, subscriptions. No country/council filter exists anywhere in this role's
  code path — it is architecturally "Platform Owner + every Country Admin + council override"
  collapsed into one role.
- **CONTENT_MANAGER** — creates/edits courses and quizzes, uploads media. Cannot publish directly
  (`courses.ts:354` gates `/approve` to ADMIN only) — this part already matches the brief's Level 4
  intent ("should not publish content directly").
- **NCZ_OFFICER** / **COUNCIL_OFFICER** — two roles doing the same job. `NCZ_OFFICER` is Zimbabwe-era
  naming left over from before the pan-African rename (see memory `project_pan_african_pivot`);
  every route treats them identically (`requireRole('NCZ_OFFICER', 'COUNCIL_OFFICER', ...)`
  everywhere, no behavioral difference). Properly scoped to their own `councilId` via
  `getOfficerCouncilId()` (`ncz.ts:11-18`) — cross-council requests are rejected with 403
  (`ncz.ts:42-44`, `resolveComplianceFilters`).
- **LEARNER** — scoped to own account throughout (enrollments, points, certificates, quizzes all
  filter by `req.user.id`).
- **HELPDESK** — issue-report triage only (`issues.ts`), global (no country scoping), which is
  fine since support triage isn't council-regulated.

## 2. Top findings, ranked by severity

### 1. [CRITICAL] Council-approval bypass — the exact bug you flagged
`courses.ts:353-361`, `POST /api/courses/:id/approve`, `requireRole('ADMIN')` only:

```ts
if (approvedReviewCount === 0) {
  publishWarning = 'Course published, but no council has approved it yet. ...';
}
```

This never blocks. An ADMIN can flip any course straight to `PUBLISHED` with **zero** council
approvals — the warning is cosmetic, returned in the response body, not enforced. The real,
correctly-scoped council review flow exists in parallel (`ncz.ts:178-260`,
`/courses/:courseId/reviews/approve|reject`, council-scoped, audit-logged) but nothing stops the
admin shortcut from skipping it entirely. This is the single highest-priority fix.

### 2. [CRITICAL] Unrestricted self-service admin minting
`admin.ts:286-297`, `PATCH /api/admin/users/:id`: any ADMIN can set any other user's `role` to
`ADMIN` (the only check is "can't change your own role" and "can't deactivate yourself" —
`admin.ts:289-295`). There is no rule that a role can't grant a role equal to or above itself, and
no higher tier exists today to gate this. Combined with finding #1, one compromised or careless
ADMIN account is a full platform + content-governance compromise.

### 3. [HIGH] No Country/Council-scoped Admin tier exists
This is the structural root cause the brief is asking to fix. ADMIN is global by construction —
not "leaking" past a boundary, because no boundary exists. There is currently no way to grant
someone "operate Zambia only" without handing them the entire platform (every other country's
learner PII, every council's pending content, vouchers, system config).

### 4. [HIGH] i18n upload path has none of the Section 5 controls
`locales.ts:74-107`, `POST /api/locales`, `requireRole('ADMIN')`:
- No canonical-key-set validation — `parseLocaleFile` (`localePackParser.ts`) accepts and stores
  whatever keys are in the uploaded file; nothing diffs it against the app's real key set
  (`@zimhealth/i18n`'s `en` export is only used for the *template* CSV, never for validation).
- No country ownership check — any ADMIN can upsert any `code`/`countryCodes` combination.
- No risk-tier distinction (general vs. regulated/compliance strings) and no Council approval
  routing for regulated wording — `db.languagePack.upsert` goes live immediately on upload.
- No versioning/diff/rollback — upsert overwrites the previous `translations` blob outright.
- No placeholder/variable-safety check (`{name}`, `{date}` etc.) between source and upload.

### 5. [MEDIUM] Secrets are not currently leaked, but the role holding them will be split
`admin.ts` `/config/ai` and `/config/system` never return raw key values — only booleans/which-
providers-are-configured (`getConfiguredProviders()`, `admin.ts:43-48`). So there's no direct key
exfiltration today. But AI-provider switching, maintenance mode, and (once a Country Admin tier
exists) all future country-facing admin actions currently sit behind the exact same `ADMIN` check —
this needs to become Platform-Owner-exclusive explicitly once the tiers are split, not by accident.

### 6. [MEDIUM] Role-elevation guard is a single hardcoded special case, not a systemic rule
The only anti-escalation logic anywhere is the one `if` in `admin.ts:289`. It happens to work today
only because there's nothing above ADMIN to escalate into. This will need to become a real rule
("no role may assign a role >= its own level") once Platform Owner/Country Admin/Council tiers
exist, or the same gap reopens one level up.

### 7. [LOW] `AVAILABLE_ROLES` enum omits two real roles
`admin.ts:19`: `['ADMIN', 'CONTENT_MANAGER', 'NCZ_OFFICER', 'LEARNER']` — missing
`COUNCIL_OFFICER` and `HELPDESK`. An ADMIN literally cannot promote someone to Council Officer or
Helpdesk through the supported endpoint today. Dead corner, not a leak, but blocks legitimate
council-onboarding and will need fixing as part of the redesign regardless.

### 8. [LOW] `institutions.ts` has no role guard, relies solely on row ownership
`institutions.ts:47,72,137` — `requireAuth` only, no `requireRole`. Safe in practice because
`loadBatchForAccess()` (`institutions.ts:28-42`) checks `isAdmin || isOwner || isContact` before
returning data, but it's the one file in the codebase that doesn't follow the role-first pattern
used everywhere else. Worth tightening for defense-in-depth once the redesign touches this area.

## 3. Positive findings (keep these patterns)

- **Council/officer scoping is done right already.** `getOfficerCouncilId()` +
  `resolveComplianceFilters()` in `ncz.ts` is the correct template: officer's own `councilId` is
  re-fetched fresh from the DB on every request (never trusted from the JWT), and any attempt to
  query a different council's data via `?councilId=` is rejected with 403. This is exactly the
  pattern the new Country Admin tier should reuse for `countryCode`/`councilId` scoping.
- **JWT role is verified server-side, never trusted from the client.** `auth.middleware.ts:15-16`
  decodes and verifies the signed token on every request; `councilId` is looked up fresh per
  request rather than embedded in the token, avoiding stale-scope bugs after a reassignment.
- **Audit logging already exists for most mutating admin/council actions** — course
  approve/reject (both paths), council review approve/reject, admin user updates, AI
  provider/system config changes, institution invites all write an `AuditLog` row. Not universal
  (e.g. no dedicated "ROLE_ELEVATED" action type — it's folded into the generic
  `ADMIN_USER_UPDATED` diff), but a solid baseline to build the brief's audit requirements on top
  of rather than starting from zero.
- **Content-author role already can't self-publish** — `CONTENT_MANAGER` is excluded from
  `/:id/approve`; only the approval-bypass in finding #1 undermines this, not the role boundary
  itself.

## 4. Open questions before implementation (mirrors brief §4.4)

1. **NCZ_OFFICER vs COUNCIL_OFFICER** — since every route already treats them identically, should
   the redesign collapse these into one `COUNCIL_OFFICER` role (data-migrate existing
   `NCZ_OFFICER` rows), or keep both for backward compatibility with anything external that
   references `NCZ_OFFICER` by name?
2. **Country Admin creation** — brief recommends Platform-Owner-only (§4.4.3). Confirming that's
   the answer before building the role-assignment guard around it.
3. **HELPDESK placement** — not in the brief's hierarchy at all. Proposing it stays a narrow,
   cross-country support role under Platform Owner governance (it only ever touches issue
   reports, not council/country-scoped data) — confirm or override.
4. **Impersonation** — brief flags this as a design question (§4.4.1); nothing like it exists in
   the codebase today, so this would be new functionality, not a fix. Confirm whether it's in
   scope for this pass or a later one.

See `docs/rbac-access-matrix.md` for the proposed resource × role matrix based on these findings,
ready for your review before any code changes.
