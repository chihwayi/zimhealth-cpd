# Sprint 09 — Shona/Ndebele localization

**Track:** Content + Web (+ mobile/WhatsApp bot if time allows). **Priority:** P2. **Depends on:** Sprint 03 (content should exist before translating it).

## Goal
Make Shona and Ndebele real, selectable languages across the platform, not just a dormant schema value.

## Why
`backend/prisma/schema.prisma` already defines `enum Language { ENGLISH SHONA NDEBELE }` and `Course.language` uses it — the data model is ready, but nothing in the UI (web, mobile, or WhatsApp bot) currently lets a learner choose a language or renders any non-English UI strings. Gap analysis §4 ("Multi-language" row).

## Scope
1. **Audit first**: grep `apps/web/src`, `apps/mobile/src`, `apps/whatsapp-bot/src` for any existing i18n library (`react-i18next`, `expo-localization`, etc.) and for `language` field usage on the `Course` model. Confirm whether this is truly greenfield or partially started before writing new code.
2. **UI string translation (web)**: introduce an i18n library if none exists (check `package.json` in `apps/web` first — do not add a duplicate), extract user-facing strings to translation files (`en.json`, `sn.json`, `nd.json`), and add a language switcher in settings/nav.
3. **Course content language filter**: the `Course.language` field already exists — surface it as a filter in the course browse UI (same pattern as the specialty track filter from Sprint 02) and let a creator author/mark a course's language on creation.
4. **WhatsApp bot**: lowest-effort, highest-reach channel for this population — add a language selection step in `apps/whatsapp-bot` onboarding/registration flow, store the learner's preferred language (check `User` model for a `preferredLanguage` field; add one via migration if missing), and filter course menu by it.
5. Translated *course content* itself (actual Shona/Ndebele course text) is a content task, not a coding task — scope this sprint to the *mechanism*, and treat translating the Sprint 03 courses as a follow-up content task, not blocking this sprint's code completion.

## Non-goals
- Do not attempt machine-translating existing English course content automatically and publishing it without human review — mistranslated clinical content is a patient-safety risk. If AI-translation is used, mark resulting courses `status: DRAFT` pending human review, never auto-publish.
- Do not localize admin/creator/council-officer back-office UI — English-only is fine there for now; focus on learner-facing surfaces.

## Acceptance criteria
- [ ] A learner can switch the web app UI language and it persists across sessions.
- [ ] Course browse page filters by `Course.language`.
- [ ] WhatsApp bot asks for and remembers a language preference.
- [ ] Any AI-translated course content lands as `DRAFT`, never auto-published.

## Verification
- Manual: switch language in web UI, confirm nav/buttons/labels update; confirm a Shona-tagged course (create one test course with `language: SHONA` if none exists from Sprint 03) shows up when filtering by Shona.
- WhatsApp bot manual chat test selecting each language option.
