# Sprint 07 — Institution bulk-enrollment dashboard

**Status: DONE (2026-09-14).** `Voucher` gained `inviteeEmail`/`inviteePhone`, `VoucherBatch` gained an optional `institutionContactId` (resolved from an email an admin enters, no separate lookup UI needed). New `/api/institutions/{my-batches,:id/roster,:id/invite}` endpoints, access-checked to the batch's creator/institution contact/ADMIN (403 otherwise). Invite assigns existing spare codes rather than minting past `totalCount` — a real bug caught during local testing and fixed before shipping. Web page at `/institution` (roster table + invite form), reachable from every role's sidebar since the institution contact can be any registered user, not just admins. New `institutions.test.ts` (6/6 passing); full suite 41/42 (1 pre-existing unrelated flake, same as Sprint 04). Verified end-to-end both locally and live in production: created an INSTITUTION-tier batch as admin with a contact set by email, invited staff as that non-admin contact, confirmed the roster showed the invitee before redemption, and confirmed a 403 for an unrelated user.

**Track:** Backend + Web. **Priority:** P1. **Depends on:** nothing.

## Goal
Let a hospital/institution admin bulk-enroll their staff and see aggregate compliance, building on the existing `VoucherBatch`/`Voucher` sponsored-access model.

## Why
Global CPD platforms let employers track staff compliance in one view. The platform already has voucher batches for NGO sponsorship (`VoucherBatch`, `Voucher` in `backend/prisma/schema.prisma` — check exact fields before extending) but no employer-facing dashboard on top of it. Gap analysis §4 ("Employer/institution view" row).

## Scope
- Confirm `SubscriptionTier.INSTITUTION` (already in the `SubscriptionTier` enum) is the intended vehicle for this — check `backend/src/services/payments.ts` for how `INSTITUTION` tier currently behaves versus `FREE`/`STANDARD`/`DIASPORA`.
- Backend: add an `institutionId` or reuse `VoucherBatch` as the "institution" grouping (read `VoucherBatch` schema first — it likely already has a `name`/`organization` field for NGO batches; reusing it avoids a new model).
- New endpoint `GET /api/institutions/:batchId/roster` (auth: whoever owns/administers that batch, plus `ADMIN`) returning enrolled learners, their compliance status (reuse `getLearnerCPDSummary`), and voucher redemption status.
- New endpoint `POST /api/institutions/:batchId/invite` to bulk-add staff by email/phone, generating voucher codes for each (reuse existing voucher generation logic from `backend/src/routes/vouchers.ts` — do not duplicate it).
- Web: a new page under `apps/web/src/pages/institution/` (or extend the admin voucher management UI if one exists at `apps/web/src/pages/admin/`) showing the roster table and an invite form.

## Non-goals
- Do not build a self-serve institution signup flow (billing/contracting an institution is a sales process, not this sprint) — assume an admin manually creates the `VoucherBatch` for now, same as today.
- Do not build SSO/SAML for institutions — out of scope.

## Acceptance criteria
- [ ] An admin can create a voucher batch, bulk-invite 5 staff by email, and see all 5 appear on the roster (even before they redeem).
- [ ] Roster view shows redemption status and, post-redemption, CPD compliance status per staff member.
- [ ] Access to a batch's roster is restricted to its administering user + `ADMIN`.

## Verification
- Manual flow test in dev: create batch → invite → redeem as a test learner → confirm roster reflects redemption and points.
- `cd backend && pnpm test` — add route tests for the two new endpoints (happy path + unauthorized access).
