# S31-S32 Media Processing + PDF Guideline Ingestion Launch Closure

> Purpose: close the last two high-severity launch gaps so the web platform can be honestly treated as feature-complete before mobile work begins.
>
> This sprint is mandatory if the product promise includes:
> - creator/admin video upload and processing
> - guideline-to-course generation from official documents
>
> Frontend source of truth: `/Users/devoop/Dev/personal/zimhealth-cpd/docs/UI_UX_STANDARDS.md`
>
> This sprint must be implemented so deployment environment changes happen through env/config only. No code edits should be required per environment.

---

## 1. Why This Sprint Exists

Two launch blockers remain:

1. `backend/src/jobs/mediaWorker.ts` still uses a production stub.
   The worker currently marks video assets as processed without actually downloading, transcoding, validating, generating derivatives, or re-uploading output artifacts.

2. `backend/src/routes/ai.ts` still rejects PDFs.
   URL ingestion currently accepts only HTML or plain text. If official national health guidelines are distributed as PDF files, the "generate from official guidelines" promise is only partially true.

Until both are fixed, the product should not be described as fully complete.

---

## 2. Sprint Goal

Deliver a real, production-ready implementation for:

1. Video processing from uploaded source asset to usable output artifacts.
2. Guideline ingestion from PDF sources in addition to HTML/plain text.
3. Admin/content-manager UX and observability needed to operate both flows safely in production.
4. Environment-driven deployment so storage, queue, AI, and extraction behavior are controlled by config and not hard-coded.

---

## 3. Source Of Truth Rules

These rules are mandatory throughout this sprint:

1. `docs/UI_UX_STANDARDS.md` is the UI/UX source of truth for all new or adjusted web screens, cards, empty states, loading states, and error states.
2. No raw production URLs, bucket URLs, support contacts, or environment-specific endpoints may be hard-coded in runtime flows.
3. New backend behavior must be configurable through env variables with safe defaults for local development.
4. Every new async flow must expose clear status transitions, failure reasons, retry behavior, and auditability.
5. Every fetch-driven UI added or changed in this sprint must support loading, empty, error, and success states.

---

## 4. Scope Summary

This sprint is split into two main workstreams and two supporting workstreams:

1. Workstream A: Real media processing pipeline
2. Workstream B: PDF guideline ingestion pipeline
3. Workstream C: Operator UX, status surfaces, and review tools
4. Workstream D: Hardening, telemetry, security, and launch sign-off

All four must be completed for this sprint to count as done.

---

## 5. Workstream A: Real Media Processing Pipeline

### A.1 Product outcome

When a content creator or admin uploads a video:

1. the original asset is stored safely
2. a background job downloads the original source
3. the video is validated
4. derivative outputs are generated
5. outputs are uploaded back to storage
6. metadata is saved
7. the asset status becomes usable in the creator experience
8. failures are visible and retryable

### A.2 Required backend deliverables

Replace the stub in `backend/src/jobs/mediaWorker.ts` with a real implementation.

Required capabilities:

1. Download original media from object storage using env-driven bucket/config helpers.
2. Store temporary working files in OS temp storage and guarantee cleanup on success and failure.
3. Validate source file before processing:
   - file exists
   - MIME/type is allowed
   - duration is within configured limits
   - file size is within configured limits
   - codec/container can be handled or is rejected cleanly
4. Extract media metadata:
   - duration
   - width
   - height
   - codec
   - audio presence
   - file size
5. Generate production outputs:
   - at minimum one streaming-safe MP4 output
   - optional multi-resolution outputs if the current product model expects them
   - poster/thumbnail image
   - optional preview clip if useful and easy to support
6. Upload processed artifacts back to storage under deterministic, env-safe keys.
7. Persist artifact metadata in the database:
   - processed output key/url
   - poster key/url
   - duration
   - dimensions
   - processing status
   - processing failure reason if any
   - processed timestamp
8. Mark the asset as processed only after uploads and DB persistence succeed.
9. Mark the asset as failed if any stage fails.
10. Support retry without duplicating corrupted records or orphaned temp files.

### A.3 Data model requirements

If the schema is currently too thin, add the required fields. At minimum the media asset model should support:

1. lifecycle status:
   - `UPLOADED`
   - `PROCESSING`
   - `PROCESSED`
   - `FAILED`
