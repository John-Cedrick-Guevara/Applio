## Feature goal
Run discovery on its own every few hours, catch up after the computer sleeps, and let the operator pause everything (SPEC F2, F6).

## Acceptance criteria
- [x] AC-1: Discovery runs every 6 hours (configurable 4–6) while the app is open or in the tray; a run missed during sleep starts on wake.
- [x] AC-2: Run now starts a run immediately; only one run happens at a time.
- [x] AC-3: Pausing stops scheduled runs, Run now and auto-sends; drafting and manual actions still work; the state survives restarts.
- [x] AC-4: Each run stores its summary (found, new after dedup, passed filters, drafted), shown in the Review header.
- [x] AC-5: Status (engine, paused, next run, tokens today) is pushed to the page on change, without needing navigation.
- [x] AC-6: Closing the window keeps Applio in the tray; Quit from the tray exits; launch at login can be turned on.

## Must not break
- MNB-1: A run that fails part-way records the failure and the next run still happens.
- MNB-2: A job already in Applio (any status, sent ones included) is never saved twice (triage MNB-1).

## Decisions (defaults picked while building, 2026-11-05; change any in review)
- Interval: a Settings field, 4, 5 or 6 hours, default 6.
- Launch at login: off by default, with a switch in Settings. There's no first-run setup yet to ask in.
- Catch-up: the next run is due at the last run's time + the interval. Applio checks once a minute and on wake from sleep, so a missed run starts within a minute of waking, and on launch if one is overdue.
- A run that throws as a whole (not one failing source, which is isolated) waits a full interval before the next try, so a bug can't loop every minute.
- Run now during a run returns that same run's result instead of starting another.
- What a run does now: poll the sources, triage, and save the jobs that pass as `found`. Drafted is 0 until PR-16/17 add scoring and drafting. Each run also stores its per-reason drop counts and each source's outcome.
- Apply channel per saved job is detected from its apply URL (SPEC F5): `mailto:` is email, Greenhouse / Lever / Ashby / Workable hosts are ATS, LinkedIn / Indeed / JobStreet / Upwork are platform, the rest custom.
- Auto-send doesn't exist yet (PR-20). The paused flag it will check is stored now.
- Closing the window hides it on every platform. The tray menu has Open Applio, Run now, Pause / Resume and Quit.

## Found while building
- Discovery refuses to run until Profile has a target role. Running without one would store every remote job as found, and stored jobs are never filtered again once roles are set. The Run now button shows "Add at least one target role in Profile, then run discovery again."
- A job the prefilter drops isn't stored, so the next run sees it as new and drops it again. That's free, but "new after dedup" counts it each time.
- The shared `transaction` helper now joins an outer transaction instead of failing, so a run's jobs and its summary are saved together.
- Status is pushed on a separate `applioEvents` bridge (not an `ApplioApi` method, so the page can't invoke it). Browser dev has no push and still refreshes the card on navigation.

## Known risks
- The tray icon is a plain generated shape until there's a real app icon.

## Test plan
- AC-1: Scheduler tests with a fake clock: due after the interval, not before; a simulated sleep gap runs once on the next tick; overdue on start runs at once; interval from settings.
- AC-2: Test: Run now during a run returns the same run, and the source is polled once.
- AC-3: Tests: paused skips ticks and rejects Run now; the paused flag survives reopening the database.
- AC-4: Discover test asserts the stored summary and drop counts; activity repo round-trip; manual Review header check.
- AC-5: `engine-card.test.tsx`: a pushed status replaces the shown one, and the listener is removed on unmount. Manual: pause in Review and see the sidebar card update immediately.
- AC-6: Manual on macOS: close the window, use the tray menu, turn on launch at login and check System Settings → Login Items.
- MNB-1: Tests: a source throwing mid-run is recorded and the run completes; a run that throws is logged and the next one still happens.
- MNB-2: Discover test with a job whose key is already stored.

## Out of scope
- Scoring and drafting inside a run (PR-16, PR-17).
- Reading the saved jobs into the Review list (they're `found`, which Review doesn't show; PR-16 moves them on).
