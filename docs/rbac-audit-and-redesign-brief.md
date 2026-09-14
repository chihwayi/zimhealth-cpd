# RBAC Security Audit & Redesign Brief
## Multi-Country Clinician CPD Platform

**Purpose of this document:** This is a working brief to hand to Claude Code. It asks Claude Code to (1) audit the current role/permission system for correctness and security gaps, and (2) implement a redesigned, cleaner role hierarchy — including a new **Platform Owner** role for the developer/maintainer that is separate from any country's operations.

Read this whole document before starting. Where the codebase doesn't match what's described here, flag the mismatch rather than assuming this document is correct — this is a design intent, not a guaranteed description of the current code.

---

## 1. System Context

This platform delivers **Continuing Professional Development (CPD)** to clinicians (nurses and doctors) across multiple countries in Southern Africa. Each country operates semi-independently:

- Each country has its own **regulatory council** (e.g., a Nurses & Midwives Council) that must approve CPD content before it's usable by clinicians in that country.
- Each country has its own **local admins** who manage day-to-day operations for that country only.
- Clinicians (nurses/doctors) in a country consume CPD content and earn credits/points toward that country's regulatory requirements.
- The whole platform is run by a single owner/developer (me) across all countries.

Because this is a regulated, multi-tenant system handling professional credentialing data, **cross-country data leakage or privilege escalation is a serious compliance risk**, not just a bug.

---

## 2. Target Role Hierarchy

Claude Code should treat this as the canonical hierarchy to audit against and refactor toward:

### Level 0 — Platform Owner (Global, non-country-specific)
This is me: the developer, maintainer, and owner of the entire system. Scope is **cross-country and infrastructure-level**. Not tied to any single country's operational data.

### Level 1 — Country Regulatory Council (per country)
E.g. "Zimbabwe Nurses Council", "Zambia Nursing & Midwifery Council", etc. Approves/rejects CPD content for their country only. Cannot touch infrastructure, other countries, or other councils' content.

### Level 2 — Country System Admin (per country)
Operational admin for one country. Manages that country's clinicians, course scheduling, local reporting, support tickets. Cannot see or affect other countries' data, and cannot touch platform-wide infrastructure/integrations.

### Level 3 — Clinician (Nurse / Doctor)
End user. Consumes approved CPD content, tracks their own credits, submits their own records. Scoped strictly to their own account and their own country's approved content.

### Level 4 (optional, if it exists in the codebase) — Content Author/Contributor
Creates draft content that goes into the approval queue for the relevant country's council. Should not be able to publish content directly.

**Golden rule to enforce everywhere:** a role can never act outside its own scope (own country, own account) unless it is explicitly Level 0 (Platform Owner). No role should be able to grant itself a higher role.

---

## 3. Part A — Audit the Existing Role System

Do this first, before any redesign work. Produce a written audit report (see Section 6 for the deliverable format) covering:

### 3.1 Inventory
- Enumerate every role/permission/group that currently exists in the codebase (auth config, DB seed data, middleware, decorators/guards, admin panel role definitions).
- For each role, list every route/endpoint/API/database table/UI screen it can currently reach — not what it's *supposed* to reach, what it *actually* can reach based on the code.
- Flag any role that exists in the database/config but is not referenced anywhere in access-control logic (dead or unenforced role).

### 3.2 Cross-role and cross-tenant clashes to check specifically
- **Country isolation leaks:** Can a Country Admin or Council member in Country A query, list, export, or view data (users, content, analytics, submissions) belonging to Country B? Check every list/search/report endpoint, not just obvious "get by id" ones — pagination and search endpoints are the most common leak point.
- **Horizontal privilege escalation:** Can a Country Admin promote themselves or another user to Platform Owner, or to admin of a different country?
- **Vertical privilege escalation:** Can a Clinician call an admin-only or council-only endpoint directly (e.g., by guessing a URL or reusing a token) and have it succeed because the check is only done in the frontend, not the backend?
- **Approval bypass:** Can content reach clinicians without passing through the correct country's Council approval step? Check for any admin action that can mark content "approved" or "published" without the council role being the actor.
- **Shared secrets / shared infrastructure exposure:** Does any Country Admin role currently have access (via env vars, admin UI, or API responses) to global secrets such as WhatsApp Business API tokens, AI/LLM API keys, payment gateway keys, or SMTP/email provider credentials? (This should be Platform-Owner-only — see Section 4.)
- **Session/token scope:** Does a JWT or session token encode the country_id and role in a way that's verified server-side on every request, or is it trusted client-side?
- **Admin panel route guards:** For every admin UI screen, confirm there's a matching server-side check — an admin panel screen being hidden in the UI is not a security control.
- **Audit logging:** Is there a log of who approved/rejected content, who changed a role, who accessed cross-country data (even legitimately, e.g., Platform Owner support access)? If not, flag it as a gap — for a regulated CPD product, this is likely to matter for compliance/audit purposes down the line.

### 3.3 Output for this part
A markdown table like:

| Role | Can currently access | Should access per hierarchy | Gap / Risk | Suggested fix |
|---|---|---|---|---|

