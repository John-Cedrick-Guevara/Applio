## Feature goal
One bar across the top of every page says what Applio is doing (a scan, drafts), whether anything will send on its own, and how much of today's budget is left, so background work stays visible after leaving the page that started it. It replaces the sidebar engine card. Roadmap: `docs/features/redesign-v2/redesign-v2-roadmap.md` PR-2. Design: canvas row "Redesign v2", board 5 (Activity bar).

## Acceptance criteria
- [x] AC-1: The bar shows on every page and updates from main's status pushes without navigation.
- [x] AC-2: Running work, busiest first: a scan shows its phase in words and real elapsed time (from `scan.startedAt`) with a Stop button that calls `stopScan`; else drafts in progress ("Drafting n"); else the last scan time, or "No scans yet".
- [x] AC-3: Auto-send in words: "paused" when paused; "off" when no enabled source is set to Autonomous; otherwise "on" with the auto-send score. Pause and Resume sit in the bar; the Review header no longer has them.
- [x] AC-4: Budget: tokens used of today's budget with a meter; amber from 80%, red with "AI paused · budget used" and a Raise budget link at the hard stop.
- [x] AC-5: An AI engine that isn't set up shows "Claude needs setup" with a Settings link.
- [x] AC-6: Opening the bar lists what's running with links (the scan → Find jobs, drafts → Review), the auto-send rule, and the budget line.
- [x] AC-7: The sidebar engine card is gone.
- [x] AC-8: If the bar can't load, it says so in its place with Retry instead of disappearing.

## Must not break
- MNB-1: Pausing still stops only auto-sends; scans and drafts keep working.
- MNB-2: The bar stops listening to status pushes when it unmounts.
- MNB-3: Review still offers Find jobs to start a scan.

## Known risks
- The bar adds a row of chrome to every page; at 960px it must wrap rather than overflow. Mitigation: flex-wrap, checked in the run.
- Auto-send "on" depends on sources and settings that aren't pushed with status; they reload on navigation and after Pause/Resume, so a source change in Settings shows on the next page.

## Test plan
- AC-1: `activity-bar.test.tsx` › "updates from status pushes without navigation".
- AC-2: `activity-model.test.ts` › "names the scan phase with elapsed time", "shows drafts when no scan runs", "shows the last scan when idle", "says no scans yet"; `activity-bar.test.tsx` › "stops a scan from the bar".
- AC-3: `activity-model.test.ts` › "says auto-send is paused", "says auto-send is off when no source is autonomous", "says auto-send is on with the score"; `activity-bar.test.tsx` › "pauses and resumes auto-send from the bar"; `review-page.test.tsx` › "offers Find jobs to start a scan".
- AC-4: `activity-model.test.ts` › "turns the budget amber from 80%", "turns the budget red at the hard stop"; `activity-bar.test.tsx` › "offers Raise budget at the hard stop".
- AC-5: `activity-model.test.ts` › "says the engine needs setup"; `activity-bar.test.tsx` › "points to Settings when the engine needs setup".
- AC-6: `activity-bar.test.tsx` › "opens to list what is running with links".
- AC-7: `app.test.tsx` › "shows the activity bar and no engine card".
- AC-8: `activity-bar.test.tsx` › "says it could not load, with Retry, instead of vanishing".
- MNB-1: `activity-bar.test.tsx` › "pauses and resumes auto-send from the bar" (copy says scans and drafts still work).
- MNB-2: `activity-bar.test.tsx` › "stops listening when it unmounts".
- MNB-3: `review-page.test.tsx` › "offers Find jobs to start a scan".

## Out of scope
- Per-draft job titles in the panel (a count and a link to Review); Inbox badge (PR-4); Get jobs rename (PR-5).
