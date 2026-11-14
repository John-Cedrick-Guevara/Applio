## Feature goal
Make the long waits in Applio follow the v5 States kit: a thin moving bar beside the words for a wait of a second or more, and, when a wait has run about three times as long as usual, a plain note saying it is slow, for how long, the usual time and what is safe. Never a spinner with no end. Roadmap: `docs/features/v5-redesign/v5-redesign-roadmap.md` PR-12. Design: canvas board "v5 · States kit (every wait)" (https://claude.ai/artifact/3T4Bs69qQWvxy9xKiND79T).

## Acceptance criteria
- [ ] AC-1: A `ProgressBar` (a thin moving bar, decorative, with the words beside it saying what is happening) shows during: a running scan, a draft in progress (the drafting panel and the Paste a job progress), and the reading and scoring of a pasted post. Under reduced motion it stops moving but stays visible.
- [ ] AC-2: A draft that has run for 6 minutes or more says "Drafting is taking longer than usual. It has run for N minutes. The usual time is 2. Nothing has been sent and the tokens used so far are logged." Before 6 minutes it says nothing extra.
- [ ] AC-3: A scan that has run for 3 minutes or more says "The scan is taking longer than usual. It has run for N minutes. The usual time is 1. Everything found so far is kept, and you can stop it.", and Stop scan stays available.
- [ ] AC-4: Reading and scoring a pasted post that has run for 90 seconds or more says "Checking the match is taking longer than usual. It has run for N minutes. The usual time is under a minute. Nothing was added and you can leave."
- [ ] AC-5: Elapsed time for these waits comes from one hook (`useElapsed`) that counts only while the wait is active, starts fresh each time, and can count from a real start time so a reload keeps it true.

## Must not break
- MNB-1: A scan, draft or analysis still starts only on the operator's click and spends tokens only as before; no wait state starts, retries or cancels anything by itself.
- MNB-2: The drafting steps, elapsed clock, "usually 1–2 minutes" line and Stop scan keep working; a running scan still survives a look at the other tab.
- MNB-3: Busy buttons keep their delayed spinner and `aria-busy`.

## Known risks
- The 6 min / 3 min / 90 s lines are the kit's limits; a real draft that legitimately runs longer will show the note while it is still working, which is why the note says what is safe and does not claim failure.
- Fake timers in the new tests advance the clock; they restore real timers after each test.

## Test plan
- AC-1: `progress-bar.test.tsx`; `styles.test.ts` › "draws the wait bar moving, and still under reduced motion"; `review-page.test.tsx` › "moves a slow draft…" (bar present), `find-jobs-page.test.tsx` › "shows the moving bar with its words…", `add-job-page.test.tsx` › "shows the moving bar while a post is read…".
- AC-2: `waits.test.ts` › "says a draft is slow…", "says nothing until about three times…"; `review-page.test.tsx` › "moves a slow draft from 'usually 1-2 minutes'…".
- AC-3: `waits.test.ts` › "says a scan is slow…"; `find-jobs-page.test.tsx` › "shows the moving bar with its words, and the slow-scan note…".
- AC-4: `waits.test.ts` › "says a match check is slow…"; `add-job-page.test.tsx` › "shows the moving bar while a post is read, and a plain note…".
- AC-5: `use-elapsed.test.tsx` (3 tests).
- MNB-1..3: the existing `find-jobs`, `add-job`, `review`, `get-jobs` and `components` suites.

## Out of scope
- "Keep waiting" and "Cancel the draft" buttons from the kit: there is no cancel for a draft, so none is shown; scans keep Stop scan.
- Removing the top activity bar: its Pause, Stop and Raise budget controls still have no other home, so it stays.
- Résumé import and connection-test waits (a button with a spinner and words today; no long wait to describe).
