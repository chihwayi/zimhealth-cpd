# Council CPD Sync — Integration Spec

**Status:** Infrastructure built and tested against a mock endpoint (`backend/src/routes/dev/mock-council-registry.ts`, non-production only). Never yet connected to a real regulatory council registry — this document exists so that can happen.

**Source of truth:** this spec is derived directly from `backend/src/services/ncz-sync.ts` and `backend/src/jobs/syncWorker.ts`. If the code changes, update this doc — do not let it drift.

## What this is

ZimHealth CPD needs to push completed CPD activity records to each regulatory council's own registration system, so a nurse's council-held file reflects their CPD compliance without manual re-entry. This document specifies the contract our system expects on the receiving end.

Despite the "ncz" naming in the codebase (a holdover from when the platform was Zimbabwe-only — see the pan-African pivot notes), this integration is council-agnostic: the `councilIdentifier` field in the payload distinguishes which council a record belongs to, so the same integration can serve NCZ, MDPCZ, or any other council's registry, each with its own `COUNCIL_SYNC_API_URL`/`COUNCIL_SYNC_API_KEY` if councils don't share a registry.

## Trigger and cadence

- **Scheduled:** a Bull queue job (`backend/src/jobs/syncWorker.ts`) runs on a cron schedule, default `0 2 * * *` (daily at 02:00), configurable via `COUNCIL_SYNC_SCHEDULE` (or the legacy `NCZ_SYNC_SCHEDULE`).
- **Manual:** `POST /api/council/sync/trigger` (aliased at `/api/ncz/sync/trigger`), auth-gated to `NCZ_OFFICER`, `COUNCIL_OFFICER`, or `ADMIN`. Accepts `?onlyFailed=true` to retry only previously failed records.
- **Single-record retry:** `POST /api/council/sync/retry/:id`, same auth gate, for retrying one `CPDRecord` by id.

## Request

**Endpoint:** `POST {COUNCIL_SYNC_API_URL}/cpd-records`

**Headers:**
| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `x-api-key` | `COUNCIL_SYNC_API_KEY` value |
| `X-Idempotency-Key` | `batch-<epoch-ms>` for scheduled/bulk syncs, `retry-<recordId>-<epoch-ms>` for single-record retries |

**Body:**
```json
{
  "records": [
    {
      "learnerName": "Grace Moyo",
      "registrationNumber": "NCZ-2021-001234",
      "councilIdentifier": "NCZ",
      "cycleYear": 2026,
      "pointsEarned": 3,
      "activityReference": "Essential Infection Prevention and Control",
      "completedAt": "2026-09-01T10:15:00.000Z",
      "recordId": "cljk3x9p10000abc123def456"
    }
  ]
}
```

**Field contract** (validated locally with Zod before sending — see `SyncRecordSchema` in `ncz-sync.ts`):

| Field | Type | Notes |
|---|---|---|
| `learnerName` | string, min 1 char | Full name on file |
| `registrationNumber` | string, min 1 char | The learner's council registration number (`User.nczRegistrationNumber`). Records without one are never sent — see "Blocked records" below. |
| `councilIdentifier` | string, min 1 char | Council acronym, e.g. `"NCZ"`. Falls back to `"NCZ"` if the learner has no council relation, for backwards compatibility with pre-multi-council data. |
| `cycleYear` | integer | The CPD cycle year the points count toward |
| `pointsEarned` | number | Points earned for this specific activity |
| `activityReference` | string | Course title if the record is tied to a course, otherwise the raw `activityType` enum value |
| `completedAt` | string, ISO 8601 datetime | When the activity was completed |
| `recordId` | string | ZimHealth CPD's internal `CPDRecord.id` — echo this back if reporting per-record errors, so we can reconcile |

**Batch size:** up to 100 records per request (`take: 100` in the unsynced-records query — this bounds the query, not a hard API contract, but the receiving end should assume batches of this size).

## Expected response

- **Success:** any 2xx status. The JSON response body (if any) is stored verbatim in `CPDRecord.nczSyncMetadata` for audit purposes — no specific response shape is required, but a per-record acknowledgment (e.g. `{ "accepted": ["<recordId>", ...] }`) is recommended so partial-batch failures can be identified in future iterations. **Current code treats the whole batch as succeeded or failed together** — there is no per-record success/failure handling on our side yet.
- **Failure:** any non-2xx status. Our code throws with the status code and raw response body, marks every record in the batch `FAILED` with the error message, and logs a failed `NczSyncLog` entry. The whole batch is retried on the next scheduled run (or via `onlyFailed=true`).

## Idempotency

Every request carries an `X-Idempotency-Key` header, unique per batch (or per retry). The receiving system should treat a repeated request with the same idempotency key as a no-op if it already processed that batch — this protects against double-crediting a learner's CPD file if a request is retried after a timeout with an ambiguous outcome on our side.

**Caveat found while writing this spec:** the idempotency key is generated fresh (`Date.now()`-based) for every call, including retries of the exact same record set — so if `runCouncilSync` is invoked twice for the same unsynced batch (e.g. two overlapping manual triggers), each invocation gets a *different* idempotency key even though the underlying records are the same. This means idempotency currently only protects against network-level retries within a single `fetch` call, not against two independent invocations of the sync job. Not a blocker for this sprint (out of scope per the sprint's non-goals — no changes to retry/idempotency logic), but worth knowing before assuming stronger guarantees than actually exist.

## Local record statuses (`CPDRecord.nczSyncStatus`)

| Status | Meaning |
|---|---|
| `PENDING` | Not yet synced (default) |
| `BLOCKED_MISSING_NCZ` | Learner has no `nczRegistrationNumber` on file — never sent, needs the learner to add one |
| `SYNCED` | Successfully sent and acknowledged |
| `FAILED` | Sent but the council API returned an error, or the record failed local contract validation |

## Sync modes (`getSyncMode()`)

| Mode | When | Behavior |
|---|---|---|
| `disabled` | `COUNCIL_SYNC_ENABLED=false` | Sync job is a no-op |
| `live` | Both `COUNCIL_SYNC_API_URL` and `COUNCIL_SYNC_API_KEY` are set | Real HTTP POST to the configured endpoint |
| `dry_run` | Either env var is missing (default state today) | Validates and batches records, logs the count, but never sends — nothing is marked `SYNCED` |

## What NCZ (or any council) needs to provide

To move from `dry_run` to `live`:
1. An HTTPS endpoint accepting `POST {base_url}/cpd-records` matching the request contract above.
2. An API key for us to send as `x-api-key`.
3. Confirmation of what registration number format they expect in `registrationNumber` (we currently send whatever is stored in `User.nczRegistrationNumber`, unvalidated against any external format).
4. A decision on whether they want per-record acknowledgment in the response (recommended, not currently required by our code) — if they want it, flag it so we can extend `ncz-sync.ts` to handle partial-batch outcomes instead of all-or-nothing.

Once both env vars are set (`COUNCIL_SYNC_API_URL`, `COUNCIL_SYNC_API_KEY`), sync mode flips to `live` automatically — no code changes or redeploy needed.

## Demo / local testing without a real council API

A mock endpoint exists at `backend/src/routes/dev/mock-council-registry.ts`, mounted only when `NODE_ENV !== 'production'`. It implements the contract above: accepts the batch, logs it, and returns a 200 with a plausible acknowledgment body. Point `COUNCIL_SYNC_API_URL` at it locally (e.g. `http://localhost:4000/dev/mock-council-registry`) and set any non-empty `COUNCIL_SYNC_API_KEY` to exercise the full `live`-mode code path — including real HTTP calls, header construction, and status transitions — without needing a real council partner.
