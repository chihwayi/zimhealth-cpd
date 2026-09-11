# Sprint 01 — Fix the proposal letter

**Status: MOSTLY DONE (2026-09-11).** `docs/proposal-source.md` created as the editable source; curriculum reworded to "roadmap" framing; multi-council disclosure paragraph added; NCZ sync section reworded to describe it as ready-pending-endpoint; WhatsApp section strengthened (accurate claim). `.docx` regenerated from the corrected source. **One decision still needs a human:** the `$10` pricing claim was left as-is with an HTML comment (`docs/proposal-source.md`, "User Pricing" section) flagging that it doesn't match the live `$5` STANDARD tier — either raise the code price or lower the letter's figure before sending. Do not send the letter until that's resolved.

**Track:** Docs only, no code. **Priority:** P0. **Depends on:** nothing.

## Goal
Correct the factual errors in `docs/Proposal for Strategic Partnership 11 Sept .docx` before it (or any revision of it) reaches NCZ, and produce a corrected `.docx` (or `.md` source of truth) in `docs/`.

## Why
The letter currently overstates content depth and misstates pricing. A live demo or a sharp reader at NCZ would catch these immediately and damage credibility. See `docs/PROPOSAL-VS-REALITY-GAP-ANALYSIS.md` §1 for the full evidence table.

## Scope
Edit the proposal text (convert to Markdown first with `pandoc "docs/Proposal for Strategic Partnership 11 Sept .docx" -t markdown -o docs/proposal-source.md`, edit the `.md`, then convert back with `pandoc docs/proposal-source.md -o "docs/Proposal for Strategic Partnership 11 Sept .docx"`).

Required changes:
1. **Pricing**: change "$10 per nurse/year" to match actual `STANDARD` tier price in `backend/prisma/seed.ts` / wherever pricing constants live (currently $5/yr) — OR flag to the human user that they must decide whether to raise the code price to $10 instead of editing the letter. Do not silently pick one; leave a `TODO(human-decision)` comment in `docs/proposal-source.md` if ambiguous.
2. **Curriculum section**: reword "Unlike platforms with limited course catalogs, Healthbeat offers a continuously expanding library..." to describe the specialty tracks as a **roadmap** ("Healthbeat's curriculum roadmap covers...") rather than an existing library, until Sprint 03 lands real content. Once Sprint 02+03 are done, this can be reverted to present tense.
3. **Multi-council disclosure**: add a short paragraph disclosing that the platform architecture already supports multiple regulatory councils (PCZ, MDPCZ, etc.), and proposing explicit terms for NCZ (e.g. first-integration-partner status, an exclusivity window, or a preferential revenue-share tier) rather than implying NCZ exclusivity by omission.
4. **NCZ system integration section**: add one sentence clarifying that point-sync infrastructure is built and ready, pending NCZ providing/agreeing an API endpoint and credentials — see Sprint 05.
5. **WhatsApp channel**: this claim is accurate as-is (fully env-driven, no code changes needed once a paid Meta/360dialog number is provisioned) — no change needed, optionally strengthen it since it's a genuine strength.

## Non-goals
- Do not touch any application code in this sprint.
- Do not renegotiate the revenue split language — that's a business decision, leave as-is.

## Acceptance criteria
- [ ] `docs/proposal-source.md` exists and is the editable source of truth going forward.
- [ ] Regenerated `.docx` opens correctly and matches the `.md`.
- [ ] No numeric claim in the letter (price, course count, track count) contradicts the codebase as of this sprint.
- [ ] Multi-council disclosure paragraph present.

## Verification
Diff the new `.docx` against the checklist above manually (pandoc round-trip, then `pandoc ... -t plain` to eyeball). No automated test applies — this is a docs sprint.
