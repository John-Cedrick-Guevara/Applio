## Feature goal
Skipped jobs were in no list and a skip couldn't be undone, so a pasted duplicate that you had skipped said "you already have this" and pointed nowhere (found on the first run on real data, 2026-11-13). Add a Trash: skipped jobs are listed under a Trash tab in Matches and can be restored. Roadmap follow-up PR-B; Clean up (PR-C) builds on it.

## Acceptance criteria
- [x] AC-1: `restoreJob(jobId)` brings a skipped job back to the status it had before the skip (a scored job stays scored with its score; an unscored job returns to found) and records "Restored from the Trash"; it refuses a job that isn't in the Trash.
- [x] AC-2: Matches has a Trash tab with its own count; skipped jobs are listed there, never under All, At or above bar, Below bar or Not scored.
- [x] AC-3: A trashed row says it is in the Trash and has a Restore button (no Skip, Draft or Score); selecting trashed rows offers "Restore n".
- [x] AC-4: A restored job leaves the Trash and returns to its tab; a skip that has saved lands in the Trash.
- [x] AC-8: A restore pushes a status update, so the Inbox badge and open pages update at once.
- [x] AC-5: An empty Trash says so ("The Trash is empty"), not that filters hide things.
- [x] AC-6: A pasted duplicate that is in the Trash says "You moved this job to the Trash" with Restore (not "Open existing" or "second application"); after Restore it says where the job is, with a link.
- [x] AC-7: Every job status is listed on some screen (Inbox/Matches, Applications or the Trash); the old exemption for skipped is gone.

## Must not break
- MNB-1: Skip still hides the row at once, is held about 5 s with Undo, and a failed skip brings the row back.
- MNB-2: The free duplicate check and "Open existing" for non-skipped duplicates are unchanged.
- MNB-3: Skipped stays a terminal status for the normal transitions (`nextStatuses`); only Restore leaves it.

## Known risks
- Restoring an approved-but-unsent job returns it as approved, so it shows under Fix first again (intended: its send still failed).
- Nothing is deleted: the Trash keeps growing until Clean up (PR-C) collapses old items.

## Test plan
- AC-1: `backend.test.ts` › "restores a skipped job to where it was before the skip, noting it", "restores a scored job as scored, keeping its score", "restores only jobs in the Trash"; `status.test.ts` › `statusBeforeTrash`.
- AC-2: `matches-model.test.ts` › "lists skipped jobs only under the Trash tab…", "counts the Trash on its own…", "files a skipped job under trash…".
- AC-3: `matches-page.test.tsx` › "keeps skipped jobs out of All and lists them under the Trash, with their count", "restores a selection from the Trash".
- AC-4: `matches-page.test.tsx` › "restores a trashed job, which leaves the Trash and returns to its tab", "puts a skip in the Trash once it is saved".
- AC-8: `backend.test.ts` › "tells open pages a job was restored, so the badges update at once".
- AC-5: `matches-page.test.tsx` › "says the Trash is empty, not that filters hide things".
- AC-6: `add-job-page.test.tsx` › "offers Restore for a duplicate that is in the Trash, and says where it went".
- AC-7: `job-lists.test.ts` › every status is listed (no exemption).
- MNB-1: existing `matches-page.test.tsx` skip, undo and failed-skip tests.
- MNB-2: existing `add-job-page.test.tsx` duplicate test and `backend.test.ts` pasted-duplicate tests.
- MNB-3: existing `status.test.ts`.

## Out of scope
- Clean up (PR-C); permanently deleting jobs (not planned); restoring from the Inbox job panel.
