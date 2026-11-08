## Feature goal
Give scans one home and show Add job's whole pipeline (v3 design, boards "Add job" and "Find jobs"). With scans manual (PR-2), the operator needs a page that says what a scan checks and costs before the click, why it can't run when it can't, and what it kept. Add job sent the operator to Review to follow the draft and threw the pasted post away on Discard. Roadmap: `docs/features/ux-v3/ux-v3-roadmap.md` PR-5.

## Acceptance criteria
- [x] AC-1: A Find jobs page (`/find-jobs`, in the sidebar) lists the sources a scan checks, links to change them, and shows the cost (fetch and filters free; scoring; drafting per strong match) before the click.
- [x] AC-2: Start scan runs one scan, shows it running with elapsed time, then what it kept (fetched, new, passed filters, drafted) with the result line and Open Review.
- [x] AC-3: Start scan stays clickable; with the token budget used up it starts nothing and says why, beside a failed callout with the budget message.
- [x] AC-4: When every source is at today's poll limit, the page says so.
- [x] AC-5: A failed scan shows "The scan stopped." with the reason and Try again.
- [x] AC-6: Review's header links to Find jobs instead of running a scan itself.
- [x] AC-7: Add job shows a Paste → Check the match → Draft → Ready in Review stepper.
- [x] AC-8: "Edit the post" returns to the input with the pasted text kept.
- [x] AC-9: After Add and draft, the page follows the draft live (drafting with elapsed time, saving PDFs, failed, not drafted with its reason) and ends on "Review and approve".

## Must not break
- MNB-1: Check the match is still disabled, with the reason, while the token budget is used up.
- MNB-2: A job already in Applio still offers Open existing instead of Add.
- MNB-3: The Review header still shows the last scan line and pause/resume.

## Test plan
- AC-1: `find-jobs-page.test.tsx` › "lists the sources a scan checks, with where to change them".
- AC-2: `find-jobs-page.test.tsx` › "starts a scan only when asked, then shows what it kept"; `run-summary.test.ts`.
- AC-3: `find-jobs-page.test.tsx` › "says why it can't scan while the token budget is used up, and starts nothing".
- AC-4: `find-jobs-page.test.tsx` › "says so when every source has used today's polls".
- AC-5: `find-jobs-page.test.tsx` › "shows a failed scan with its reason and a retry".
- AC-6: `review-page.test.tsx` › "sends the operator to Find jobs to start a scan".
- AC-7, AC-9: `add-job-page.test.tsx` › "reads a pasted post, works out the channel and adds it to review", "follows the draft on the page after adding, until it is ready".
- AC-8: `add-job-page.test.tsx` › "keeps the pasted post when going back to edit it".
- MNB-1..3: `add-job-page.test.tsx` › "disables Check the match with the reason…", "offers Open existing…"; `review-page.test.tsx` › "pauses auto-send and still lets the operator start a scan".

## Out of scope
- Choosing sources per scan, opt-in drafting and live scan phases: PR-6 (the running state shows one honest stage until then).
