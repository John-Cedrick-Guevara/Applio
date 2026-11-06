## Feature goal
Score every job that passes the free prefilter against the operator's real experience, so only strong matches get drafts (SPEC F3.3–F3.4).

## Acceptance criteria
- [x] AC-1: Jobs that pass triage are scored in batches; each gets a 0–100 match score, a role summary, a description summary, strengths and gaps.
- [x] AC-2: Strengths reference fact-bank entries; gaps name requirements the fact bank doesn't cover.
- [x] AC-3: Jobs at or above the draft threshold move on to drafting; others stay scored and are counted as "below threshold" in Review.
- [x] AC-4: HN Who's Hiring threads are split into individual jobs before scoring.
- [x] AC-5: A batch that fails or returns malformed output is retried once, then those jobs are marked "not scored" with the reason; the run continues.
- [x] AC-6: Scoring stops when the token budget hard stop is reached.

## Must not break
- MNB-1: Jobs already scored are not re-scored on later runs.
- MNB-2: Review and Applications read jobs from the database, so nothing on them is mock data once a real job exists.

## Decisions (defaults picked while building, 2026-11-06; change any in review)
- Batch size 10, as the spec suggested. One AI call per batch: Claude reads the profile and the batch through the MCP tools and calls `save_match` once per job.
- "Malformed output" means a job in the batch still has no score after the call. Those jobs alone are retried once.
- Only the jobs saved by this run are scored. A job left unscored keeps a "Not scored: <reason>" note on its timeline and isn't retried on later runs (MNB-1). Re-scoring by hand comes with the Review actions later.
- Each strength cites the fact that shows it: `save_match` takes `{ text, factId }` and rejects unknown IDs. The stored strength is the text.
- A budget hard stop or a pause mid-run stops the remaining batches. The run's details say how many were scored, how many weren't, and why it stopped.
- "Move on to drafting" means a scored job at or above the draft threshold. PR-17 drafts from that list, so this PR only reports the count.
- `listJobs` and `getJob` now read SQLite (MNB-2). Review, Applications and the draft panel no longer show the seeded mock jobs in the real app. Browser dev and tests keep the mock.
- AC-4 already holds: the HN source turns each top-level comment into one job (PR-11b), so scoring sees one job per post.

## Known risks
- Score consistency between runs isn't guaranteed; thresholds may need adjusting.
- Prompt quality can only be judged on real runs; the prompt is one constant in `core/scoring`.

## Test plan
- AC-1: `score-jobs.test.ts` with a fake AI that saves scores: batches of 10, the request's step, scope and prompt.
- AC-2: `tools.test.ts`: a strength citing an unknown fact is rejected; the stored strength is its text.
- AC-3: `score-jobs.test.ts`: at, above and below the threshold.
- AC-4: `feeds.test.ts` › "fetches this month's thread and offers each top-level comment as a job" (existing).
- AC-5: `score-jobs.test.ts`: a job the AI skipped is retried alone once, then noted; an engine error retried once, then noted; the next batch still runs.
- AC-6: `score-jobs.test.ts`: a quota error stops the remaining batches and reports why.
- MNB-1: `score-jobs.test.ts`: a job that's already scored isn't sent; `backend.test.ts`: a second run sends no job twice.
- MNB-2: `backend.test.ts`: `listJobs` and `getJob` return the stored jobs.

## Out of scope
- Drafting (PR-17).
