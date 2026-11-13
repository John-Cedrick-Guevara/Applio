## Feature goal
Score a job a scan left unscored, on request, instead of waiting for a scan the operator may not run (scans are manual). Roadmap: `docs/features/redesign-v2/redesign-v2-roadmap.md` PR-6.

## Acceptance criteria
- [x] AC-1: `scoreJob(jobId)` scores one job that isn't scored yet, through the same checks and save as a scan's scoring, and returns it scored.
- [x] AC-2: It refuses a job that is already scored (or further along).
- [x] AC-3: It refuses when the token budget is used up, before any AI call, and leaves the job unscored.
- [x] AC-4: Its tokens are recorded as scoring, like a scan's.
- [x] AC-5: Matches shows "Score · ≈ 2k" on unscored rows and "Score n" for unscored jobs in a selection; a scored row updates in place.

## Must not break
- MNB-1: A scan still scores its new jobs the same way (shared code path).
- MNB-2: IPC input is validated (a job id) like every other call.

## Known risks
- Scoring one job is a full AI call (no batching); the button says its cost first.

## Test plan
- AC-1: `backend.test.ts` › "scores one job on request, recording its tokens as scoring".
- AC-2: `backend.test.ts` › "scores only jobs not scored yet".
- AC-3: `backend.test.ts` › "refuses to score once the token budget is used, without calling AI".
- AC-4: `backend.test.ts` › "scores one job on request, recording its tokens as scoring".
- AC-5: `matches-page.test.tsx` › "scores an unscored job on request, showing its cost", "scores the unscored jobs in a selection".
- MNB-1: `backend.test.ts` › "scores a scan's jobs but drafts none unless the scan asks", "pushes the new token total after every AI call…".
- MNB-2: `ipc.test.ts` / `schemas.test.ts` existing coverage of every API method.

## Out of scope
- Batching several selected jobs into one scoring call.
