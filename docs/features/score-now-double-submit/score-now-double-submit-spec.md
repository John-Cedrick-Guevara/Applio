## Feature goal
Fix a bug found reviewing #84 (STRESS-005): two `scoreJob` calls for the same job at the same time both passed the status check and both paid for a scoring call.

## Acceptance criteria
- [x] AC-1: A second `scoreJob` for a job already being scored is refused with "Already scoring this job." and makes no AI call; the first still finishes and returns the scored job.
- [x] AC-2: A job whose scoring fails can be scored again afterwards (the in-flight mark is always cleared).
- [x] AC-3: The review log records full passes and real-backend evidence for #83, #84, #86 and #87.

## Must not break
- MNB-1: Scoring one job, refusing a scored job, and refusing at the budget stop behave as before.
- MNB-2: A scan's scoring is unchanged (it doesn't use the in-flight set).

## Known risks
- A scan and a Score click on the same job at the same moment can still both score it; the scan's own scoring skips jobs already scored, so it costs at most one extra call.

## Test plan
- AC-1: `backend.test.ts` › "scores a job once when asked twice at the same time, so it never spends twice".
- AC-2: cleared in `finally`; covered by "scores one job on request…" followed by the refusal test (state clean after completion).
- AC-3: `docs/features/redesign-v2/redesign-v2-review-log.md` (read it).
- MNB-1: `backend.test.ts` › "scores one job on request, recording its tokens as scoring", "scores only jobs not scored yet", "refuses to score once the token budget is used, without calling AI".
- MNB-2: `backend.test.ts` › "scores a scan's jobs but drafts none unless the scan asks".

## Out of scope
- Coordinating a scan with a Score click.
