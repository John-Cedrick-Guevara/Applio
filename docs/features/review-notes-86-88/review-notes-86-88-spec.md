## Feature goal
Act on the minor notes from the independent review of #86, #87 and #88 (a reviewer that did not write the code): pin two behaviours with tests and fix a misplaced doc comment. No behaviour changes.

## Acceptance criteria
- [x] AC-1: A test proves the inactive Get jobs tab panel is hidden (not visible) while staying mounted, in both directions (#86 AC-2).
- [x] AC-2: A test proves a job whose scoring failed can be scored again afterwards (#88 AC-2).
- [x] AC-3: `runDiscovery`'s doc comment sits directly above it, with `scoringNow` and `scoreIds` documented on their own (#88).
- [x] AC-4: The review log records the independent review's findings and what was done about each.

## Must not break
- MNB-1: No behaviour changes: `src/` diff is one doc comment moved.
- MNB-2: The full suite stays green.

## Known risks
- None: tests and a comment only.

## Test plan
- AC-1: `get-jobs-page.test.tsx` › "keeps a running scan on screen while the operator looks at the other tab".
- AC-2: `backend.test.ts` › "lets a job whose scoring failed be scored again".
- AC-3: read `src/main/backend.ts` near `runDiscovery`.
- AC-4: `docs/features/redesign-v2/redesign-v2-review-log.md`.
- MNB-1/2: `npm run check`.

## Out of scope
- #87's note that `Results` assumes drafted and asked jobs don't overlap and re-reads `lastRun` from status: left as is, since the scan's own summary doesn't carry `asked`; logged below.
