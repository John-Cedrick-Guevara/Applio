## Feature goal
Optionally pre-fill platform and career-site forms in an Applio window with the operator's own signed-in session; the operator always clicks Submit (SPEC F5 channels 3–4).

## Acceptance criteria
- [x] AC-1: With assisted fill on for platform apply, the handoff opens the form in an Applio window using the operator's signed-in session and fills it; the operator clicks Submit; the job is logged when they confirm.
- [x] AC-2: With assisted fill off, the handoff stays manual as in PR-4c.
- [x] AC-3: Upwork handoffs show the Connects cost before the operator proceeds.

## Must not break
- MNB-1: Applio never clicks Submit on a platform form.

## Decisions (defaults picked while building, 2026-11-06; change any in review)
- Split from PR-23 (size); this is its second half.
- The same form reader and planner as ATS apply (PR-19), so the same rules hold: no demographic answers, no checkboxes, only saved answers beyond identity and files.
- The window uses its own persistent session (`persist:platform`). The first time, you sign in to the platform there yourself; Applio never enters a password.
- There's no submit step in the assisted-fill code at all (MNB-1). The window is left open for you, and you log the result with Mark as applied as before.
- It only works when the channel's assisted fill is on in Settings. Email and ATS jobs never use it.
- Connects: read from the pasted Upwork post ("16 Connects"). If the post doesn't say, the handoff tells you to check the cost first. Upwork's API, which would know, isn't available to a personal tool yet (SPEC §6).
- Settings now warns that platforms may restrict accounts that use automation.

## Known risks
- Platforms may restrict accounts that use automation; Settings warns about it, and filling is always started by you.
- Platform forms that need clicks to reveal (LinkedIn Easy Apply's steps) may show no form; the fill then says to open the application step and try again.

## Found in review
- A job pasted from LinkedIn was stored without its link, so assisted fill had nothing to open and the handoff's Open button opened an empty link. The platform link from the pasted text is now kept as the job's link.
- The Connects fallback matched any number near "Connect"; it now needs "Connects" and at most 3 digits.

## Test plan
- AC-1: `backend.test.ts` › fills only when on, the job stays drafted, the note is logged; `handoff-page.test.tsx` › "fills the form in Applio when assisted fill is on…"; the form reading and planning are PR-19's fixture tests. The live window is a manual check.
- AC-2: `handoff-page.test.tsx` › "stays a manual handoff when assisted fill is off"; `backend.test.ts` refuses when off.
- AC-3: `connects.test.ts`; `handoff-page.test.tsx` › "shows the Connects an Upwork proposal costs before the operator proceeds".
- MNB-1: Code review: `fillPlatformForm` has no submit call (the only `click` on a submit control is in `submitAtsForm`).

## Out of scope
- Autonomous platform apply (SPEC §5).
