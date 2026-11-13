# Redesign v2 — review log

One entry per PR: how it was reviewed (`/review-pr` passes against its spec) and what was found. Kept in the repo so the evidence outlives a session.

| PR | Review | Findings → fix |
|---|---|---|
| #78 job state card | `/review-pr`, 2 rounds | Backend "draft score" message (AC-7) → fixed in the PR. Spec lacked Known risks and per-MNB test lines → fixed. |
| #79 activity bar | `/review-pr`, 2 rounds | A failed load left no bar (LOGIC-003) → message with Retry, AC-8. |
| #80 matches | `/review-pr`, 2 rounds | Saved skip's row reappeared; draft bar change lost on quick leave (LOGIC-004) → fixed. **Missed then, found later:** a job with open questions was also listed here → #87. |
| #81 inbox 4a | `/review-pr`, 2 rounds | Dead `queueState` export (LOGIC-007) → removed. ~1,020 changed lines (guide ~1,000), accepted. |
| #82 inbox 4b | `/review-pr`, 1 round | Badge lagged after a held skip saved → fixed before review (AC-6). |
| #83 get jobs | **Merged before review** (reviews were paused); reviewed afterwards | Tabs unmounted each other, losing a running scan (→ #86). Scan result count didn't match Matches; `/matches/new` filter stuck; stale "Review" copy (→ #87). |
| #84 score now | **Merged before review**; reviewed afterwards | No blocking findings: quota check runs before the AI call, status must be `found`, IPC validated, tokens recorded as `score`. Note: scoring a job a scan is scoring at the same moment could spend twice (accepted; single operator, small). |
| #85 paste dedup | `/review-pr`, 2 rounds | Duplicate preview showed the raw channel id and a fake route (LOGIC-002) → `describeRoute`. |
| #86 keep scan | Gate 0 + checks (found by the #83 review) | Test failed before the fix. |
| #87 scan counts | Gate 0 + checks (found by the #80/#83 review and browser run) | See its spec. |

## Verified in a browser (Chrome against the mock API, `npm run dev:web`)
Get jobs (redirect from `/find-jobs`, cost line, scan result survives a tab round-trip, "Open the 2 new matches" → `/matches/new` with the filter on and a working empty state), Matches, and the Inbox (ArrowDown, S → Skipped + Undo, next job opens on the right tab).

## Not verified
- Real-backend flows (real Claude scoring, drafting, sending). Backend behaviour is covered by `backend.test.ts` with fake engines only.
- The mock scan finishes instantly, so a scan in progress was not seen in the browser (covered by a test).
- In dev-web the sidebar badge refreshes only on navigation (no status push in the mock); the real app pushes, and a test covers the push.
- The Inbox badge leads the list by one for ~5 s while a skip is held.
