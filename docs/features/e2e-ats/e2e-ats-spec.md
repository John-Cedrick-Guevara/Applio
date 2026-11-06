## Feature goal
Prove Applio's form windows (ATS submit and assisted fill) work end to end in real Electron windows, against local fake forms, without ever reaching a real company (pre-production QA).

## Acceptance criteria
- [x] AC-1: `npm run e2e` runs the real `submitAtsForm` and `fillPlatformForm` against local pages, with every outside request blocked, and exits non-zero on any failure.
- [x] AC-2: A standard form is submitted and confirmed, with name, email, phone, letter and the résumé file arriving, and a confirmation screenshot taken.
- [x] AC-3: A React-style form's own state sees the typed values and the attached file.
- [x] AC-4: An unanswered required question and a visible CAPTCHA are handed over without sending; a failed submit on a page that already said "thank you" isn't counted as sent; assisted fill fills and never submits.
- [x] AC-5: Closing a form window never crashes the app.

## Must not break
- MNB-1: The unit tests and the app build are unchanged by the harness (it's its own build target).

## Decisions (2026-11-06)
- The harness lives in `src/e2e` and builds to `dist/electron/e2e.cjs`; it isn't part of the app.
- Gmail, Telegram and the Gmail inbox stay covered by unit tests with fakes; their real check needs the operator's accounts.

## Found by the harness
- Closing a form window while the DevTools debugger (used for file uploads) was attached crashed the whole app. The debugger is now detached once the uploads are done.
- Destroying a form window right after detaching crashed it too. Windows are now closed normally.

## Known risks
- Runs need a desktop session (real windows); this isn't for CI.

## Test plan
- AC-1 to AC-5: `npm run e2e`: 13 checks, all passing on three consecutive runs.
- MNB-1: `npm run check` and `npm run build`.

## Out of scope
- Real Gmail, Telegram and IMAP (operator's accounts).
