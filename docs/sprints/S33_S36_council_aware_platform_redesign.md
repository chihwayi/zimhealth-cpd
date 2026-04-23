# S33-S36 Council-Aware Platform Redesign

Source of truth: `docs/UI_UX_STANDARDS.md`

## Goal

Transform ZimHealth CPD from a nurses-first platform into a dynamic multi-council CPD platform where registration, course visibility, creator publishing, learner dashboards, and council officer portals are driven by council rules instead of hard-coded professional categories.

## Product Principles

1. A learner should register once with their council, professional title, and registration number.
2. The learner course library must automatically hide courses unrelated to that learner's council/title.
3. Creators must explicitly decide who can view a course before it is submitted for review or published.
4. Council officers must only see learners and CPD records under their own council unless they are platform admins.
5. Required CPD points must come from council configuration, not from hard-coded role/cadre assumptions.
6. Frontend interfaces must feel premium, simple, and confidence-building, especially around professional identity and audience targeting.

## Data Model Requirements

1. Add a `Council` model with:
   - name
   - slug
   - acronym
   - required annual CPD points
   - renewal month/day
   - registration prefix
   - allowed professional titles
   - active/inactive status

2. Extend `User` with:
   - `councilId`
   - `professionalTitle`
   - `registrationNumber`
   - backwards-compatible NCZ/cadre fields until older flows are fully migrated

3. Extend `Course` with:
   - `isPublicToAll`
   - `targetCouncilIds`
   - `targetTitles`
   - backwards-compatible `targetCadres`

4. Seed initial councils:
   - Nurses Council of Zimbabwe
   - Medical and Dental Practitioners Council of Zimbabwe
   - Pharmacists Council of Zimbabwe

## Backend Requirements

1. Add `GET /api/councils` for active council registration/options.
2. Update registration validation so learners must provide council, professional title, and registration number.
3. Validate that the selected title belongs to the selected council.
4. Return council/title/registration fields at registration, login, reset-password login, and `/api/auth/me`.
5. Use council `requiredPoints` in CPD summaries before falling back to legacy cadre rules.
6. Filter learner course browsing by authenticated learner eligibility:
   - all-user courses are visible to everyone
   - council-targeted courses are visible only to matching council learners
   - title-targeted courses are visible only to matching title learners
7. Block enrollment if a learner tries to access a course outside their audience.
8. Filter AI recommendations using the same eligibility rules.
9. Scope council officer learner lists, learner history, CSV exports, and point lookups to the officer's council.
10. Keep admins cross-council.

## Registration UX Requirements

1. Replace cadre-only registration with a council-first identity flow.
2. Fields required before login completion:
   - full name
   - email
   - council
   - professional title
   - registration number
   - password
3. Professional titles must update dynamically based on selected council.
4. Show each selected council's annual CPD target during registration.
5. The page must communicate that course recommendations and compliance are driven by this profile.
6. Follow `docs/UI_UX_STANDARDS.md`; avoid generic form styling.

## Learner Platform Requirements

1. Remove manual nurse/doctor/lab/cadre course filtering from the learner course library.
2. Keep useful filters:
   - search
   - category
   - difficulty
   - sort
3. Clearly state that displayed courses are already matched to the learner's profile.
4. Empty states must explain that no eligible course matches the learner's council/title and should not imply user error.
5. Dashboard profile completeness prompts should focus on council/title/registration number.
6. CPD point targets must reflect the learner's council.

## Creator Requirements

1. Add an explicit Course Audience interface in course settings.
2. Creator can choose:
   - all users
   - one or more councils
   - one or more professional titles under those councils
3. Include "select all titles" / clear behavior.
4. Make the audience UI visually prominent and beautiful enough that creators understand publishing impact.
5. Before submit-for-review:
   - save latest audience choices
   - reject submission when no audience is selected and "all users" is not confirmed
6. Course audience choices must persist to backend.
7. Learners outside the selected audience must not see or enroll in the course.

## Council Officer Requirements

1. NCZ officers should only see NCZ learners.
2. Future council officers should only see their own council learners using the same mechanism.
3. Admin remains cross-council.
4. CSV exports should include generic council/registration/title fields, not only NCZ-specific labels.
5. Learner history and point lookup endpoints must enforce council scope.

## Acceptance Checks

1. A new learner cannot register without council, title, and registration number.
2. A learner registered under NCZ sees only NCZ/all-user courses.
3. A learner registered under a medical/dental council does not see nurse-only courses.
4. A creator cannot submit a course for review without selecting audience or confirming all users.
5. A creator can target multiple councils and selected titles.
6. NCZ officer learner list excludes non-NCZ learners.
7. CPD summary required points match the learner's council.
8. `pnpm type-check`, `pnpm test`, and `pnpm build` pass.

## Implementation Status

Completed in this sprint:

1. Added council schema, migration, API, seed data, and shared types.
2. Updated auth registration/login/me responses for council identity.
3. Added eligibility filtering for course list, course detail, enrollment, and recommendations.
4. Updated CPD summary to use council required points.
5. Redesigned registration page around council/title/registration identity.
6. Removed learner manual cadre filtering and replaced it with profile-matched messaging.
7. Added creator Course Audience targeting UI.
8. Scoped council officer learner data and point lookup by council.
9. Updated auth tests for council-aware registration.

Future hardening:

1. Rename `/ncz` routes and role labels to generic council portal routes when the UI is expanded beyond NCZ branding.
2. Add admin council management screens for creating councils and editing required points/titles.
3. Add richer cross-council reporting for platform admins.
4. Add mobile registration/onboarding screens using the same `/api/councils` data.
