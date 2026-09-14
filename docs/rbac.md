# RBAC — Role & Permission Model

Living reference for the role system. If you change a permission boundary, update this file in
the same commit. Background/rationale: `docs/rbac-audit-and-redesign-brief.md` (original request),
`docs/rbac-audit-report.md` (audit findings), `docs/rbac-access-matrix.md` (design proposal this
was implemented from).

## Roles

| Role | Scope | Who |
|---|---|---|
| `PLATFORM_OWNER` | Global — cross-country, infrastructure, governance | The developer/operator. One seeded account: `admin@zimhealthcpd.co.zw`. |
| `COUNTRY_ADMIN` | One country's operations only (`User.countryCode`) | Created by Platform Owner only. New tier — no prod accounts yet beyond the demo seed. |
| `COUNCIL_OFFICER` | One council's content governance + compliance (`User.councilId`) | Merged from the legacy `NCZ_OFFICER` (Zimbabwe-only naming) — every route already treated them identically before the merge. |
| `CONTENT_MANAGER` | Own draft content only | Cannot publish directly — publishing is the approving council's action. |
| `LEARNER` | Own account only | End user (nurse/doctor). |
| `HELPDESK` | Issue-report triage, cross-country | Reports to Platform Owner. Not council/country scoped — it never touches learner PII or content, only issue tickets. |

`countryCode` (ISO 3166-1 alpha-2) is only meaningful on a `COUNTRY_ADMIN` account. Learners and
council officers derive their country via `council.countryCode` instead — see
`countryScopeWhere()` in `backend/src/routes/admin.ts`.

## Golden rules enforced server-side

1. **Publishing a course is exclusively the approving council's action.** `POST
   /api/courses/:id/approve` (Platform Owner) can only `REJECT` (policy takedown), never
   `APPROVE`. A course only becomes `PUBLISHED` via `POST
   /api/ncz/courses/:courseId/reviews/approve` (aliased at `/api/council/...`), scoped to the
   approving officer's own `councilId`. See `backend/src/routes/ncz.ts`.
2. **No self-service role escalation.** `backend/src/lib/roles.ts`'s `ASSIGNABLE_ROLES` map is the
   single source of truth for who can grant which role:
   - `PLATFORM_OWNER` → any role.
   - `COUNTRY_ADMIN` → `CONTENT_MANAGER` / `HELPDESK` only, and only for users already inside
     their own country scope.
   - Every other role → cannot assign any role.
   Enforced in `PATCH /api/admin/users/:id` via `canAssignRole()`. A user can never change their
   own role.
3. **Country Admin is hard-scoped server-side, not just hidden in the UI.** `GET/PATCH/DELETE
   /api/admin/users*`, `POST/GET /api/vouchers/batches*` all apply `countryScopeWhere()` /
   `createdById` ownership checks for `COUNTRY_ADMIN` actors — a request for another country's
   data returns 403/empty, never 200 with foreign data.
4. **Secrets and infrastructure never leave Platform Owner.** AI/system config
   (`/api/admin/config/*`), global audit log, cross-country analytics, council tenant
   provisioning (`/api/councils`), and the canonical i18n key schema/fallback locale
   (`/api/locales`) are `PLATFORM_OWNER`-only — `COUNTRY_ADMIN` was deliberately never added to
   these routes.
5. **JWT role is verified server-side on every request**, never trusted from the client
   (`auth.middleware.ts`). `councilId`/`countryCode` scoping is re-fetched fresh from the DB per
   request, not embedded in the token, so a role/council change takes effect immediately.

## Impersonation

`POST /api/auth/impersonate/:userId` — `PLATFORM_OWNER` only. Issues a **30-minute,
non-refreshable** token carrying an `impersonatedBy` claim (the real actor's user id). Cannot
target another `PLATFORM_OWNER`. Every start is audit-logged (`IMPERSONATION_STARTED`,
`entityId` = target user, `userId` = the real Platform Owner); `POST
/api/auth/impersonate/end` logs `IMPERSONATION_ENDED` when explicitly stopped. `GET /api/auth/me`
returns `impersonating: true` while an impersonation token is active, which the frontend uses to
show a persistent "Viewing as..." banner (`AppShell.tsx`) with a one-click restore
(`useAuthStore.stopImpersonation()`).

Not yet built (deliberately out of scope for this pass): a general "act on behalf of, with the
real actor's audit trail attached to every subsequent mutation" mechanism — today only the
start/end of the session is logged, not each individual action taken while impersonating.

## Access matrix

See `docs/rbac-access-matrix.md` for the full resource × role table this implementation follows.
The two rows worth calling out because they're easy to get wrong on a future change:

- **"Publish course"**: 🚫 for every role including `PLATFORM_OWNER` — only `COUNCIL_OFFICER`,
  and only via the review-approval endpoint, never a direct status PATCH.
- **Course visibility (learner-facing)**: gated by `course-eligibility.ts`'s
  `buildEligibleCourseWhere()`, which requires the learner's *own* council to have an `APPROVED`
  `CouncilCourseReview` with `points` set — `Course.status === 'PUBLISHED'` alone is not
  sufficient. **Every code path that lists/serves courses to a learner must use this helper**,
  including the WhatsApp bot (`bot.ts`) — a bypass here was audit finding's practical impact:
  `Course.status` could reach `PUBLISHED` with zero approvals, and `bot.ts` used to trust that
  flag directly instead of re-checking council approval.

## Frontend nav auto-filters by role

`AdminDashboard.tsx`'s `ADMIN_SECTIONS` array carries a `roles` field per tab that mirrors the
backend `requireRole(...)` guard on the endpoint(s) that section actually calls. The component
filters its own tab bar/dropdown to `visibleSections` for the current user's role and
redirects away from any URL for a section outside that list (e.g. a `COUNTRY_ADMIN` landing on
`/admin` gets redirected to `/admin/users`, the first section they can use). `Sidebar.tsx` has a
matching `COUNTRY_ADMIN_NAV` (Dashboard/Users/Vouchers only) instead of reusing the full
`ADMIN_NAV`. If you add a new admin section, add its `roles` in both places — the backend guard is
the actual security boundary, these are just keeping the UI honest about what will succeed.

## Known gaps / deliberately deferred

- Per-action audit attribution during an impersonation session (see above).
- `HELPDESK` issue triage has no country scoping — this is intentional per product decision
  (helpdesk reports to Platform Owner directly, cross-country), not a gap.
- `VoucherBatch` has no `countryCode` of its own; `COUNTRY_ADMIN` voucher scoping is by
  `createdById` ownership rather than true country membership (a country could have multiple
  Country Admins who wouldn't see each other's batches). Fine for the current one-admin-per-country
  reality; revisit if that changes.
