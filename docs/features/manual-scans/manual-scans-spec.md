## Feature goal
Stop Applio from scanning on its own. Scans (fetch, score, draft) run only when the operator starts one, so no tokens are spent without a click (requested 2026-11-08). Roadmap: `docs/features/ux-v3/ux-v3-roadmap.md` PR-2.

## Acceptance criteria
- [x] AC-1: No scan starts on launch, on the minute tick, or on wake from sleep.
- [x] AC-2: Run now (Review header, tray) starts a scan; a second click during a scan joins it.
- [x] AC-3: Pause only stops sends that go out on their own; a scan the operator starts runs while paused. Pause reads "Pause auto-send".
- [x] AC-4: The schedule setting is gone: no "Run discovery every" in Settings, no `discoveryIntervalHours`, no `nextRunAt`.
- [x] AC-5: The sidebar card shows when the last scan ran ("None yet" before the first), never a next run.
- [x] AC-6: SPEC F2 says discovery is operator-triggered.

## Must not break
- MNB-1: The tick still checks replies, marks no-reply applications, warns on limits and pushes job changes.
- MNB-2: A failed scan still rejects Run now with its error and is logged.
- MNB-3: The token budget still stops every AI call.
- MNB-4: Auto-send still refuses while paused.

## Test plan
- AC-1: `backend.test.ts` › "never starts a scan on its own, on launch or on a tick".
- AC-2: `scan-runner.test.ts` › "runs a scan when the operator asks", "returns the scan in progress when Run now is pressed during it".
- AC-3: `backend.test.ts` › "stays paused across a restart, and still runs a scan the operator starts"; `review-page.test.tsx` › "pauses auto-send and still lets the operator start a scan"; `mock-api.test.ts` › "runs a scan the operator starts, even while auto-send is paused".
- AC-4: `settings-page.test.tsx` › "turns on launch at login, with no scan schedule to set"; typecheck (fields removed).
- AC-5: `engine-card.test.tsx` › "shows when the last scan ran, and never a next run".
- AC-6: SPEC.md diff.
- MNB-1: `backend.test.ts` › "pushes status on a tick only when a job changed…", "marks an application with no reply in 21 days as No reply on the next tick", "reads a reply in the application's thread…".
- MNB-2: `scan-runner.test.ts` › "logs a scan that throws and rejects with its error…", "runs again after a failed scan".
- MNB-3: `ai-service.test.ts` budget tests.
- MNB-4: `auto-send.test.ts` › "automation is paused".

## Out of scope
- Choosing sources per scan, opt-in drafting and live progress (PR-6).
- The Find jobs page (PR-5).
