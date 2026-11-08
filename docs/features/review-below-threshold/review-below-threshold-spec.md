## Feature goal
A job below the draft threshold is never dead text (QA 2026-11-07 #5). The operator can open it, see why it wasn't drafted, and draft or dismiss it with one click, without lowering the global threshold and waiting for the next run.

## Acceptance criteria
- AC-1: Every row under "N more scored below your draft threshold" and "not scored or drafted yet" is a link that opens the job's detail in the right panel (keyboard-focusable). Rows show the score and source, best first.
- AC-2: The detail says why it wasn't drafted (score below the draft score, or not scored yet) and shows the summary, fit, gaps, original post and apply channel.
- AC-3: **Draft this one** (scored jobs only, with a token and time estimate) starts a background draft; the job moves under Drafting now and then appears as a draft.
- AC-4: **Dismiss** skips the job. It leaves the list and is never re-scored, since a skipped job keeps its dedup key.
- AC-5: The backend drafts only scored jobs and refuses any other status with a plain reason.

## Must not break
- MNB-1: Drafted, asking, drafting and approved jobs open their own panels as before.
- MNB-2: Background drafting from Add job and answered questions.

## Test plan
- AC-1: `review-page.test.tsx` › "lists the jobs scored below the draft threshold when asked, each opening its detail"
- AC-2, AC-3: `review-page.test.tsx` › "shows a below-threshold job's fit and post, and drafts it on request"; `backend.test.ts` › "drafts a job scored below the threshold when the operator asks, in the background"; `mock-api.test.ts` › "drafts a scored job on request"
- AC-4: `review-page.test.tsx` › "dismisses a below-threshold job, which leaves the list for good"
- AC-5: `backend.test.ts` (same test, second call); `mock-api.test.ts` › "refuses a job that is not waiting to be drafted"
- MNB-1/2: full suite.

## Out of scope
- When the threshold is lowered, offering to draft the N jobs now above it (left for later).
