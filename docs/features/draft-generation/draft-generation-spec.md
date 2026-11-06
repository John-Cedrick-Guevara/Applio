## Feature goal
Prepare a tailored resume and cover letter (or Upwork proposal) and form answers for every strong match, citing only the fact bank (SPEC F4, principle 2). The files and PDFs are PR-17b (`docs/features/draft-files/draft-files-spec.md`).

## Acceptance criteria
- [x] AC-1: For each job at or above the draft threshold, a draft is created: headline, summary, resume sections whose every line cites a fact ID, and a cover letter (proposal for freelance/Upwork).
- [x] AC-2: Drafts citing an unknown fact or containing claims without a citation are rejected and regenerated once, then flagged for the operator.
- [x] AC-3: Screening answers come from the answer bank first; only new questions use AI, marked as AI-written with their token cost; approved AI answers are saved to the bank.

## Must not break
- MNB-1: Metrics in the fact bank appear exactly as written (no rounding or inflation).
- MNB-2: Nothing is sent by this PR.
- MNB-3: Jobs from Notify-only sources are never drafted (SPEC F6).

## Decisions (defaults picked while building, 2026-11-06; change any in review)
- Split from one PR (size): this PR drafts; PR-17b renders the PDFs and writes the folder.
- One AI call per job (step `tailor`), right after scoring in the same run, for scored jobs at or above the draft threshold whose source isn't Notify only.
- Kind: a proposal for freelance jobs and Upwork, else a cover letter.
- Every résumé line must cite a fact (the tool schema requires it). Every number in a line must appear in the fact it cites, so "40%" can't become "45%" or "50+" (MNB-1). A line that breaks either rule is rejected by name inside the call, so Claude can fix it there.
- "Regenerated once, then flagged": if a call ends with no saved draft, the job gets one more call; then a "Not drafted: …" note. The job stays scored.
- Answers: `save_draft` takes either `{ question, answerId }` for a bank answer (stored as the bank's text, origin bank, 0 tokens, and the bank entry's reuse count goes up) or `{ question, answer }` for a new one (origin ai). The call's tokens can't be split per answer, so the draft call's total lands on the job's token count, and each AI answer shows 0. Saving approved AI answers to the bank happens on approval (PR-18).
- Cited facts' "times used" goes up by one per draft, and the job's facts-used count is the number of distinct facts cited.
- The run's `drafted` count is filled in once drafting ends.
- `getDraft` and `updateCoverLetter` read and write SQLite. An edit marks the draft as edited.

## Known risks
- Claims in the cover letter can't be checked against facts mechanically; the prompt forbids them and the operator approves every letter.

## Test plan
- AC-1: `draft-jobs.test.ts` with a fake AI: one call per job, the step, scope and kind; `backend.test.ts`: a run drafts its strong matches and `getDraft` returns the draft.
- AC-2: `tools.test.ts`: an unknown fact, and a line whose number isn't in its fact, are rejected by name; `draft-jobs.test.ts`: no draft after a call → one retry → a note.
- AC-3: `tools.test.ts`: a bank answer is stored with the bank's text, origin bank and 0 tokens, and its reuse count goes up; a new answer is marked ai.
- MNB-1: `tools.test.ts`: "Cut latency 45%" citing a "40%" fact is rejected.
- MNB-2: `backend.test.ts`: a drafting run leaves every job at drafted, none applied.
- MNB-3: `draft-jobs.test.ts`: a Notify-only job isn't sent.

## Out of scope
- PDFs, the output folder, previews and Open PDF (PR-17b). Sending (PR-18, PR-19); assisted fill (PR-23).
