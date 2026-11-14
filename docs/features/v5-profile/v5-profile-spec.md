## Feature goal
Organise Profile into four pill tabs (Fact bank, Answer bank, Preferences, Résumé) instead of one long page of stacked cards, so each part of what the AI may write from is on its own screen. The editors themselves do not change. Roadmap: `docs/features/v5-redesign/v5-redesign-roadmap.md` PR-9. Design: canvas board "v5 · 7 Profile (fact bank)" (https://claude.ai/artifact/3T4Bs69qQWvxy9xKiND79T).

## Acceptance criteria
- [ ] AC-1: The page is headed "My profile" and shows four pill tabs, in order: Fact bank (with its count), Answer bank (with its count), Preferences, Résumé. It opens on the Fact bank.
- [ ] AC-2: Fact bank and Answer bank each show only their own list; the Add fact / Add answer button shows beside the tabs on those two tabs only.
- [ ] AC-3: Preferences shows "What you are looking for" with its existing editor; Résumé shows the reference résumé, the contact details for the résumé header and the ATS template preview.
- [ ] AC-4: Facts the résumé import finds are listed under Résumé, survive a look at another tab, and adding or dismissing them works as before.
- [ ] AC-5: An open editor or half-typed field survives switching tabs (panels stay mounted, only the chosen one shows).
- [ ] AC-6: Every fact, answer, preference, contact and section editor behaves and validates as before, and every saved value comes from the existing save calls.

## Must not break
- MNB-1: Generated text may only use fact-bank entries (SPEC non-negotiable 1); no fact is added without the operator's click on a suggestion or the Save button.
- MNB-2: Pay, currency, period and link validation are unchanged (existing tests).
- MNB-3: Fact groups, kinds, dates and links still save through the same calls.

## Known risks
- Hidden panels are out of the accessibility tree: a test or a link that expects a control on another tab must switch tabs first (tests updated).
- The contact card moved from the page's top to the Résumé tab; an operator looking for it must find it there (it feeds the résumé header).

## Test plan
- AC-1: `profile-page.test.tsx` › "shows four pill tabs, opens on the fact bank, and puts each section under its own tab".
- AC-2: › "offers Add fact and Add answer only on their own tabs", "shows facts grouped by role…", "lists saved answers and adds one".
- AC-3: › "edits what the operator is looking for", "toggles the ATS template preview", "saves contact details and links for the résumé header".
- AC-4: › "imports a résumé and adds only the suggested facts the operator accepts", "keeps the résumé suggestions while the operator looks at another tab".
- AC-5: › "keeps the résumé suggestions while the operator looks at another tab" (state kept across tabs).
- AC-6: › "adds a fact to a chosen group", "edits a fact inline and deletes one", "edits work type and remote-only…", "asks for a currency and period…", "points at a link line…", "edits a section's kind, dates, context and link".
- MNB-1..3: the existing tests above.

## Out of scope
- The skills chips and per-fact usage tags from the board (no skills data exists).
- Settings and Usage.