Plus a short list of the top 5–10 highest-severity findings, ranked by exploitability and blast radius (e.g., "any Country Admin can list all countries' clinician PII via /api/users?all=true" is higher severity than a cosmetic UI leak).

---

## 4. Part B — Redesign: The Platform Owner Role

This is the core design decision. My own role (Platform Owner) should be defined as **global infrastructure and governance owner**, not as "super version of Country Admin." Country Admins should never need to touch, or be able to touch, the things below — pull these out of any Country Admin or Council role if they currently have access to them.

### 4.1 Exclusively Platform-Owner-controlled (move OUT of country-level roles)
- **WhatsApp Bot / Business API** — API keys, webhook config, message templates at the integration level, phone number provisioning. Country Admins may be allowed to *use* WhatsApp notifications (e.g., trigger a reminder to their clinicians) through an internal service, but must never see or edit the underlying API credentials or provider account.
- **AI/LLM API integrations** — API keys for any AI provider used for content generation, chat support, quiz generation, etc. Country Admins can request/toggle AI-assisted features per country if you want to allow that, but never hold or view the underlying keys.
- **Payment gateway / billing integrations** — keys, payout configuration, pricing engine.
- **Email/SMS provider credentials** (SendGrid, Twilio, etc.).
- **Infrastructure and environment configuration** — hosting, database credentials, backups/restores, deployment pipeline, feature flags, rate limits.
- **Country tenant provisioning** — creating a new country instance/tenant, assigning that country's first Council and Admin accounts, deactivating a country.
- **Global role assignment** — who gets to be a Council member or Country Admin in the first place. Country Admins should not be able to create other Country Admins or Council members even for their own country, unless you deliberately delegate that (see 4.3).
- **Cross-country reporting and global analytics** — aggregate views across all countries.
- **Global audit log access** — full visibility into every country's admin actions, for oversight.
- **Global content taxonomy/standards defaults** (categories, credit-point rules, templates) that individual countries customize from but don't fully own.
- **Support/impersonation access** — ability to log in as any user in any country for support/debugging purposes, with mandatory audit logging when used.

### 4.2 Left with Country Admin (per-country operational scope only)
- Managing clinician accounts within their own country (create, deactivate, reset access, view progress/credits).
- Scheduling/organizing which council-approved content is live for their country and when.
- Local reporting/analytics for their own country only.
- Handling local support tickets/queries from their own country's clinicians.
- Triggering (not configuring) notifications through the shared WhatsApp/email service for their own country's users.

### 4.3 Left with Country Council (per-country content governance only)
- Reviewing, approving, or rejecting submitted CPD content for their own country.
- Setting country-specific CPD credit requirements/rules within whatever global bounds you define.
- Viewing (not editing) clinician compliance/completion status for regulatory purposes in their own country.

### 4.4 Design questions to resolve explicitly in the redesign
Claude Code should ask/flag rather than silently assume on these:
1. Should Platform Owner ever be able to *impersonate* a Country Admin/Council for support purposes? If yes, this must be logged and probably time-limited/consent-based.
2. Should there be a "Regional Owner" tier between Platform Owner and Country Admin for someone who manages several countries but isn't you? (Not required now, but worth deciding if you'll ever delegate.)
3. Should Country Admins be able to invite/create Council members for their own country, or must that always come from Platform Owner? (Recommendation: Platform Owner only, at least initially — this is a governance/legitimacy boundary, not just a technical one.)
4. Do Council members need any technical account at all, or should council approval be a lightweight workflow (e.g., email/token-based approval) rather than a full admin account? Worth considering for reducing attack surface.

---

## 5. Language Localization (i18next) — Ownership Split

The system supports uploading a language file per country (no code changes required) to make translations available for that country. This is a hybrid case: part of it belongs to the Platform Owner (schema/infrastructure), part belongs to the Country Admin (content), and part needs Council sign-off (regulated wording). Treat these as three separate risk tiers, not one blanket "translations" permission.

### 5.1 Platform-Owner-only (schema & infrastructure level)
- **The canonical translation key set** — the full list of keys the application code actually references (e.g. `dashboard.welcome_message`, `cpd.credit_summary`). Country Admins must never be able to add, rename, or delete keys — doing so risks breaking screens for their own country, or for every country if the key store isn't properly scoped.
- **The upload/validation pipeline** — the tooling that ingests an uploaded language file and checks it against the canonical key set (missing keys, malformed placeholders/variables like `{name}`, encoding issues, unexpected extra keys) before anything goes live.
- **The default/fallback locale** (typically English) — the safety net every country falls back to when a translation is missing for a given key. This must be centrally maintained and never overwritten by a country-level upload.
- **Enabling a new language slot** on the platform (e.g. turning on Portuguese as an available language at all) — this is a structural/capacity change, not a translation edit, and should require Platform Owner action.
- **Rollback capability** — ability to revert a country's language file to a previous version if a bad upload goes live.

