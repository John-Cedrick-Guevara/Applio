## Feature goal
Fill and submit standard ATS forms (Greenhouse, Lever, Ashby, Workable) in Applio's own window, and hand the job to the operator whenever a human is needed (SPEC F5 channel 2).

## Acceptance criteria
- [ ] AC-1: Approving an ATS draft opens the form in an Applio window, fills name, contact, resume upload, cover letter and screening answers, and submits.
- [ ] AC-2: A CAPTCHA, login wall, or required question with no answer pauses the fill, leaves the window open and asks the operator to finish; the job is marked Applied only when they confirm.
- [ ] AC-3: After submission the job is Applied with a screenshot of the confirmation saved to its folder and `sent.md` listing every field submitted.
- [ ] AC-4: An unknown form layout falls back to manual handoff with a readable reason.
- [ ] AC-5: The ATS window is isolated from the main window's session and has no access to the API bridge.

## Must not break
- MNB-1: Applio never attempts to solve or bypass a CAPTCHA.
- MNB-2: The per-channel daily cap applies.

## Known risks
- CAPTCHA frequency on these forms is unknown (SPEC §6); this may push most ATS jobs to handoff.
- Form layouts change; fillers need fixture updates.

## Test plan
- AC-1: Tests against saved form fixtures per ATS in a test window.
- AC-2: Fixture with a CAPTCHA element and one with an unanswered required field.
- AC-3: Test asserts screenshot and `sent.md`.
- AC-4: Fixture with an unknown layout.
- AC-5: Test: `window.applio` undefined in the ATS window; separate session partition.
- MNB-1: Code review; test asserts no interaction with CAPTCHA elements.
- MNB-2: Test at the cap.

## Out of scope
- Platform and career-site assisted fill (PR-23).
