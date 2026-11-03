## Feature goal
Run discovery on its own every few hours, catch up after the computer sleeps, and let the operator pause everything (SPEC F2, F6).

## Acceptance criteria
- [ ] AC-1: Discovery runs every 6 hours (configurable 4–6) while the app is open or in the tray; a run missed during sleep starts on wake.
- [ ] AC-2: Run now starts a run immediately; only one run happens at a time.
- [ ] AC-3: Pausing stops scheduled runs, Run now and auto-sends; drafting and manual actions still work; the state survives restarts.
- [ ] AC-4: Each run stores its summary (found, new after dedup, passed filters, drafted), shown in the Review header.
- [ ] AC-5: Status (engine, paused, next run, tokens today) is pushed to the page on change, without needing navigation.
- [ ] AC-6: Closing the window keeps Applio in the tray; Quit from the tray exits; launch at login can be turned on.

## Must not break
- MNB-1: A run that fails part-way records the failure and the next run still happens.

## Known risks
- Open question: should launch at login default to on? Recommended: ask during first-run setup.

## Test plan
- AC-1: Scheduler tests with a fake clock, including a simulated sleep gap.
- AC-2: Test: Run now during a run is ignored/queued once.
- AC-3: Tests: paused blocks runs and auto-sends, allows drafts; persistence across a restart.
- AC-4: Test asserts the stored summary; manual Review header check.
- AC-5: Manual: pause in Review and see the sidebar card update immediately.
- AC-6: Manual on macOS and Windows: close window, tray menu, login item.
- MNB-1: Test with a source throwing mid-run.

## Out of scope
- Scoring and drafting inside a run (PR-16, PR-17).
