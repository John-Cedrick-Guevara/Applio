## Feature goal
Show real spend against every free limit and remove the last fake data from the app, so the free-limit guard can be trusted (SPEC F10).

## Acceptance criteria
- [x] AC-1: Usage tiles, the free-limit guard, tokens by step and the last 7 days come from recorded data for Today and This month.
- [x] AC-2: Every limit in SPEC F10 is listed (Claude tokens daily and monthly, Gmail sends, each board's polls, Upwork API, JSearch when on) with its real state.
- [x] AC-3: Crossing 80% raises one warning per limit per period (dashboard and Telegram); reaching 100% stops that work until the period resets or the cap is raised in Settings.
- [x] AC-4: "Saved by answer bank" counts tokens avoided by reusing saved answers.
- [x] AC-5: The main process no longer uses the mock store for any API method; the mock remains only for browser dev and tests.

## Must not break
- MNB-1: Browser dev (`npm run dev:web`) still works on the mock.
- MNB-2: Raising a cap in Settings resumes stopped work without a restart.

## Decisions (defaults picked while building, 2026-11-06; change any in review)
- One pure builder (`core/usage`) turns the recorded rows into the page: AI usage rows, applications sent (by their Applied event), drafts, and today's polls. "Today" and "This month" follow your local calendar; the 7-day chart is local days.
- Sent breakdown: Autonomous = sent on its own; Approved = you approved it in the app or on Telegram; Manual = you marked it applied. The daily send limit shown is the per-channel cap × the two sending channels (email, ATS).
- Saved by answer bank: each bank answer reused in a draft this period, times an estimated 200 tokens. Answers are written inside the drafting call, so their real per-answer cost isn't separable; the tile says "about". The spec's "average of past AI answers" would need that split, so the estimate is one constant.
- Limits (AC-2): Claude tokens daily and monthly, Gmail sends (100 a day), each board's polls today against its daily limit, Upwork API (off: not available to a personal tool yet, SPEC §6) and JSearch (off: not built).
- Warnings (AC-3): the dashboard colors any limit at 80% or more, from the same numbers. Telegram gets one message per limit per period (stored notification keys, as in PR-22), checked on the scheduler tick. Token warnings keep their existing path (PR-14). The hard stops are the ones that already hold: AI calls (PR-14), Gmail and per-channel sends (PR-18), board polls (PR-11).
- Raising a cap resumes at once (MNB-2): every limit is read from Settings at the moment it's checked.

## Known risks

## Test plan
- AC-1: Tests aggregate fixture usage rows for both periods.
- AC-2: Test lists limits against SPEC F10.
- AC-3: Tests at 79/80/100% with a fake notifier; once-per-period check.
- AC-4: Test with reused answers.
- AC-5: Test/grep: `src/main` has no import of `shared/mock`.
- MNB-1: The renderer's mock fallback is untouched (`api-context.tsx`), and the page tests run on it; manual `npm run dev:web`.
- MNB-2: Test: stopped → raise cap → next run proceeds.

## Out of scope
- Paid tiers or cost in money.
