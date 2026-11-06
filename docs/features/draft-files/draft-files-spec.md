## Feature goal
Save every draft as the files the operator sends: one ATS-safe resume PDF, a cover letter PDF (or proposal), and the job, in the operator's folder (SPEC F4, F8).

## Acceptance criteria
- [ ] AC-1: A one-template, ATS-safe resume PDF and a cover letter PDF are rendered with `printToPDF`.
- [ ] AC-2: Files are written to `<root>/YYYY-MM/<Company> — <Role> (<score>%)/` with `resume.pdf`, `cover-letter.pdf` (or `proposal.md`) and `job.md`; company and role are sanitized for file names.
- [ ] AC-3: Renaming or moving a job folder inside the root is re-linked by job ID; Open folder still works.
- [ ] AC-4: Editing the letter in Review regenerates the cover letter PDF.
- [ ] AC-5: Review's resume and cover-letter previews render from the same template the PDFs are printed from, so what the operator approves matches what is sent.
- [ ] AC-6: Review offers "Open PDF" for the resume and the cover letter, which opens the generated file in the system viewer; it is disabled until the file exists.

## Must not break
- MNB-1: Nothing is sent by this PR.

## Known risks
- Showing the PDF inside the app window (Electron's built-in viewer) would need loosening the renderer's sandbox to load local files; out of scope unless decided otherwise.

## Test plan
- AC-1: Test renders the template to PDF and checks text is selectable (not an image).
- AC-2: Tests with names containing `/`, `:` and emoji.
- AC-3: Test moves a folder and resolves it by ID.
- AC-4: Test: update letter → PDF timestamp changes.
- AC-5: Test renders a draft through the shared template for both the preview and `printToPDF` input and asserts identical HTML; manual side-by-side check of preview and PDF.
- AC-6: Test: button disabled without a file, calls the open-file API with the job's PDF path when present; manual check that the system viewer opens it.
- MNB-1: Test asserts no send calls.

## Out of scope
- Sending (PR-18, PR-19).
