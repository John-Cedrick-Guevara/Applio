## Feature goal
Give Usage & limits the v5 look: tinted summary cards, a block meter for the token budget, and chart colours that pass the colour-vision check. Every number and limit is unchanged. Roadmap: `docs/features/v5-redesign/v5-redesign-roadmap.md` PR-11. Design: canvas board "v5 · 9 Usage & limits" (https://claude.ai/artifact/3T4Bs69qQWvxy9xKiND79T).

## Acceptance criteria
- [ ] AC-1: The page is headed "Usage **& limits**" with the Today / This month toggle. Every page title that uses the shared header is a light (400) title with a bold (700) word.
- [ ] AC-2: The four summary figures (Claude tokens, Applications sent, Avg tokens per application, Saved by answer bank) sit on lavender, pink, ice and amber cards with a 28px bold number.
- [ ] AC-3: The Claude tokens card shows a ten-block meter of the budget used (a labelled meter with its own value, equal to the percentage beside it; a zero budget reads 0%): any use fills at least one block, and the last block fills only at the whole budget. One shared `Blocks` component draws every block meter (Usage, Dashboard, scan cost), and one helper decides used-of-total blocks.
- [ ] AC-4: The 7-day chart draws days in the lavender mark colour and today in the darker lavender ink, so they differ in lightness, not only hue.
- [ ] AC-5: The free-limit guard table, the filtered-before-AI card, the step bars and the period switch show the same numbers and states as before.

## Must not break
- MNB-1: Every figure comes from the usage record; nothing is invented or rounded differently (existing tests).
- MNB-2: The Dashboard's weekly and budget meters and the scan-cost meter fill by the same rules as before (cost rounds up to the tenth; use fills the last block only at the whole).
- MNB-3: Meters keep their `role="meter"` values and the chart keeps its screen-reader description.

## Known risks
- Moving the block rule into `lib/cost.ts` touches the Dashboard and the scan meter; their tests pin the exact counts.

## Test plan
- AC-1: `usage-page.test.tsx` › "is headed 'Usage & limits' with the light and bold title"; `styles.test.ts` › "sets page titles light with a bold word".
- AC-2: › "puts each summary figure on its own tinted card".
- AC-3: › "shows the token budget as a ten-block meter…", "gives the token meter its own value…", "shows 0% and an empty meter, not NaN, when the budget is zero"; `blocks.test.tsx` (3 tests); `cost.test.ts` › "shareBlocks".
- AC-4: `styles.test.ts` › "draws the 7-day chart in lavender mark with today in darker lavender ink"; the chart's description: "describes the 7-day chart for screen readers".
- AC-5, MNB-1, MNB-3: the existing tests in `usage-page.test.tsx`.
- MNB-2: `dashboard-model.test.ts`; `cost.test.ts` › "costBlocks" (now pins 90% and 95%); the get-jobs meter tests.

## Out of scope
- Editing limits on this page (they live in Settings › Guardrails).
- The States kit pass (PR-12).
