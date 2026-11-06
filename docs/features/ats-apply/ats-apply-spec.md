## Feature goal
Fill and submit standard ATS forms (Greenhouse, Lever, Ashby, Workable) in Applio's own window, and hand the job to the operator whenever a human is needed (SPEC F5 channel 2).

## Acceptance criteria
- [x] AC-1: Approving an ATS draft opens the form in an Applio window, fills name, contact, resume upload, cover letter and screening answers, and submits.
- [x] AC-2: A CAPTCHA, login wall, or required question with no answer pauses the fill, leaves the window open and asks the operator to finish; the job is marked Applied only when they confirm.
- [x] AC-3: After submission the job is Applied with a screenshot of the confirmation saved to its folder and `sent.md` listing every field submitted.
- [x] AC-4: An unknown form layout falls back to manual handoff with a readable reason.
- [x] AC-5: The ATS window is isolated from the main window's session and has no access to the API bridge.

## Must not break
- MNB-1: Applio never attempts to solve or bypass a CAPTCHA.
- MNB-2: The per-channel daily cap applies.

## Decisions (defaults picked while building, 2026-11-06; change any in review)
- One generic reader and planner, not four fillers. `extractForm` reads any form's controls, labels, required marks and CAPTCHA. It's checked against the real apply pages of all four boards, saved as fixtures.
- What Applio fills: your name (first/last, or full) and email, `resume.pdf`, and the cover letter (as a file, or as text). Anything else needs a saved answer, from the draft or the answer bank, that matches the question: a saved "Phone" answer fills phone fields. There are no new profile fields.
- Never filled: demographic (EEO) questions, and any checkbox. Required boxes are consents, so they're yours to tick.
- Any required field left over means no submit. The window stays open, filled as far as Applio could, and the job stays Approved for you to finish and Mark as applied (AC-2, AC-4).
- A CAPTCHA, before or after Submit, means a handoff. Applio never interacts with one (MNB-1).
- Applied only on a seen confirmation: a thank-you URL or message within 30 s. Without one, the outcome is "unconfirmed": the send-log claim is kept (like a crash mid-send), so it's never submitted twice, and you're asked to check.
- The window uses its own persistent session (`persist:ats`), sandboxed, with no preload, so it has no `window.applio` and no Node (AC-5). The window is visible for approved sends.
- Files go in through the Chrome DevTools Protocol (`DOM.setFileInputFiles`), since pages can't set files from script. Text goes in through the native value setter, so React and Vue forms register it.
- Jobs now store their apply link (migration 6). The form page is derived from it: Lever and Workable `/apply`, Ashby `/application`, Greenhouse the job page.

## Found while building
- Found in review: thank-you wording already on the form page ("Thank you for your interest…") would have read as a confirmation, even after a submit that failed validation. Now only wording that appears after Submit, or a move to a confirmation URL, counts (`confirmation.test.ts`).
- Lever's live apply page shows an hCaptcha frame, so Lever applications will be filled and handed to you to finish. That's the intended "CAPTCHA → hand off" rule (SPEC F5).
- Workable's sample form includes an attention-check question ("Did you start your first answer with the exact phrase…"). The planner leaves it for you, as it should.
- Verified by hand: the reader, sent into the live Lever page, read all 40 fields, so it's self-contained in a real page. Nothing was filled or submitted.

## Known risks
- CAPTCHA frequency on these forms is unknown (SPEC §6); this may push most ATS jobs to handoff.
- Form layouts change; fillers need fixture updates.

## Test plan
- AC-1: `extract-form.test.ts` reads each board's saved form and plans its fill; `ats-plan.test.ts` per rule; `send-application.test.ts` the submit flow. The live window itself is a manual check (Electron can't run in Vitest).
- AC-2: Fixture with a CAPTCHA element and one with an unanswered required field.
- AC-3: Test asserts screenshot and `sent.md`.
- AC-4: Fixture with an unknown layout.
- AC-5: Code review of `ats-window.ts`: no preload, a separate `persist:ats` partition, sandbox and context isolation.
- MNB-1: Code review; test asserts no interaction with CAPTCHA elements.
- MNB-2: Test at the cap.

## Out of scope
- Platform and career-site assisted fill (PR-23).