### 5.2 Country-Admin-controlled (content level, scoped to their own country only)
- Uploading/editing the actual translated strings for their country's enabled language(s).
- Previewing a translation in a staging/preview view before it goes live.
- Choosing which already-enabled platform languages are active for their own country (e.g. enabling both English and a local language for their clinicians).

### 5.3 Council-reviewed (regulated/compliance-sensitive strings only)
Not all strings carry equal risk. General UI copy ("Continue", "My Courses", navigation labels) is low-risk and an Admin can safely push it live directly. Strings tied to regulatory or compliance meaning — credit disclaimers, certification/completion wording, council-mandated phrasing, consent text — should route through the same country's Council for approval before going live, exactly like CPD content itself. A mistranslation here is a compliance risk, not just a UX one.

To support this split technically, the canonical key schema (5.1) should tag each key with a risk tier (e.g. `general` vs `regulated`) so the upload pipeline can automatically route regulated-tier strings into a Council approval queue instead of publishing them immediately.

### 5.4 Specific checks for Claude Code to run against the current i18n implementation
- **Schema drift:** Does the upload endpoint validate an incoming language file against the canonical key set, or does it accept and store arbitrary keys? Flag if arbitrary keys are accepted — this is how the key set silently drifts and starts breaking screens.
- **Country scoping:** Can a Country Admin's upload write to or overwrite another country's language file? Check the upload handler's country-scoping logic the same way you checked user/content endpoints in Section 3.2.
- **Fallback integrity:** Confirm the default locale file is not writable via any country-facing upload path.
- **Placeholder/variable safety:** Confirm the validator checks that dynamic placeholders (e.g. `{name}`, `{date}`) present in the source key are still present in the uploaded translation — a missing placeholder can crash a render or silently drop data at display time.
- **No code-path assumptions broken:** Confirm nothing in the app assumes a specific language file exists at a hardcoded path per country in a way that would bypass the validation pipeline (e.g. a direct file write instead of going through the upload/validation service).
- **Risk-tier tagging:** Does the current key schema (or can it easily) distinguish general UI strings from regulated/compliance strings? If not, this is a design gap — recommend adding tier metadata as part of the redesign rather than bolting on Council approval as an afterthought later.
- **Audit trail:** Is there a log of who uploaded which language file, when, and what changed versus the previous version (a diff)? If not, flag as a gap — this matters for the same compliance reasons as content-approval logging in Section 3.2.

---

## 6. Implementation Checklist for Claude Code

1. Produce the audit report described in Section 3 before changing any code.
2. Define/refactor a formal role & permission model (e.g., a `roles` and `permissions` table, or policy objects) that encodes exactly the hierarchy in Section 2 and the split in Section 4.
3. Enforce every permission check **server-side**, on every route/endpoint/query — never rely on frontend hiding of buttons/menus as the only control.
4. Add `country_id` scoping to every query that touches country-specific data, and add an automated test that tries to access another country's data with a Country Admin/Council token and asserts it fails (403/404).
5. Move all secrets/keys listed in Section 4.1 out of any per-country config and into a global, Platform-Owner-only config/secrets store (env vars, vault, etc.), inaccessible from country-scoped admin UI or API responses.
6. Add server-side role-elevation guards: no role can assign a role equal to or higher than itself; only Platform Owner can create Country Admins/Council members (unless you decide otherwise per 4.4.3).
7. Add or verify audit logging for: role changes, content approval/rejection, cross-country access by Platform Owner, and any secrets/config changes.
8. Write automated tests for each row of the access-control matrix (Section 6) — this becomes your regression suite so a future change can't silently reopen a leak.
9. Document the final role/permission matrix in the codebase (e.g., `docs/rbac.md`) so it stays a living reference, not just this one-off brief.
10. Add or tighten server-side validation on the language-file upload endpoint so it rejects any file introducing keys outside the canonical schema, and rejects uploads that target a country other than the uploader's own.
11. Add a risk-tier field (`general` / `regulated`) to the canonical key schema if it doesn't already exist, and route `regulated`-tier string changes into the same Council approval queue used for content, rather than publishing them immediately.
12. Add versioning/diff and rollback support for country language files, plus an audit log entry (who/when/what changed) for every upload.

---

## 7. Deliverables Expected Back From Claude Code

1. **Audit report** (markdown) — inventory + gap table + top-severity findings, as described in Section 3, including the i18n-specific checks in Section 5.4.
2. **Proposed access-control matrix** (markdown table: Resource/Action × Role × Allowed?) reflecting the Section 2/4 hierarchy, for my review *before* code changes are made to permissions. Include the language-localization actions from Section 5 as rows in this same matrix (canonical key schema, new-language enablement, per-country string upload, regulated-string approval) rather than treating them separately.
3. **Code changes** implementing the redesign, with a clear list of files touched and why.
4. **Test suite** covering the isolation and escalation scenarios in Section 3.2, plus the i18n scoping/validation scenarios in Section 5.4.
5. **`docs/rbac.md`** — the living reference document for the final role system, including the localization ownership split.

**Sequencing:** Do steps 1–2 before doing step 3. Getting the matrix right is cheap; changing it after code is written is expensive.
