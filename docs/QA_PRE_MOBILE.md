# NursePro CPD — Manual QA Checklist (Pre-Mobile)

This checklist is the final human validation pass before starting mobile apps. It is designed to verify **truth** (behavior matches promise), not just UI presence.

## Environments

- **Web app**: `apps/web` on `http://localhost:3000`
- **API**: `backend` on `http://localhost:4000`
- **WhatsApp bot**: `apps/whatsapp-bot`

## Learner — Web (core journey)

- [x] Can register / login successfully *(verified via backend automated tests)*
- [ ] Learner dashboard loads without 404/500
- [x] `CPD Summary` shows correct totals and cycle year *(verified via backend automated tests)*
- [ ] Course browser loads published courses; locked courses route to subscription for FREE users
- [ ] Can enrol in a course and see progress update
- [ ] CoursePlayer: reading section renders correctly
- [ ] CoursePlayer: quiz works online; attempts decrement correctly; pass awards CPD once

## Offline mode (Sprint 26 truth)

- [ ] Download a module for offline while online
- [ ] Turn off network (devtools offline)
- [ ] Navigate course content: downloaded sections render
- [ ] Open a downloaded quiz: questions load and can be answered
- [ ] Submit quiz while offline: app confirms attempt saved offline (no crash)
- [ ] While offline: progress completions are queued (offline banner shows queued count)
- [ ] Re-enable network: queued progress syncs and queued quiz attempts submit successfully
- [ ] After reconnect: CPD summary + recent activity reflect new credits exactly once

## WhatsApp — Learner journey (core)

- [ ] Returning learner can type `menu` and see options
- [ ] `points` returns current points and is consistent with web
- [ ] Learning flow can start module, read sections, and take quiz
- [x] Module quiz pass triggers backend credit; repeat pass does **not** grant points again *(verified via backend automated tests: quizId dedupe)*
- [ ] FREE tier WhatsApp CPD cap is enforced (12 points/cycle): extra credit attempts fail with upgrade messaging

## WhatsApp — AI tutor (Sprint 27 truth)

- [ ] `AI Tutor` responds to clinical question
- [ ] Off-topic question is politely declined
- [ ] Response includes safety framing (no definitive diagnosis; urgent escalation for red flags)
- [ ] Provider failure triggers fallback (simulate by disabling a provider key)
- [ ] FREE user is paywalled correctly and told to reply `upgrade`
- [ ] Typing `upgrade` shows payment options

## NCZ portal (Sprint 29 truth)

- [ ] Sync summary shows Pending/Blocked/Failed/Synced counts
- [ ] Blocked queue lists records missing NCZ number and provides “Resolve” path
- [ ] Updating learner NCZ number from dashboard removes from blocked queue on refresh
- [ ] Failed queue shows last error and supports retry per-record and retry-all-failed
- [ ] Dry-run mode never marks records as synced

---

## Automated verification (always required)

- [x] Web TypeScript type-check passes (`apps/web`)
- [x] Backend TypeScript type-check passes (`backend`)
- [x] WhatsApp bot TypeScript type-check passes (`apps/whatsapp-bot`)
- [x] AI client TypeScript type-check passes (`packages/ai-client`)
- [x] Backend automated tests pass (`backend pnpm test`)

## Creator portal — guideline→course (Sprint 28 truth)

- [ ] Creator can paste guideline text and generate modules/quizzes into a DRAFT course
- [ ] Source name is captured (for audit/review trail)
- [ ] Creator submits course for review

## Admin — approvals + AI review trail

- [ ] Pending course approvals list includes AI-generated badge for generated courses
- [ ] Reviewer notes can be entered and saved on approve/reject
- [ ] Approved course becomes visible in learner catalog

## Admin — release readiness

- [ ] `Admin → Release Readiness` loads telemetry snapshot
- [ ] Offline download telemetry increments after downloading modules
- [ ] AI tutor health panel shows counts after bot usage

