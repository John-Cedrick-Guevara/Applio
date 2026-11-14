## Feature goal
Take the banner off the top of every page and put what it said into the sidebar's activity block, and move Pause auto-send into Settings. Scans only run when the operator starts one, so nothing needs a global pause control at the top; the pause belongs with the other guardrails. Follow-up to the v5 redesign (the roadmap's open item: the top activity bar).

## Acceptance criteria
- [ ] AC-1: No page has a banner above its content. The app shows only the rail's activity block for activity.
- [ ] AC-2: The activity block says what is running (scan with its phase, drafting n, AI paused, or nothing running with the last scan), whether auto-send is on, off or paused, and today's token use as ten blocks. It updates from main's status pushes and when Settings changes a source or guardrail (an `applio:settings-changed` event), and stops listening when unmounted. The meter uses the unrounded share: any use fills a block, and all ten only at the limit. A paused or blocked state shows a `!` glyph, not colour alone.
- [ ] AC-3: When a budget has stopped AI, the block leads with "AI paused" and "Raise the budget in Settings" and links to Settings › Guardrails; when Claude is not set up it leads with "Claude needs setup" and links to Settings › Connections. Both still lead while a scan runs, and say "A scan is running".
- [ ] AC-4: While a scan runs the block links to Get jobs, where Stop scan is; otherwise it links to Usage & limits. A failed load says so with Retry.
- [ ] AC-5: Settings › Guardrails has an Auto-send card with a "Pause auto-send" switch that shows the current state and pauses or resumes through `setAutomationPaused`. The card says when auto-send sends on its own (the threshold and Autonomous sources), and that scans and drafts still work while paused. The card says before the switch is on that scans and drafts keep working. A failed change says so and leaves the switch where it was; a pause made elsewhere (the tray) shows on the switch; and if the pause state cannot be read, every other setting still shows and the switch is off, disabled and explained.

## Must not break
- MNB-1: Nothing is sent without the operator's click except auto-send on email/ATS at or above the auto-send score (SPEC F6); pausing still holds every send.
- MNB-2: Stop scan is still reachable (on Get jobs while a scan runs); the Dashboard header chip and the sidebar badge counts are unchanged.
- MNB-3: The links "Raise budget", "Claude needs setup" and the other deep links to Settings tabs keep working.

## Known risks
- Stop scan is no longer on every page: an operator who leaves Get jobs mid-scan reaches it through the rail's block, one click away. The sidebar shows the scan phase and elapsed time meanwhile.
- The collapsed rail shows only the icon; the block's title carries the same words.

## Test plan
- AC-1: `app.test.tsx` › "has no banner above the pages, only the rail's activity block".
- AC-2: `activity-block.test.tsx` › "says auto-send is off, on or paused, in words", existing scan, drafting, nothing-running, blocks and push tests, "stops listening when it unmounts".
- AC-3: › "points to Settings > Guardrails to raise the budget…", "points to Settings > Connections when Claude is not set up", "still leads with the budget stop while a scan runs…", "leads with Claude needing setup even while a scan runs…".
- AC-4: › "links a running scan to Get jobs, where Stop scan is", "links to usage", "says so, and retries, when the status cannot load".
- AC-5: `settings-page.test.tsx` › "auto-send pause" (shows and pauses, opens already paused, says why a pause fails, follows a pause made elsewhere, still shows every setting when status cannot be read, says before the switch is on that scans and drafts keep working, tells the rail a setting changed).
- AC-2 (more): `activity-block.test.tsx` › "fills a block for tiny use…", "marks a paused or blocked state with a glyph…", "follows a settings change on the same page without navigation".
- MNB-1: the existing `backend.test.ts` pause and send-guard tests; MNB-2: `find-jobs-page.test.tsx` stop test, `dashboard-page.test.tsx`, `sidebar.test.tsx`; MNB-3: `settings-page.test.tsx` deep-link tests.

## Out of scope
- A pause for scans (they only run when started) and a cancel for drafts.
- Per-source autonomy controls (still Settings › Sources).
