## Feature goal
Optionally pre-fill platform and career-site forms in an Applio window with the operator's own signed-in session; the operator always clicks Submit (SPEC F5 channels 3–4).

## Acceptance criteria
- [ ] AC-1: With assisted fill on for platform apply, the handoff opens the form in an Applio window using the operator's signed-in session and fills it; the operator clicks Submit; the job is logged when they confirm.
- [ ] AC-2: With assisted fill off, the handoff stays manual as in PR-4c.
- [ ] AC-3: Upwork handoffs show the Connects cost before the operator proceeds.

## Must not break
- MNB-1: Applio never clicks Submit on a platform form.

## Test plan
- AC-1: Test against a saved form fixture: fields filled, submit not clicked; manual check.
- AC-2: Test with assisted fill off.
- AC-3: Test/manual check of the Connects line.
- MNB-1: Test asserts no submit event.

## Out of scope
- Autonomous platform apply (SPEC §5).
