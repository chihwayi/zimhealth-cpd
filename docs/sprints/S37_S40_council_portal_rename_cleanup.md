## S37–S40 Council Portal Rename + Cleanup

### Goal
Finish the council-portal generalization by renaming NCZ-specific routes/roles to generic council equivalents **without breaking existing integrations**.

### Current State (already council-scoped)
- UI has a generic portal route ` /council/* ` that reuses the existing portal component.
- Backend endpoints are still ` /api/ncz/* ` and role is still ` NCZ_OFFICER ` for backwards compatibility.

### Sprint Deliverables

#### 1) Rename backend routes (keep aliases)
- Add new router at ` /api/council/* ` with the same behavior as ` /api/ncz/* `.
- Keep ` /api/ncz/* ` as an alias that forwards to the same handlers (or mounts the same router twice).
- Ensure CSV download naming/headers stay council-agnostic (already mostly done).

#### 2) Rename role to `COUNCIL_OFFICER` (keep backward compatibility)
- Introduce `COUNCIL_OFFICER` role in Prisma schema.
- Allow both roles during transition:
  - `requireRole('COUNCIL_OFFICER', 'NCZ_OFFICER', 'ADMIN')`
- Migration plan for existing users:
  - Update existing `NCZ_OFFICER` users to `COUNCIL_OFFICER` once stable.

#### 3) Update web routing + labels
- Make the primary route ` /council/* ` for officers.
- Keep ` /ncz/* ` working (redirect to `/council/*` or keep both).
- Update UI text references:
  - "NCZ Officer" → "Council Officer"
  - "NCZ portal" → "Council portal"

#### 4) Tests
- Add/extend backend tests:
  - Officer can only access learners under their council via both ` /api/council/* ` and ` /api/ncz/* `.
- Ensure `pnpm test`, `pnpm build`, migrations and seed all pass.

