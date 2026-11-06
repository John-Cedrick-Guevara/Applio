## Feature goal
Save every draft as the files the operator sends: one ATS-safe resume PDF, a cover letter PDF (or proposal), and the job, in the operator's folder (SPEC F4, F8).

## Acceptance criteria
- [x] AC-1: A one-template, ATS-safe resume PDF and a cover letter PDF are rendered with `printToPDF`.
- [x] AC-2: Files are written to `<root>/YYYY-MM/<Company> — <Role> (<score>%)/` with `resume.pdf`, `cover-letter.pdf` (or `proposal.md`) and `job.md`; company and role are sanitized for file names.
- [x] AC-3: Renaming or moving a job folder inside the root is re-linked by job ID; Open folder still works.
- [x] AC-4: Editing the letter in Review regenerates the cover letter PDF.
- [x] AC-5: Review's resume and cover-letter previews render from the same template the PDFs are printed from, so what the operator approves matches what is sent.
- [x] AC-6: Review offers "Open PDF" for the resume and the cover letter, which opens the generated file in the system viewer; it is disabled until the file exists.

## Must not break
- MNB-1: Nothing is sent by this PR.

## Decisions (defaults picked while building, 2026-11-06; change any in review)
- One shared template (`src/shared/templates/`) turns a draft into escaped HTML markup plus one stylesheet. Review shows that markup as-is, and the PDF is printed from the same markup inside a page, so the two can't drift (AC-5).
- The template is single column with standard headings, real text, system fonts, and no tables, images or columns.
- Every value is escaped, because drafts are shaped by job postings.
- Your name comes from a new Settings field, "Name on your documents" (Output folder card). Your email is the Gmail address. Either one is left off when empty, never guessed.
- PDFs come from Electron's `printToPDF` in a hidden window with JavaScript off and navigation refused.
- Folder: `<root>/YYYY-MM/<Company> — <Role> (<score>%)/` by local month. Names drop the characters an OS forbids, plus emoji, and are capped at 60 characters.
- A proposal is saved as `proposal.md`, as SPEC F8 says. A cover letter is saved as `cover-letter.pdf`.
- Re-link: `job.md` front matter holds `applio_job_id`, as the spec recommended. Open folder and Open PDF look two levels under the root when the stored path is gone, then store the new path.
- Files are written right after each draft is saved. Both documents are printed before anything is written, so a failed print leaves no half folder. Instead, the job gets a "Couldn't save the files: …" note and the draft stands.
- Open PDF is a new API method, `openDraftFile(jobId, 'resume' | 'letter')`. Its button is disabled while the job has no folder.

## Found while building
- Verified by hand: the real template printed with `printToPDF` gives a PDF whose text extracts (name, headline, summary, every line), so it's text, not an image (AC-1).

## Known risks
- Showing the PDF inside the app window (Electron's built-in viewer) would need loosening the renderer's sandbox to load local files; out of scope unless decided otherwise.

## Test plan
- AC-1: `application-documents.test.ts`: the page and template; Electron can't run in Vitest, so the PDF itself is checked by hand (printed, then its text extracted with unpdf; see Found while building).
- AC-2: Tests with names containing `/`, `:` and emoji.
- AC-3: Test moves a folder and resolves it by ID.
- AC-4: `backend.test.ts` › "prints the letter again when the operator edits it" (the file holds the new text).
- AC-5: Test renders a draft through the shared template for both the preview and `printToPDF` input and asserts identical HTML; manual side-by-side check of preview and PDF.
- AC-6: Test: button disabled without a file, calls the open-file API with the job's PDF path when present; manual check that the system viewer opens it.
- MNB-1: No send API is called anywhere in the file-writing path; `backend.test.ts` drafts and saves files with no job reaching applied.

## Out of scope
- Sending (PR-18, PR-19).
