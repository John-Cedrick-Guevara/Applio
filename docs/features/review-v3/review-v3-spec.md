## Feature goal
Make Review say clearly where each job is and what moves it on (v3 design, canvas row "v3", board "Review"). The audit found the detail crowded with tag pills and scattered banners, a failed PDF save that only offered a token-spending redraft, a silent disabled Approve, a one-click skip, a disabled "Answer and draft" with no reason, and an open-ended drafting spinner. Roadmap: `docs/features/ux-v3/ux-v3-roadmap.md` PR-4.

## Acceptance criteria
- [x] AC-1: The detail shows a Found → Scored → Drafted → PDFs saved → Sent stepper read from the job's records; Sent is done only past Approved with a send.
- [x] AC-2: Plain facts (location, type, salary) are one text line, not tag pills.
- [x] AC-3: While the PDFs save, a status callout says so, and Approve is disabled with the reason written beside it.
- [x] AC-4: A failed save shows the reason and "Retry saving PDFs", which reprints without AI (`saveDraftFiles`); it never redrafts.
- [x] AC-5: Skip job opens a confirm dialog naming the job; Cancel leaves it in the queue.
- [x] AC-6: ↑ and ↓ move between queue rows and open the one they land on.
- [x] AC-7: "Answer and draft" is always clickable; clicking it early marks each empty answer and focuses the first. An edited answer left empty shows its error on blur; the error clears as the operator types.
- [x] AC-8: The drafting panel shows the stepper, the two recorded stages, and elapsed time since main started the draft; past 3 minutes it says drafting is slow.
- [x] AC-9: Copy that promised "the next run" now says "your next scan".

## Must not break
- MNB-1: Suspicious posts still need a second confirm before sending.
- MNB-2: A refused send still shows as Not sent with Retry, never Sent.
- MNB-3: Approve still turns on by itself when main reports the PDFs saved.
- MNB-4: Answers still reach `answerQuestions` exactly as typed, with fact-bank saves.

## Test plan
- AC-1: `review-model.test.ts` › jobSteps tests (incl. "calls a job sent only when a sent record exists"); `review-page.test.tsx` › "waits to approve until the PDFs are saved, and says so".
- AC-2: `review-page.test.tsx` › "shows the selected draft with fit, gaps and the cover letter" (manual: no pills).
- AC-3: `review-page.test.tsx` › "waits to approve until the PDFs are saved, and says so".
- AC-4: `review-page.test.tsx` › "retries saving the PDFs without drafting again, after a failed save"; `backend.test.ts` › "prints a draft's files again on request, without calling AI", "says plainly when there is no draft to print".
- AC-5: `review-page.test.tsx` › "asks before skipping, naming the job, and skips only on confirm"; `app.test.tsx` › "keeps a page mounted when only its route params change".
- AC-6: `review-page.test.tsx` › "moves through the queue with the arrow keys".
- AC-7: `review-page.test.tsx` › "says which answer is missing when Answer and draft is clicked early, and drafts nothing".
- AC-8: `review-page.test.tsx` › "shows how long Claude has been drafting, stage by stage".
- AC-9: `review-page.test.tsx` › "lists jobs still waiting to be scored or drafted…".
- MNB-1..4: existing `review-page.test.tsx` tests for suspicious posts, refused sends, PDFs landing, and answering questions.

## Out of scope
- Find jobs link in the header and Run now moving there: PR-5.
- The narrow (phone-width) list-then-detail layout: the window is at least 960px wide.
