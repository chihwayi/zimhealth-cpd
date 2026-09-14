# Sprint 11 — Engagement layer (streaks/badges)

**Status: DONE (2026-09-14)** — Built `backend/src/services/engagement.ts` with `updateStreak()` (increment on consecutive-day activity, reset after a missed day, no-op if already logged today) and `checkAchievements()` against 6 achievements computed entirely from existing `Enrollment`/`CPDRecord` data: first course, 5 courses, first quiz pass, 7-day streak, 30-day streak, 5 courses in one specialty track. New `LearnerStreak`/`Achievement`/`LearnerAchievement` models, migration applied to prod. Hooked into the single choke point (`creditPoints()`) rather than every individual route, so web course completion, web/WhatsApp quiz passes, and offline sync all update engagement consistently — failures here are caught/logged and never break point crediting, and points themselves are completely unaffected (verified in tests). `GET /api/learners/me/streak` and `/me/achievements` live; web dashboard shows a real `EngagementCard` (current/longest streak, earned vs. locked badges — actual `Badge.tsx` component reused for status pills elsewhere, not repurposed here since it's a generic label atom, not an achievement widget); WhatsApp bot mentions an active streak in the points-check response. No leaderboard built (non-goal, needs an NCZ conversation first). Verified live against production: `GET /api/learners/me/streak`/`achievements` both return correctly for a real seeded learner, achievement catalog auto-seeds on first request. 6 new tests in `engagement.test.ts`, full backend suite (52 tests) green.

**Track:** Backend + Web (+ WhatsApp bot for streak nudges). **Priority:** P2. **Depends on:** nothing.

## Goal
Turn the existing static `Badge.tsx` UI atom into a real engagement system: completion streaks and earned badges that are actually computed and persisted, not just decorative.

## Why
Gap analysis §4 ("Gamification" row) — `apps/web/src/components/ui/Badge.tsx` exists but there's no streak/leaderboard/achievement logic behind it anywhere in `backend/src`.

## Scope
- `backend/prisma/schema.prisma`: add a `LearnerStreak` model (`learnerId`, `currentStreak`, `longestStreak`, `lastActivityDate`) and an `Achievement`/`LearnerAchievement` model (id, code, title, description, criteria description, `earnedAt`).
- `backend/src/services/cpd-engine.ts` (or a new `backend/src/services/engagement.ts`): on each completed module/quiz, update the learner's streak (increment if last activity was yesterday, reset if a day was missed, no-op if already logged today) and check achievement criteria (e.g. "first course completed," "5 courses in a specialty track," "30-day streak").
- Define an initial small set of achievements (5-8) — keep criteria simple and computable from existing data (`Enrollment`, `CPDRecord`), don't invent new tracked metrics beyond streak.
- `GET /api/learners/me/achievements` and `GET /api/learners/me/streak` endpoints.
- Web: wire `Badge.tsx` to real earned achievements on the learner dashboard/profile.
- WhatsApp bot: optionally mention streak status in the points-check response (`pointsHandler`) — low effort, high visibility for this channel.

## Non-goals
- Do not build a cross-learner leaderboard in this sprint (privacy/consent considerations for a regulated health-professional population — worth a separate discussion with NCZ before ranking nurses publicly against each other). Streaks/badges are personal, not comparative.
- Do not gamify CPD points themselves (e.g., no bonus points for streaks) — points must remain tied strictly to genuine completed, approved CPD activity for regulatory integrity.

## Acceptance criteria
- [ ] Completing an activity two days in a row increments `currentStreak`; missing a day resets it.
- [ ] At least 5 achievements are actually earnable and persist per learner.
- [ ] Web dashboard shows real earned badges, not placeholder/static ones.
- [ ] No change to how CPD points are calculated or credited.

## Verification
- `cd backend && pnpm test` — add tests for streak increment/reset logic and at least one achievement's earning criteria.
- Manual: complete activities across simulated days (adjust `lastActivityDate` in test data) and confirm streak math and badge unlock in the web UI.
