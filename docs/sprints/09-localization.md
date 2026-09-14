# Sprint 09 — Shona/Ndebele localization

**Status: DONE (2026-09-14)** — Shipped a broader mechanism than originally scoped, per the pan-African pivot (`new-direction`): instead of hardcoding Shona/Ndebele UI strings, built a dynamic `LanguagePack` system (`backend/src/routes/locales.ts`) — an admin downloads a fill-in-the-blank CSV template (built from `@zimhealth/i18n`'s baseline English keys), translates it in a spreadsheet, and uploads CSV/JSON/XLSX via the new Admin → Languages page; it's live for every client immediately via `GET /api/locales/:code`, no rebuild required. `i18next` wired into both web (sidebar + login language switcher) and mobile (bottom-sheet switcher in both learner and role profile screens, via a custom i18next backend reusing the existing `api` client). Selection persists (localStorage on web, SecureStore on mobile).
Also completed the original content-tagging scope: web course browse page has a Language filter (English/Shona/Ndebele) against the existing `Course.language` field; WhatsApp bot registration now asks for a language preference (`User.language`, new field + migration) and the bot's course menu prioritizes matching-language courses without hard-excluding others.
Caveat: admin/creator/council back-office UI stays English-only (non-goal, as originally scoped) — only learner-facing chrome (nav, auth, common actions) is translated so far; more UI strings can be added to `@zimhealth/i18n`'s baseline over time without any architecture change.

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
