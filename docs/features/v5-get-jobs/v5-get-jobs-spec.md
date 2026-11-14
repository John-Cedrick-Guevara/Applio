## Feature goal
Give Get jobs the v5 look and show, before the scan button, what a scan costs as a share of today's remaining token budget. Scanning, pasting, the source list and results work as before. Roadmap: `docs/features/v5-redesign/v5-redesign-roadmap.md` PR-7. Design: canvas board "v5 · 5 Get jobs (scan or paste)" (https://claude.ai/artifact/3T4Bs69qQWvxy9xKiND79T).

## Acceptance criteria
- [ ] AC-1: The page is headed "Get jobs" with the pill tabs Scan sources and Paste a job; the tab still lives in the URL.
- [ ] AC-2: The cost panel shows a 10-block meter of the scan's share of what is left today: scoring alone fills at least one block; with "Also draft strong matches" on it fills all ten, because drafting spends up to what is left; with nothing left it is full.
- [ ] AC-3: The scan funnel (fetched, new, passed, drafted) shows as four tinted count cards.
- [ ] AC-4: A running scan survives a look at the other tab, and the scan, stop and result links behave as before.

## Must not break
- MNB-1: A scan runs only when the operator starts one, and its cost shows before the click (SPEC F2, F10).
- MNB-2: No-source, budget-stop and at-limit states still block with their reason.
- MNB-3: Paste analysis, duplicate warning and add flow are unchanged.

## Known risks
- The meter's drafting share is "up to what is left", an honest ceiling, not a prediction.

## Test plan
- AC-1: `get-jobs-page.test.tsx` › "is headed 'Get jobs' with the v5 pill tabs", "opens on Scan sources and switches to Paste a job".
- AC-2: › "shows what a scan costs as a share of what is left today, with a block meter", "fills the whole meter when drafting is on…".
- AC-3: existing `find-jobs-page.test.tsx` funnel test.
- AC-4: › "keeps a running scan on screen while the operator looks at the other tab".
- MNB-1..3: existing `find-jobs-page.test.tsx`, `add-job-page.test.tsx`.

## Out of scope
- Per-source poll usage and "at limit" rows (Settings and Usage own source state).
- Inbox, Hand-off and the other screens.
