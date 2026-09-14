# Sprint 10 — Quiz integrity controls

**Status: DONE (2026-09-14)** — `attemptLimit`, `randomiseQuestions`, and duplicate-credit prevention already existed pre-sprint on the web path; the real gap was the WhatsApp bot, which never recorded `QuizAttempt` rows for module quizzes (only a `CPDRecord` on a pass) and so couldn't enforce attempt limits at all. Fixed by having the bot report every completed attempt — pass or fail — to `POST /api/points/bot/credit` (now creates a `QuizAttempt` row and rejects once `attemptLimit` is exceeded, mirroring web's `POST /api/quizzes/:id/attempt`), plus a new `GET /api/bot/quiz/:quizId/status` so the bot declines upfront instead of running a learner through a whole quiz first. Also fixed question randomization being reshuffled on every `GET` (now a seeded shuffle stable within an in-progress attempt, fresh on the next one) and added the minimum-elapsed-time check as a non-blocking `AuditLog` flag (`QUIZ_SUBMISSION_FLAGGED_FAST`) plus a `QuizAttempt.flaggedFast` column, exactly as specified — soft signal, never an auto-reject. Verified via `quizzes.test.ts` (attempt-limit rejection, no double-crediting on retake pass, fast-submission flag) — all 46 backend tests pass; migration applied to production.

**Track:** Backend. **Priority:** P2. **Depends on:** nothing.

## Goal
Add basic anti-cheating controls to the quiz/points-earning flow: randomized question order, attempt limits, and a minimum time-on-quiz check.

## Why
CPD points have real regulatory weight (they gate re-registration). Right now a learner could plausibly rapid-fire submit answers or repeat a quiz unlimited times to farm points. Gap analysis §4 ("Assessment integrity" row).

## Scope
- Read `backend/prisma/schema.prisma`'s `Quiz`/`Question`/`QuizAttempt` (or equivalent) models and the quiz submission route (likely in `backend/src/routes/courses.ts` or a dedicated `quizzes.ts` — locate via grep for `quiz` across `backend/src/routes`) to confirm current attempt-tracking behavior before changing anything.
- Add `Quiz.maxAttempts` (default e.g. 3) and enforce it server-side on submission — reject with a clear error once exceeded, don't just hide the UI button.
- Add `Quiz.randomizeQuestions` and, on the endpoint that serves quiz questions to a learner (both web and `backend/src/routes/bot.ts` for WhatsApp), shuffle question order per attempt (seeded per-attempt so it's stable if the learner reloads mid-attempt, not per-request).
- Add a minimum elapsed-time check: reject a submission if `submittedAt - startedAt` is implausibly fast for the question count (e.g. < 5 seconds/question) — log it to `AuditLog` as a flag rather than silently blocking, since false positives are possible (fast readers exist); a human/admin can review flagged attempts, not auto-reject on this signal alone.
- Points crediting (`cpd-engine.ts`) should only count the first attempt that meets a passing score within `maxAttempts`, not every retake — confirm current behavior and fix if it double-credits on retakes.

## Non-goals
- Do not build human proctoring/webcam verification — out of scope for a CPD refresher quiz; save for genuinely high-stakes assessments if ever needed.
- Do not change the AI tutor (`aiTutor` handler) behavior — this sprint is scoped to graded quizzes only.

## Acceptance criteria
- [ ] Submitting a quiz beyond `maxAttempts` is rejected server-side with a clear error, on both web and WhatsApp paths.
- [ ] Question order differs between two attempts by the same learner (when `randomizeQuestions` is true) but is stable within a single in-progress attempt.
- [ ] Implausibly fast submissions are flagged in `AuditLog`, not silently blocked (avoid false-positive lockouts).
- [ ] Retaking a quiz does not re-credit CPD points already earned from a prior passing attempt.

## Verification
- `cd backend && pnpm test` — add tests for: exceeding max attempts, double-crediting prevention, and the fast-submission audit flag.
- Manual: attempt a quiz 4 times against a `maxAttempts: 3` course and confirm the 4th is rejected with a readable error on both web and WhatsApp bot.
