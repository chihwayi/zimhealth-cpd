# Sprint 12 — Accessibility audit (WCAG 2.1 AA)

**Track:** Web. **Priority:** P2. **Depends on:** nothing.

## Goal
Bring `apps/web` up to WCAG 2.1 AA on the learner-facing flows: registration, course browsing, module reading, quiz-taking, certificate download.

## Why
No accessibility tooling or audit evidence found in the repo. Nurses using this platform include an older workforce and may rely on assistive tech; regulator-facing platforms should meet a baseline standard. Gap analysis §4 ("Accessibility" row).

## Scope
1. **Automated audit first**: run `axe-core` (via `@axe-core/react` in dev, or a CI-runnable `axe-playwright`/`pa11y` pass) against the five flows listed above. Check `apps/web/package.json` for any existing test runner (Vitest/Playwright) to hook into — don't introduce a whole new test framework if one already exists.
2. Fix findings in priority order: (a) missing form labels/alt text, (b) insufficient color contrast (check the Tailwind theme tokens in `apps/web` for any color that fails 4.5:1 against its background), (c) keyboard navigation traps (especially in modals — check `packages/ui` shared modal component), (d) missing focus indicators, (e) missing ARIA roles on custom components (progress bars, badges, quiz option selectors).
3. Add the automated audit as a CI check (or at minimum an `pnpm test:a11y` script) so regressions are caught going forward, not just fixed once.

## Non-goals
- Do not redesign the visual design system — fix contrast/labeling within the existing design language, don't introduce a new one.
- Do not extend this audit to `apps/mobile` in this sprint — mobile accessibility (VoiceOver/TalkBack) is a separate, differently-tooled effort; scope this sprint to web only.

## Acceptance criteria
- [ ] Zero critical/serious `axe-core` violations on the five audited flows.
- [ ] All interactive elements reachable and operable via keyboard alone (tab order verified manually).
- [ ] `pnpm test:a11y` (or equivalent) script exists and runs in CI.

## Verification
- Run the automated audit tool and confirm zero critical/serious violations.
- Manual keyboard-only pass through registration → course enrollment → quiz → certificate download.
