## Feature goal
One place to bring jobs in: Get jobs, with two tabs (Scan sources, Paste a job) that say what each costs against what's left today, and a scan that hands its new matches straight to Matches. Find jobs and Add job stop being two pages for one outcome. Roadmap: `docs/features/redesign-v2/redesign-v2-roadmap.md` PR-5. Design: canvas row "Redesign v2", board 3 (Get jobs).

## Acceptance criteria
- [x] AC-1: `/get-jobs` shows the Get jobs page with tabs Scan sources and Paste a job; `/get-jobs/paste` opens Paste a job; `/find-jobs` and `/add-job` redirect to them.
- [x] AC-2: The sidebar has one "Get jobs" button in place of Add job and the Find jobs entry; the Inbox header, Matches' empty state and the activity bar's scan link go to Get jobs.
- [x] AC-3: Each tab states its token cost and its share of what's left today ("≈ 8k tokens · 12% of the 68k left today"); with drafting on, the scan says each strong match adds about 30k.
- [x] AC-4: A finished scan offers "Open the n new matches" linking to `/matches/new`, which opens Matches with "New since last scan" on; with nothing new it offers "Open Matches".

## Must not break
- MNB-1: Scans still start only on Start scan, with the chosen sources; Stop still keeps what was found.
- MNB-2: Paste still checks the match before adding, refuses a known duplicate with Open existing, and follows the draft after Add.
- MNB-3: A used-up budget still blocks both tabs with its reason.

## Known risks
- The scan's scoring cost is an estimate (≈ 6k for a typical scan); real use is recorded per run on the Usage page.
- Old links and the tray's "Find jobs" keep working through the redirects.

## Test plan
- AC-1: `app.test.tsx` › "redirects Find jobs and Add job to Get jobs"; `get-jobs-page.test.tsx` › "opens on Scan sources and switches to Paste a job", "opens on Paste a job from its link".
- AC-2: `sidebar.test.tsx` › "offers one Get jobs button and no separate Find jobs entry"; `review-page.test.tsx` › "offers Get jobs to start a scan, and leaves pausing to the activity bar", "sends the operator to Get jobs to start a scan"; `matches-page.test.tsx` › "says no matches yet, pointing to Get jobs"; `activity-bar.test.tsx` › "opens to list what is running with links".
- AC-3: `cost.test.ts` › "says the share of what's left today", "says when nothing is left"; `find-jobs-page.test.tsx` › "states the scan's cost against today's budget"; `add-job-page.test.tsx` › "states the paste's cost against today's budget".
- AC-4: `find-jobs-page.test.tsx` › "starts a scan only when asked, then shows what it kept" (link to `#/matches/new`); `matches-page.test.tsx` › "opens on new matches from a scan's link".
- MNB-1: `find-jobs-page.test.tsx` existing scan, source-choice and stop tests.
- MNB-2: `add-job-page.test.tsx` existing analyze, duplicate and draft-progress tests.
- MNB-3: `find-jobs-page.test.tsx` and `add-job-page.test.tsx` budget-stop tests.

## Out of scope
- Per-source poll counts in the scan list (sources don't report them yet); the all-sources-at-limit state stays.
- Duplicate check before AI on paste (PR-7).