2. original asset key
3. processed asset key
4. poster/thumbnail key
5. MIME type
6. file size
7. duration seconds
8. width
9. height
10. processing error message
11. processing started/finished timestamps
12. optional JSON metadata for variants

Do not keep boolean-only state if a proper lifecycle enum is needed.

### A.4 Queue and job behavior

The media queue must support:

1. retry with capped attempts
2. exponential or bounded backoff
3. idempotent handling where possible
4. structured logging with `assetId`, job id, stage, and duration
5. dead-letter visibility or explicit failed-state persistence
6. concurrency set by env, not hard-coded if production needs tuning

### A.5 Storage and env requirements

Add any missing env variables to `.env.example` and actual config loading. Examples:

1. `MEDIA_MAX_UPLOAD_MB`
2. `MEDIA_MAX_DURATION_SECONDS`
3. `MEDIA_ALLOWED_VIDEO_MIME_TYPES`
4. `MEDIA_PROCESSING_CONCURRENCY`
5. `MEDIA_TRANSCODE_PRESET`
6. `MEDIA_OUTPUT_FORMAT`
7. `MEDIA_ENABLE_MULTI_RESOLUTION`
8. `MEDIA_THUMBNAIL_AT_SECONDS`
9. `MEDIA_TEMP_DIR` if needed

If ffmpeg/ffprobe paths are needed in deployment, make them env-configurable. Do not hard-code machine-specific paths.

### A.6 API and creator workflow requirements

Any upload or asset-status endpoint touched by this sprint must:

1. return the current processing status explicitly
2. expose failure reason if processing failed
3. allow safe retry for failed assets
4. prevent publishing content that still depends on failed or still-processing required media

### A.7 Frontend requirements

Any creator/admin media UI impacted by this sprint must follow `docs/UI_UX_STANDARDS.md`.

Required UX:

1. Clear asset status badges:
   - Processing
   - Ready
   - Failed
2. Loading state while status is being fetched.
3. Empty state if no assets exist.
4. Inline persistent error state for failed media with retry action.
5. Success toast when a retry is queued or a replacement upload succeeds.
6. Thumbnail/poster preview if generated.
7. Do not display fake "ready" state before processing completes.

Suggested card pattern:

1. white card container with `bg-white border border-slate-200 rounded-xl shadow-sm p-6`
2. status chip using role-safe colors
3. metadata rows in `text-sm text-slate-600`
4. error block using red-tinted alert card rules from the standards doc

### A.8 Acceptance criteria

Workstream A is done only when:

1. a newly uploaded valid video moves through `UPLOADED -> PROCESSING -> PROCESSED`
2. processed file is actually playable from stored output
3. poster/thumbnail is generated and visible where expected
4. invalid or unsupported media fails gracefully with actionable error text
5. retry works for recoverable failures
6. no temp files are left behind after processing
7. no hard-coded production URLs are introduced
8. tests cover the lifecycle and failure states

---

## 6. Workstream B: PDF Guideline Ingestion Pipeline

### B.1 Product outcome

A content manager or admin can ingest an official guideline from:

1. pasted text
2. HTML URL
3. plain text URL
4. PDF URL
5. optionally direct PDF upload if the repo already has upload primitives and this can be added cleanly

The extracted text is normalized, previewable, and then passed into course generation safely.

### B.2 Required backend deliverables

Extend `backend/src/routes/ai.ts` and supporting services to support PDFs.

Required capabilities:

1. Detect PDF content using:
   - content type
   - URL extension as fallback only
   - file signature/magic bytes if content type is wrong
2. Fetch PDF source safely with timeout and size limits.
3. Extract text from PDF using a production-suitable library or service.
4. Preserve readable structure as much as possible:
   - headings
   - lists
   - paragraph breaks
5. Normalize the extracted text:
   - remove repeated headers/footers where possible
   - collapse excessive whitespace
   - keep section boundaries meaningful
6. Reject image-only or unreadable PDFs with a clear message.
7. Reject oversized PDFs with a clear message.
8. Record ingestion diagnostics:
   - source type
   - extraction success/failure
   - extracted character count
   - warning count
9. Continue to support HTML and plain text ingestion without regression.

### B.3 Optional but strongly recommended capability

Add a preview step before course generation:

1. show extracted title/source
2. show source type: text, html, pdf
3. show extracted character count
4. show a preview excerpt
5. allow the user to confirm before generating a course

This significantly reduces bad AI generations from broken extraction.

### B.4 Security and fetch constraints

The PDF ingestion path must include:

