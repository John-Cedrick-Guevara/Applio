## Feature goal
One list for jobs that have no draft yet (strong matches, jobs below the draft bar, jobs not scored yet), with the draft bar beside it and bulk Draft/Skip, so sorting matches stops hiding in Review's footers. Roadmap: `docs/features/redesign-v2/redesign-v2-roadmap.md` PR-3. Design: canvas row "Redesign v2", board 2 (Matches).

## Acceptance criteria
- [x] AC-1: `/matches` lists every scored and found job that isn't being drafted, best score first, unscored last; the sidebar has a Matches entry with the count of new ones.
- [x] AC-2: Tabs At or above bar / Below bar / Not scored / All show live counts; search filters by role or company; "New since last scan" keeps jobs first seen at or after the last scan.
- [x] AC-3: The draft bar slider shows how many matches sit at or above it as it moves, saves the draft bar to Settings, and can't go past the auto-send score (it says why).
- [x] AC-4: Each scored row has Draft (cost shown) and Skip; each unscored row says its next scan scores it.
- [x] AC-5: Selecting rows shows "n selected", the token estimate and what's left today, with Draft n and Skip n; Draft n is disabled with the reason when the estimate is over today's remaining budget or the budget is used up. Unscored rows in a selection are left out of Draft n, and it says so.
- [x] AC-6: Skip (one or many) hides the rows at once and is held about 5 seconds with Undo; Undo restores them and nothing is skipped; otherwise `skipJob` runs once per job. Leaving the page saves a held skip.
- [x] AC-7: Filtered-empty shows "No matches fit your filters" with Clear all filters; no matches at all shows "No matches yet" with Find jobs.

## Must not break
- MNB-1: No token spend without a click: Draft and Draft n are the only things here that start AI, and each shows its cost.
- MNB-2: Review still lists undrafted, below-bar and unscored jobs (until Inbox, PR-4), so no job is unreachable.
- MNB-3: The draft bar can't be saved above the auto-send score (Settings still refuses it).

## Known risks
- The token estimate is a typical draft (≈ 30k), not a promise; the quota guard in main still enforces the hard stop per draft.
- Draft n calls `draftJob` once per selected job; selections are small and each call only starts a background draft.
- A held skip is lost if the app quits within the 5 seconds; the job just stays a match.

## Test plan
- AC-1: `matches-model.test.ts` › "sorts best score first with unscored last", "leaves out jobs being drafted"; `matches-page.test.tsx` › "lists matches with no draft"; `sidebar.test.tsx` › "counts new matches in the nav".
- AC-2: `matches-model.test.ts` › "buckets by the draft bar", "counts every tab", "searches role and company", "keeps jobs new since the last scan".
- AC-3: `matches-page.test.tsx` › "moves the draft bar, recounts and saves it", "stops the draft bar at the auto-send score and says why".
- AC-4: `matches-page.test.tsx` › "drafts one match, showing its cost", "says an unscored job waits for a scan".
- AC-5: `matches-model.test.ts` › "estimates a selection against what's left today", "refuses a selection over budget", "leaves unscored jobs out of the draft count"; `matches-page.test.tsx` › "drafts a selection", "disables Draft n over budget with the reason".
- AC-6: `use-held-action.test.tsx` › "commits after the delay", "undo cancels the commit", "commits a held action on unmount"; `matches-page.test.tsx` › "skips with undo, then for good".
- AC-7: `matches-page.test.tsx` › "clears filters from an empty search", "says no matches yet".
- MNB-1: `matches-page.test.tsx` › "drafts one match, showing its cost" (draftJob only on click).
- MNB-2: existing `review-page.test.tsx` below-bar, ready-to-draft and waiting tests unchanged.
- MNB-3: `matches-page.test.tsx` › "stops the draft bar at the auto-send score and says why".

## Out of scope
- Score now for unscored jobs (PR-6). Removing Review's footers (PR-4). Get jobs link target (PR-5; links go to Find jobs for now).
