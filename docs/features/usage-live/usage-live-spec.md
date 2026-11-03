## Feature goal
Show real spend against every free limit and remove the last fake data from the app, so the free-limit guard can be trusted (SPEC F10).

## Acceptance criteria
- [ ] AC-1: Usage tiles, the free-limit guard, tokens by step and the last 7 days come from recorded data for Today and This month.
- [ ] AC-2: Every limit in SPEC F10 is listed (Claude tokens daily and monthly, Gmail sends, each board's polls, Upwork API, JSearch when on) with its real state.
- [ ] AC-3: Crossing 80% raises one warning per limit per period (dashboard and Telegram); reaching 100% stops that work until the period resets or the cap is raised in Settings.
- [ ] AC-4: "Saved by answer bank" counts tokens avoided by reusing saved answers.
- [ ] AC-5: The main process no longer uses the mock store for any API method; the mock remains only for browser dev and tests.

## Must not break
- MNB-1: Browser dev (`npm run dev:web`) still works on the mock.
- MNB-2: Raising a cap in Settings resumes stopped work without a restart.

## Known risks
- Open question: how to estimate tokens saved by the answer bank (average of past AI answers is the recommended estimate).

## Test plan
- AC-1: Tests aggregate fixture usage rows for both periods.
- AC-2: Test lists limits against SPEC F10.
- AC-3: Tests at 79/80/100% with a fake notifier; once-per-period check.
- AC-4: Test with reused answers.
- AC-5: Test/grep: `src/main` has no import of `shared/mock`.
- MNB-1: Manual `npm run dev:web`.
- MNB-2: Test: stopped → raise cap → next run proceeds.

## Out of scope
- Paid tiers or cost in money.
