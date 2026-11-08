## Feature goal
Let the operator choose what a scan covers and see where it is: pick sources for this scan, opt in to drafting (off by default, since drafting is the expensive step), follow the scan phase by phase, and stop it. Strong matches a scan didn't draft wait in Review one click from a draft. Roadmap: `docs/features/ux-v3/ux-v3-roadmap.md` PR-6. Design: canvas row "v3", board "Find jobs".

## Acceptance criteria
- [x] AC-1: `runDiscovery({ sourceIds, draft })` polls only the chosen enabled sources; with no `sourceIds`, every enabled one (the tray).
- [x] AC-2: A scan drafts nothing unless `draft` is true; it still scores.
- [x] AC-3: Main pushes the scan's phase (fetching, filtering, scoring, drafting) while it runs and clears it after.
- [x] AC-4: `stopScan` stops the scan before its next phase; jobs found are kept (unscored ones are scored on the next scan) and the summary says it stopped.
- [x] AC-5: Find jobs lists the enabled sources with a checkbox each (all ticked), an "Also draft strong matches right away" checkbox (off), and the drafting cost that follows it; Start scan sends exactly that choice.
- [x] AC-6: Unticking every source and clicking Start scan says "Pick at least one source to scan." and starts nothing.
- [x] AC-7: While scanning, Find jobs shows each phase as main reports it and a Stop scan button; after Stop it says the scan stops after this step and keeps what it found.
- [x] AC-8: Review lists strong matches with no draft under "Ready to draft"; their detail says why there's no draft and offers Draft this one.

## Must not break
- MNB-1: A scan asked to draft still drafts strong matches and retries earlier undrafted ones.
- MNB-2: One scan at a time: a second Start joins the running scan.
- MNB-3: Notify-only sources still send their Telegram match message.

## Test plan
- AC-1: `backend.test.ts` › "polls only the sources chosen for this scan".
- AC-2: `backend.test.ts` › "scores a scan's jobs but drafts none unless the scan asks"; `discover.test.ts` › "leaves strong matches undrafted unless the scan asks to draft them".
- AC-3: `backend.test.ts` › "pushes the scan's phase while it runs, and clears it once done"; `discover.test.ts` › "reports each phase as it starts, in order", "skips the drafting phase when the scan does not draft".
- AC-4: `backend.test.ts` › "stops a scan between phases when asked, keeping what it found"; `discover.test.ts` › both stop tests; `run-summary.test.ts` › "says a stopped scan kept what it found".
- AC-5: `find-jobs-page.test.tsx` › "starts a scan only when asked, then shows what it kept", "scans only the sources left ticked, and drafts only when asked".
- AC-6: `find-jobs-page.test.tsx` › "asks for at least one source before scanning".
- AC-7: `find-jobs-page.test.tsx` › "follows the scan's phases as main reports them, and stops it on request".
- AC-8: `review-page.test.tsx` › "lists strong matches a scan left undrafted under Ready to draft, one click from a draft"; `review-model.test.ts` › "puts strong matches a scan left undrafted under Ready to draft…".
- MNB-1: `discover.test.ts` › "drafts the strong matches against the run…", "also retries jobs an earlier run left unscored or undrafted"; `backend.test.ts` drafting tests run with `{ draft: true }`.
- MNB-2: `scan-runner.test.ts` › "returns the scan in progress when Run now is pressed during it".
- MNB-3: `backend.test.ts` Telegram match tests.

## Out of scope
- Showing a scan started from the tray as running on an already-open Find jobs page.
