# Sprint 08 — Mobile offline content verification

**Status: DONE (2026-09-14), with one caveat.** The audit found the mobile offline system was already far more built-out than the sprint assumed — `apps/mobile/src/lib/offlineDB.ts`/`offlineDownload.ts` already had full module/quiz text caching, resumable binary asset downloads, an offline quiz-attempt + progress queue, and a 15-min background sync task (`backgroundSync.ts`). The backend's `creditPoints()` in `cpd-engine.ts` already dedupes CPD credit by `learnerId+quizId+activityType+cycleYear`, so criterion 2 (no duplicate point crediting on offline sync) was already true — verified by reading the code, not by re-implementing anything. The two real gaps: (1) caching only happened via an explicit manual "Download for offline use" tap, never automatically on enrollment — fixed by splitting `cacheCourseOffline` into a cheap `cacheCourseContent` (text/JSON, now auto-triggered on enrollment) and the existing opt-in full asset download (kept manual — auto-downloading video/PDFs on a rural nurse's data plan without asking would be bad, and `shouldWarnForLargeDownload`'s cellular check already protects against that); (2) no "Available offline" indicator existed on course cards — added to `CoursesScreen.tsx`. **Caveat: no physical device or simulator was available in this environment**, so the sprint's prescribed manual airplane-mode walkthrough was not performed — verification here is `tsc --noEmit` passing clean plus a manual code-trace of the existing offline read/queue path, not a live device test. Flagging this explicitly rather than claiming the untested thing.

**Track:** Mobile. **Priority:** P1. **Depends on:** nothing (benefits from Sprint 03 content existing, not blocked by it).

## Goal
Verify and, where missing, complete offline caching of actual course content (not just CPD points/progress) in the Expo mobile app, so "works without data" is true for the full learning flow, not just dashboard sync.

## Why
`apps/mobile/src/offline/` exists, but the earlier audit only confirmed points/progress sync offline-first — not whether course modules, reading content, and quizzes are cached for offline access. README claims "React Native + Expo (offline-first)... works without data." Gap analysis §4 ("Offline learning" row).

## Scope
- Read `apps/mobile/src/offline/` fully first to establish what's actually cached today (likely uses AsyncStorage/SQLite/WatermelonDB or similar — check `apps/mobile/package.json` for the persistence library in use).
- Confirm/implement: on course enrollment (while online), the app pre-fetches and locally persists all `Module`, `ContentSection`, and `Quiz` data for that course, not just enrollment metadata.
- Confirm/implement: quiz submission while offline queues the attempt locally and syncs to `POST` the result once connectivity returns (check how points sync already handles the online/offline transition and mirror that queueing pattern for quiz submissions).
- Add a visible "Available offline" indicator on course cards in `apps/mobile/src/screens/learner/` so learners know which courses are safe to study without data.

## Non-goals
- Do not build offline support for course *browsing/discovery* (finding new courses reasonably requires connectivity) — only already-enrolled course content needs full offline access.
- Do not change the sync conflict-resolution strategy for points if one already exists and works — only extend the same pattern to content.

## Acceptance criteria
- [ ] After enrolling in a course while online, airplane mode can be enabled and the learner can still read all modules and take the quiz.
- [ ] Quiz results taken offline sync correctly once back online, without duplicate point crediting.
- [ ] "Available offline" indicator accurately reflects cache state per course.

## Verification
- Manual device/simulator test: enroll → airplane mode on → complete a module + quiz → airplane mode off → confirm points post exactly once in the backend (`CPDRecord`).
- Existing mobile test suite (check `apps/mobile` for a test runner config) should still pass; add a test for the offline queue if a testing pattern already exists in the codebase.
