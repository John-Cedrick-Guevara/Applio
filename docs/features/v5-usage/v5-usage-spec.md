## Feature goal
Give Usage & limits the v5 look: tinted summary cards, a block meter for the token budget, and chart colours that pass the colour-vision check. Every number and limit is unchanged. Roadmap: `docs/features/v5-redesign/v5-redesign-roadmap.md` PR-11. Design: canvas board "v5 · 9 Usage & limits" (https://claude.ai/artifact/3T4Bs69qQWvxy9xKiND79T).

## Acceptance criteria
- [ ] AC-1: The page is headed "Usage **& limits**" (light word, bold word) with the Today / This month toggle.
- [ ] AC-2: The four summary figures (Claude tokens, Applications sent, Avg tokens per application, Saved by answer bank) sit on lavender, pink, ice and amber cards with a 28px bold number.
- [ ] AC-3: The Claude tokens card shows a ten-block meter of the budget used: any use fills at least one block, and the last block fills only at the whole budget. A shared helper, also used by the Dashboard, decides the blocks.
- [ ] AC-4: The 7-day chart draws days in the lavender mark colour and today in the darker lavender ink, so they differ in lightness, not only hue.
- [ ] AC-5: The free-limit guard table, the filtered-before-AI card, the step bars and the period switch show the same numbers and states as before.

## Must not break
- MNB-1: Every figure comes from the usage record; nothing is invented or rounded differently (existing tests).
- MNB-2: The Dashboard's weekly and budget meters still fill by the same rule (tests unchanged apart from the shared import).
- MNB-3: Meters keep their `role="meter"` values and the chart keeps its screen-reader description.

## Known risks
- Moving the block rule into `lib/cost.ts` touches the Dashboard and the scan meter; their tests pin the exact counts.

## Test plan
- AC-1: `usage-page.test.tsx` › "is headed 'Usage & limits' with the light and bold title".
- AC-2: › "puts each summary figure on its own tinted card".
- AC-3: › "shows the token budget as a ten-block meter…"; `cost.test.ts` › "shareBlocks".
- AC-4: manual: screenshot of the 7-day chart in the PR (colour only); the chart's description is covered by "describes the 7-day chart for screen readers".
- AC-5, MNB-1, MNB-3: the existing tests in `usage-page.test.tsx`.
- MNB-2: `dashboard-model.test.ts` and `cost.test.ts` (costBlocks).

## Out of scope
- Editing limits on this page (they live in Settings › Guardrails).
- The States kit pass (PR-12).
