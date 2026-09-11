# Sprint 05 — NCZ sync integration spec

**Track:** Backend + Docs. **Priority:** P0. **Depends on:** nothing. **Note:** this sprint has a hard external dependency — NCZ must eventually provide a real endpoint. The AI-agent-doable part is everything short of that.

## Goal
Turn `backend/src/services/ncz-sync.ts` (currently dry-run-only, no real endpoint to call) into a documented, testable integration contract that can be handed to NCZ's IT team, plus a mock server so the flow can be demoed end-to-end without a real NCZ API.

## Why
The proposal claims "automated point sync with NCZ" and "system integration with NCZ's existing registration databases." The code is real and well-built (idempotency keys, retry/backoff, batching) but has never talked to a live external endpoint. Gap analysis §1 claim #11.

## Scope
1. **Write the integration spec**: `docs/integrations/ncz-sync-api-spec.md` — derive this directly from `backend/src/services/ncz-sync.ts` (read the payload shape it builds: `learnerName, registrationNumber, councilIdentifier, cycleYear, pointsEarned, activityReference, completedAt, recordId`, the `X-Idempotency-Key` header, and the `COUNCIL_SYNC_API_URL`/`COUNCIL_SYNC_API_KEY` env vars it expects). Document: request/response shape, expected HTTP status codes, retry semantics, idempotency guarantee, batch size limit (currently 100 — confirm in code).
2. **Build a mock NCZ endpoint** for demo purposes: a small Express route (e.g. `backend/src/routes/dev/mock-ncz-registry.ts`, mounted only when `NODE_ENV !== 'production'`) that accepts the documented payload, logs it, and returns a plausible success response — so the full sync flow (`syncWorker.ts` → `ncz-sync.ts` → mock endpoint) can be demonstrated live without waiting on NCZ.
3. Point `COUNCIL_SYNC_API_URL` in a `.env.demo` example at this mock endpoint, so a demo environment shows the "integration" working end-to-end.
4. Add a short section to `docs/integrations/ncz-sync-api-spec.md` titled "What NCZ needs to provide" — the two env vars, and the expected real endpoint contract, so this doc can be emailed to NCZ's technical counterpart directly.

## Non-goals
- Do not attempt to guess or build against a real NCZ API — none exists yet. This sprint produces the spec and a mock, not a live integration.
- Do not change the retry/idempotency logic in `ncz-sync.ts` unless testing reveals a bug.

## Acceptance criteria
- [ ] `docs/integrations/ncz-sync-api-spec.md` exists, accurately reflects the current code (verified by reading `ncz-sync.ts` and `syncWorker.ts`, not guessed).
- [ ] Mock endpoint exists, is dev/demo-only (never mounted in production), and successfully receives a batch when `COUNCIL_SYNC_API_URL` points at it locally.
- [ ] Running the sync job against the mock endpoint transitions `CPDRecord.nczSyncStatus` from unsynced to synced, observable in the DB.

## Verification
- Set `COUNCIL_SYNC_API_URL=http://localhost:4000/dev/mock-ncz-registry` and `COUNCIL_SYNC_API_KEY=demo` locally, trigger the sync job manually (check `backend/src/jobs/syncWorker.ts` for how it's invoked — likely a Bull queue job you can enqueue via a script or admin endpoint), confirm records flip to synced status and the mock logs the batch.
