## Feature goal
Fix four bugs found reviewing #80 and #83 and running the merged screens in the browser: a job could be listed in both Matches and the Inbox, the scan result's "new matches" count didn't match Matches, `/matches/new` kept its filter after navigating to `/matches`, and some copy still said Review. Also stop the whole-app tests flaking under full-suite load.

## Acceptance criteria
- [x] AC-1: Matches doesn't list a job Claude has open questions for; it waits in the Inbox's Answer tab only.
- [x] AC-2: A finished scan's button counts only matches that wait in Matches (passed filters minus drafted minus asked); when none wait but some were drafted or asked it says "Open the Inbox"; otherwise "Open Matches".
- [x] AC-3: `/matches/new` opens with "New since last scan" on, and a later `/matches` starts with it off, though the page stays mounted.
- [x] AC-4: Matches' description and Add job's failed-PDFs callout say Inbox, not Review.
- [x] AC-5: Whole-app tests wait up to 4 s for async UI, so the suite doesn't flake when it is under load.

## Must not break
- MNB-1: The scan result still opens Matches filtered to new when there are new matches.
- MNB-2: The Matches list, Score and Draft flows are unchanged.

## Known risks
- During the 5 s a held skip waits, the Inbox badge (counted in main) is one higher than the list; it settles when the skip saves. Accepted, noted in the review log.
- The test wait raises the worst-case time of a genuinely failing async assertion from 1 s to 4 s.

## Test plan
- AC-1: `matches-page.test.tsx` › "leaves out jobs Claude has open questions for: they belong to the Inbox".
- AC-2: `find-jobs-page.test.tsx` › "counts only the matches that wait in Matches, and sends drafted or asked jobs to the Inbox".
- AC-3: `matches-page.test.tsx` › "follows the link: /matches/new filters to new, then plain /matches shows everything again".
- AC-4: `matches-page.test.tsx` › "says drafts go to the Inbox, now that Review is the Inbox".
- AC-5: `src/test/setup.ts`; full check run three times green.
- MNB-1: `find-jobs-page.test.tsx` › "starts a scan only when asked, then shows what it kept"; `matches-page.test.tsx` › "opens on new matches from a scan's link".
- MNB-2: existing `matches-page.test.tsx`.

## Out of scope
- Making the badge subtract a held skip.
