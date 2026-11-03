## Feature goal
Let any job the operator finds anywhere enter the pipeline, and optionally pre-fill platform forms they then submit themselves (SPEC F2 Clip, F5 channels 3–4).

## Acceptance criteria
- [ ] AC-1: Pasting a job post or link and choosing Analyze reads it with AI (fetching public pages only; platform links use only what the operator pasted), scores it, and shows company, role, tags, summary, detected channel, how Applio will apply and the highest autonomy.
- [ ] AC-2: Add to review queue saves the job, drafts it, and it appears in Review.
- [ ] AC-3: A pasted job that duplicates an existing one is flagged instead of added twice.
- [ ] AC-4: With assisted fill on for platform apply, the handoff opens the form in an Applio window using the operator's signed-in session and fills it; the operator clicks Submit; the job is logged when they confirm.
- [ ] AC-5: With assisted fill off, the handoff stays manual as in PR-4.
- [ ] AC-6: Upwork handoffs show the Connects cost before the operator proceeds.

## Must not break
- MNB-1: Applio never clicks Submit on a platform form.
- MNB-2: Applio never scrapes LinkedIn, Indeed, JobStreet or Upwork pages on its own.

## Known risks
- Open question: a browser extension Clip button vs paste-only. Recommended: paste-only for the MVP.
- Platforms may still restrict accounts that use automation (warned in Settings).

## Test plan
- AC-1: Tests with a fake engine and fixture posts (email, ATS, platform, no route).
- AC-2: Test: added job is drafted and listed.
- AC-3: Test pasting a duplicate.
- AC-4: Test against a saved platform form fixture: fields filled, submit not clicked; manual check.
- AC-5: Test with assisted fill off.
- AC-6: Test/manual check of the Connects line.
- MNB-1: Test asserts no submit event.
- MNB-2: Test: platform link analysis makes no request to the platform.

## Out of scope
- Autonomous platform apply (SPEC §5).
