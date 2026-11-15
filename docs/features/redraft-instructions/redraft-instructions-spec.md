## Feature goal
When the operator reviews a draft by hand and wants it changed, they can request a new draft, say what to change, and pick which part to redraft (résumé, letter, or both). Only the chosen part is regenerated, so no tokens go to the part they are happy with, and the current draft stays safe until the new one lands. Automated drafting (scans, Add job, auto-send) is unchanged. Builds on the existing Redraft action (SPEC F4, F6).

Parts: **Résumé** = headline, summary, résumé sections, keywords. **Letter** = cover letter (or proposal) and the email subject. **Both** = everything.

## Acceptance criteria
- [ ] AC-1: On a job in Review with status `drafted`, Redraft opens a form with a part picker (Résumé / Letter / Both, none preselected) and an optional "What should change?" box (max 1,000 characters). Starting is blocked, with the reason shown, until a part is picked. An empty box is allowed.
- [ ] AC-2: The form has an optional "Add a fact" box with a section picker (the fact-bank sections). When filled, Applio saves that text to the fact bank in the chosen section before Claude is called, and notes it on the job's timeline. It then appears in Profile like any fact, and Claude may cite it.
- [ ] AC-3: Redrafting Résumé leaves the saved cover letter/proposal, subject and any operator edit to it byte-for-byte unchanged (including its "Edited by you" label). Redrafting Letter leaves headline, summary, résumé sections and keywords unchanged. Both replaces everything.
- [ ] AC-4: The operator's "What should change?" text reaches Claude as the operator's instruction for this redraft only, and is never saved on the job or reused by a later redraft. The job-post text still cannot change behavior (SPEC principle 6).
- [ ] AC-5: A part-only redraft does not ask Claude to write the other part: the other part is not in the instructions to write and its output is not requested. The call's tokens are recorded to the job and usage as for any draft.
- [ ] AC-6: The current draft stays visible, editable-as-before and approvable (subject to existing checks) while the redraft runs, which shows as drafting. Approve, Edit and Redraft are off for the job until it finishes, with the reason shown, so the old draft is never sent mid-redraft.
- [ ] AC-7: On success, the new part replaces the old one in one step, the job stays `drafted`, files (PDFs/proposal) are re-saved from the merged draft, and its profile-version provenance is refreshed.
- [ ] AC-8: If the redraft fails (error, no valid save, budget hard stop), the old draft is unchanged, the job returns to `drafted`, and the operator sees why and a next step. A hard stop spends nothing further.
- [ ] AC-9: If Claude asks questions instead of drafting, the old draft is kept, the questions show in the existing questions flow, and answering them resumes the same part-only redraft rather than a full one.
- [ ] AC-10: Every fact check of normal drafting still applies to the new part: every résumé line cites a bank fact, numbers match the cited fact, letter under 250 words, no placeholders, forbidden terms flagged. A rejected save leaves the old draft untouched.
- [ ] AC-11: Redraft is available only for status `drafted`; for any other status it is refused with a clear message, and a second redraft for a job already redrafting is refused (no double spend).

## Must not break
- MNB-1: Automated drafting (scan, Add job, auto-send) behaves exactly as before: full draft, no instruction, no operator prompt.
- MNB-2: No claim in a generated draft is untraceable: each résumé line cites a fact ID that exists in the bank, including facts added in AC-2.
- MNB-3: Nothing is sent that the operator did not approve; platform/career-site jobs still cannot be sent from Review; a draft is never sent while its redraft is running.
- MNB-4: Every AI call goes through the quota guard (budget, pause, usage); a hard stop stops the redraft.
- MNB-5: Edit-letter, Approve, Skip, Save files and the existing questions flow work as before on a draft that was never redrafted.

## Known risks
- Merging a part into the old draft can leave résumé and letter inconsistent (e.g. letter cites a project the new résumé dropped). Mitigation: the form says the other part is kept as is; Both is one click.
- A fact added through "Add a fact" is permanent bank data; a mistyped one would be reused. Mitigation: shown in Profile, deletable; operator is told on the form that it is saved.
- Keeping the old draft during redraft means two drafts' worth of state for a job; a crash mid-redraft must leave the old draft intact.
- Instruction text is trusted operator input but is still sent to the model: it must not carry secrets (existing "never ask for secrets" rule applies to Claude's questions only).

## Test plan
- AC-1: `draft-panel`/`review-page.test.tsx`: form opens, Start disabled with reason until a part is picked, empty text allowed, 1,001 chars refused.
- AC-2: `backend.test.ts`: fact saved with its section before the AI call and citable by `save_draft`; empty box saves nothing; section required when text given.
- AC-3: `draft-jobs.test.ts` / `backend.test.ts`: per part, assert untouched fields (including `edited` and edited letter text) are identical after merge.
- AC-4: `draft-jobs.test.ts`: instruction appears in the prompt as operator text; second redraft without text has none; job post injection text is not promoted.
- AC-5: `draft-jobs.test.ts`: prompt for Résumé omits the letter task and for Letter omits the résumé task; tokens added to the job; usage recorded.
- AC-6: `review-page.test.tsx`: Approve/Edit disabled with reason while redrafting, old text still shown; manual run in the app.
- AC-7: `backend.test.ts`: merged draft saved atomically, status stays `drafted`, files re-saved, profile version updated.
- AC-8: `backend.test.ts`: engine error, invalid save, and `QuotaExceededError` each leave the old draft and `drafted` status, with a note shown.
- AC-9: `backend.test.ts`: questions asked keeps old draft; answering resumes with the same part only.
- AC-10: `tools.test.ts`: existing checks still reject bad fact IDs, mismatched numbers, 250+ word letters on the redraft path; old draft intact after rejection.
- AC-11: `backend.test.ts`: non-`drafted` status refused; concurrent second call refused.
- MNB-1: existing `draft-jobs.test.ts` and `backend.test.ts` drafting cases pass unchanged.
- MNB-2: `tools.test.ts`: a bullet citing an unknown id is rejected after a redraft too.
- MNB-3: `backend.test.ts`: approve during redraft is refused; existing platform-handoff tests pass.
- MNB-4: `backend.test.ts`: paused or over-budget redraft makes no engine call.
- MNB-5: existing `review-page.test.tsx` cases pass unchanged.
- Manual (headless on a DB copy, per project practice): redraft Résumé only, then Letter only, then Both, with and without text and an added fact; confirm the untouched part is identical in the DB and PDFs.

## Out of scope
- Finer parts than Résumé / Letter / Both (e.g. summary only).
- Saving instructions per job or re-using them on later redrafts.
- Changing automated drafting or the answers-to-questions flow beyond keeping the chosen part.
- Side-by-side diff of old and new drafts, and undo of a replaced part.
- Editing or inferring facts from the free-text "What should change?" box (only the explicit "Add a fact" box adds facts).