1. request timeout
2. response size cap
3. allowed protocol restriction to `http` and `https`
4. SSRF protection strategy
5. rejection of private/internal addresses if remote URL fetching is exposed to users
6. logging without leaking sensitive document contents

### B.5 AI content generation safety improvements

When extracted text comes from PDFs, improve the pre-generation pipeline:

1. trim boilerplate before sending to AI
2. store the normalized source text or an auditable source snapshot if product rules allow
3. if the text is too noisy, fail before generation rather than sending junk to AI
4. surface warnings when extraction quality is low

### B.6 Frontend requirements

Any content-manager/admin ingestion UI changed by this sprint must follow `docs/UI_UX_STANDARDS.md`.

Required UX:

1. Explicit source options:
   - Paste text
   - Enter URL
   - PDF URL
   - optional Upload PDF
2. Clear helper text describing supported formats.
3. Loading state during fetch and extraction.
4. Error state with plain-language explanation for:
   - PDF unreadable
   - URL unreachable
   - source too short
   - extracted text too poor for generation
5. Preview card before generation if preview step is implemented.
6. Success toast when a draft course is created.
7. No silent failures and no generic dead-end messages.

Suggested visual treatment:

1. use standard white cards
2. use tab switcher pattern if multiple input methods are presented
3. use persistent red alert blocks for extraction failures
4. use centered empty state if no previous ingestions exist

### B.7 Acceptance criteria

Workstream B is done only when:

1. a real PDF URL can be ingested successfully
2. extracted text is long enough and clean enough for course generation
3. an unreadable or image-only PDF fails with a useful error
4. HTML and plain text ingestion still work
5. no SSRF-style obvious unsafe fetch path is introduced
6. tests cover all supported source types and key failure cases

---

## 7. Workstream C: Operator UX, Review, and Visibility

This sprint is not complete if the flows work only in the backend but operators cannot understand what happened.

### C.1 Media visibility requirements

Provide a status surface for media assets used by creators/admins:

1. current processing status
2. uploaded time
3. processed time
4. duration and resolution once ready
5. failure reason if failed
6. retry action if allowed

### C.2 Guideline ingestion visibility requirements

Provide a status/review surface for content managers/admins:

1. source type
2. source URL or label
3. extraction status
4. extracted size/quality summary
5. generation outcome
6. failure reason if any

### C.3 UX quality bar

All new or touched screens must:

1. match existing portal role identity colors
2. use tokenized colors from `docs/UI_UX_STANDARDS.md`
3. include loading, empty, success, and error states
4. avoid clutter and scaffold-like layout
5. use toasts only for transient success/info, not for persistent failure details

---

## 8. Workstream D: Hardening, Telemetry, and Launch Sign-Off

### D.1 Observability

Add structured logs and, if the app already supports it, metrics for:

1. media job started/completed/failed
2. processing duration
3. input size and output size
4. PDF fetch started/completed/failed
5. extraction duration
6. extracted text length
7. generation success/failure by source type

### D.2 Admin-safe failure messages

Operator-visible failures must be:

1. understandable
2. actionable
3. non-secret

Do not expose stack traces to end users.

### D.3 Env-driven deployment check

Before sign-off, verify:

1. storage bucket names come from env
2. public asset base URLs come from env/config helpers
3. AI model/provider settings come from env
4. PDF limits and media limits come from env
5. queue/redis settings come from env
6. no environment-specific URLs are hard-coded in runtime logic

### D.4 Documentation updates required

Update:

1. `.env.example`
2. any deployment/setup docs that mention worker dependencies
3. any operator/admin usage docs for media and guideline ingestion

If ffmpeg, poppler, or another system dependency is required, document it explicitly for local and production environments.

---

## 9. Implementation Plan By Micro-Sprint

## S31A - Media Domain + Schema Hardening

Deliver:

1. media asset lifecycle/status model
2. schema updates and migrations
3. repository/service updates to use explicit statuses
4. env additions for media constraints

Done when:

1. schema supports full lifecycle
2. existing upload flows still work
3. type-check and migrations pass

## S31B - Real Video Worker

Deliver:

1. S3/object-storage download
2. ffprobe metadata extraction
3. ffmpeg transcode path
4. poster/thumbnail generation
5. processed upload and metadata persistence
6. temp-file cleanup

Done when:

1. a test video is truly processed
2. DB shows correct metadata
3. logs and failure handling are in place

