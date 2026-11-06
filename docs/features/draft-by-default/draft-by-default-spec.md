## Feature goal
Nothing is sent without the operator until they choose it: every source starts at Draft → Approve or lower (SPEC F6, CLAUDE.md §1.4).

## Acceptance criteria
- [x] AC-1: A fresh install has no source set to Autonomous; Himalayas and the ATS watchlist start at Draft → Approve.

## Must not break
- MNB-1: An install's existing choices are kept (seeding only adds sources it doesn't have).

## Decisions (settled with the requester, 2026-11-06)
- Himalayas and the ATS watchlist move from Autonomous to Draft → Approve. Autonomous stays available in Settings → Sources.
- The requester's own install was switched to Draft directly in its database, at their request.

## Known risks
- None.

## Test plan
- AC-1: `settings-service.test.ts` › "starts every source below Autonomous, so nothing is sent on its own until the operator chooses it".
- MNB-1: `settings-service.test.ts` › "adds a newly shipped default source to an existing install, keeping its other choices" (existing).

## Out of scope
- Changing the autonomy rules themselves.
