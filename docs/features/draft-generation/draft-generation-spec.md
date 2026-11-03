## Feature goal
Prepare a tailored resume and cover letter (or Upwork proposal) and form answers for every strong match, citing only the fact bank, and save them in the operator's folder (SPEC F4, F8, principle 2).

## Acceptance criteria
- [ ] AC-1: For each job at or above the draft threshold, a draft is created: headline, summary, resume sections whose every line cites a fact ID, and a cover letter (proposal for freelance/Upwork).
- [ ] AC-2: Drafts citing an unknown fact or containing claims without a citation are rejected and regenerated once, then flagged for the operator.
- [ ] AC-3: Screening answers come from the answer bank first; only new questions use AI, marked as AI-written with their token cost; approved AI answers are saved to the bank.
- [ ] AC-4: A one-template, ATS-safe resume PDF and a cover letter PDF are rendered with `printToPDF`.
- [ ] AC-5: Files are written to `<root>/YYYY-MM/<Company> — <Role> (<score>%)/` with `resume.pdf`, `cover-letter.pdf` (or `proposal.md`) and `job.md`; company and role are sanitized for file names.
- [ ] AC-6: Renaming or moving a job folder inside the root is re-linked by job ID; Open folder still works.
- [ ] AC-7: Editing the letter in Review regenerates the cover letter PDF.
- [ ] AC-8: Review's resume and cover-letter previews render from the same template the PDFs are printed from, so what the operator approves matches what is sent.
- [ ] AC-9: Review offers "Open PDF" for the resume and the cover letter, which opens the generated file in the system viewer; it is disabled until the file exists.

## Must not break
- MNB-1: Metrics in the fact bank appear exactly as written (no rounding or inflation).
- MNB-2: Nothing is sent by this PR.

## Known risks
- Showing the PDF inside the app window (Electron's built-in viewer) would need loosening the renderer's sandbox to load local files; out of scope unless decided otherwise.
- Open question: how to store the job ID in the folder for re-linking (hidden file vs `job.md` front matter). Recommended: `job.md` front matter.

## Test plan
- AC-1: Tests with a fake engine; every resume line has a valid fact ID.
- AC-2: Tests with an unknown fact ID and an uncited line.
- AC-3: Tests: known question uses the bank (0 tokens), new question uses AI and is marked.
- AC-4: Test renders the template to PDF and checks text is selectable (not an image).
- AC-5: Tests with names containing `/`, `:` and emoji.
- AC-6: Test moves a folder and resolves it by ID.
- AC-7: Test: update letter → PDF timestamp changes.
- AC-8: Test renders a draft through the shared template for both the preview and `printToPDF` input and asserts identical HTML; manual side-by-side check of preview and PDF.
- AC-9: Test: button disabled without a file, calls the open-file API with the job's PDF path when present; manual check that the system viewer opens it.
- MNB-1: Test compares numbers in output with fact text.
- MNB-2: Test asserts no send calls.

## Out of scope
- Sending (PR-18, PR-19); assisted fill (PR-23).