## S31C - Creator/Admin Media UX

Deliver:

1. status badges
2. processing/failed/retry states
3. poster preview
4. publish guards for broken media

Done when:

1. creator/admin can tell exactly what happened to a video
2. UI matches `docs/UI_UX_STANDARDS.md`

## S32A - PDF Extraction Backend

Deliver:

1. PDF type detection
2. PDF fetch with limits and timeout
3. text extraction service
4. normalization pipeline
5. robust error handling

Done when:

1. a real PDF guideline becomes usable text
2. bad PDFs fail clearly

## S32B - Ingestion UX + Preview

Deliver:

1. source-type aware form improvements
2. extraction preview card
3. quality/failure feedback
4. draft generation flow polish

Done when:

1. content manager can confidently ingest guideline text before generation
2. UI follows `docs/UI_UX_STANDARDS.md`

## S32C - Final Hardening + Launch Gate

Deliver:

1. test coverage
2. observability
3. docs updates
4. env audit
5. launch checklist pass

Done when:

1. both workstreams pass acceptance criteria
2. no runtime hard-coded deployment values remain in touched areas

---

## 10. Required Test Matrix

This sprint is not done without tests.

### Media tests

1. uploads valid MP4 and processes successfully
2. unsupported file type fails cleanly
3. oversized file fails cleanly
4. corrupt video fails cleanly
5. retry on transient failure succeeds
6. poster generation works
7. status transitions are correct
8. temp files are cleaned

### PDF ingestion tests

1. valid PDF URL ingests successfully
2. valid HTML URL still ingests successfully
3. valid plain text URL still ingests successfully
4. PDF with no extractable text fails with useful error
5. timeout path returns useful error
6. oversized PDF returns useful error
7. malformed URL is rejected
8. private/internal URL protections work if implemented at route layer

### UI tests

1. media card renders loading state
2. media card renders failed state
3. media card renders ready state with metadata
4. ingestion form renders source-specific validation
5. extraction preview displays correctly
6. retry actions and create-draft actions trigger correct feedback

### End-to-end tests

1. upload video -> worker processes -> creator sees ready state
2. ingest PDF guideline -> preview/validate -> generate draft course

---

## 11. Explicit Non-Done Conditions

This sprint is not complete if any of the following remain true:

1. media worker still marks assets as processed without real transcoding
2. PDF ingestion still returns "PDFs are not yet supported"
3. UI implies success while backend work is still pending
4. failures require reading server logs to understand
5. deployment still depends on editing code instead of env/config
6. the flow works only locally but has no documented production dependency setup

---

## 12. Recommended Libraries And Technical Direction

The implementing assistant may choose alternatives, but must justify them if deviating.

### For media

Preferred direction:

1. `ffmpeg` + `ffprobe` via existing `fluent-ffmpeg` usage or direct child-process wrapper
2. existing storage helper layer in `backend/src/lib/s3`
3. queue retries/backoff through Bull configuration

### For PDFs

Preferred direction:

1. robust text extraction library suitable for Node backend
2. extraction service isolated into its own module, not inlined into the route
3. normalization helper separated from route/controller logic

Avoid:

1. giant route-handler logic
2. silent fallback to junk text
3. brittle regex-only PDF parsing

---

## 13. Final Launch Sign-Off Checklist

Only call this complete when all are true:

1. video processing is real, not stubbed
2. guideline ingestion supports PDFs from official sources
3. creator/admin UX exposes truthful states and useful failures
4. touched UI matches `docs/UI_UX_STANDARDS.md`
5. all new config is env-driven and documented
6. automated tests cover success and failure paths
7. local and production dependency requirements are documented
8. a human can run the full flow without hidden manual intervention

---

## 14. Instruction To Future AI Assistants

If you are the assistant implementing this sprint:

1. read this sprint fully before editing code
2. treat `docs/UI_UX_STANDARDS.md` as mandatory for any frontend changes
3. do not stop after backend-only changes if the operator UX still hides status or failures
4. do not claim completion while stubs remain
5. update docs and `.env.example` when introducing new dependencies or configuration
6. verify with real tests or end-to-end flows, not assumption

---

## 15. Definition Of Done

This sprint is done only when the system can honestly support both of these statements:

1. "Uploaded videos are actually processed and become usable media assets through a real production pipeline."
2. "Official guideline documents, including PDFs, can be ingested and turned into reviewable draft courses."

If either statement is still only partially true, this sprint is not done.
