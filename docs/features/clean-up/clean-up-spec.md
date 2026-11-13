## Feature goal
Matches pile up and nothing ever leaves them. Add a manual Clean up in Matches that previews which stale jobs would move to the Trash and moves them on confirm, with an Undo; and keep old Trash items from piling up in view. Nothing runs on its own, nothing is deleted, no tokens are spent. Roadmap follow-up PR-C; builds on the Trash (PR-B, #93).

## Acceptance criteria
- [x] AC-1: Matches has a "Clean up" button that opens a panel with two options, each showing how many jobs it would move right now: matches older than N days (default 14) and matches below the draft bar.
- [x] AC-2: The panel previews the jobs that would move (up to 8 titles, then "and n more") and the total; "Move n to the Trash" is disabled, with the reason, when nothing matches or the days value isn't a whole number from 1 to 365.
- [x] AC-3: Confirming moves exactly those jobs to the Trash (saved through `skipJob`), closes the panel and shows "Moved n matches to the Trash." with Undo; Undo restores exactly those jobs through `restoreJob`.
- [x] AC-4: Only matches are ever cleaned: found or scored jobs, never drafted, approved or sent ones, and never a job Claude is drafting; older-than counts from when the job was first seen.
- [x] AC-5: The Trash tab hides jobs trashed more than 30 days ago behind "Show older (n)"; the tab's count still counts every trashed job.
- [x] AC-6: A skip that fails during cleanup is reported and the job stays a match; the others still move.

## Must not break
- MNB-1: No job is deleted and no AI call is made; cleanup runs only on the confirm click.
- MNB-2: Skip with its 5 s Undo, Trash and Restore behave as in PR-B.

## Known risks
- Age is measured from the job's first recorded event, which is when a scan or paste saved it, not the posting date.
- Undo restores to the status before the move (found or scored), so scores are kept.

## Test plan
- AC-1: `matches-model.test.ts` › "counts each rule on its own, and lists a job once even when both apply", "picks only what the switched-on rules name"; `matches-page.test.tsx` › Clean up › "opens with a count for each rule".
- AC-2: `matches-page.test.tsx` › "previews what would move, and disables the button when nothing would", "refuses a days value that isn't a whole number from 1 to 365".
- AC-3: `matches-page.test.tsx` › "moves the previewed jobs to the Trash, then undoes it".
- AC-4: `matches-model.test.ts` › "only ever picks found or scored matches", "leaves out jobs being drafted", "counts age from when the job was first seen, to the day"; `matches-page.test.tsx` › "counts age from when a job was first seen, and lists what it would move".
- AC-5: `matches-model.test.ts` › "hides jobs trashed more than 30 days ago unless asked, counting them either way"; `matches-page.test.tsx` › "collapses Trash older than 30 days behind Show older, still counting it".
- AC-6: `matches-page.test.tsx` › "keeps a job a match when its move fails, and moves the rest".
- MNB-1: `matches-page.test.tsx` (no `draftJob`/`scoreJob`/`delete*` calls in the cleanup tests).
- MNB-2: existing PR-B tests.

## Out of scope
- Automatic or scheduled cleanup; permanently deleting; cleaning the Inbox's drafts.
