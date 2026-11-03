## Feature goal
Score every job that passes the free prefilter against the operator's real experience, so only strong matches get drafts (SPEC F3.3–F3.4).

## Acceptance criteria
- [ ] AC-1: Jobs that pass triage are scored in batches; each gets a 0–100 match score, a role summary, a description summary, strengths and gaps.
- [ ] AC-2: Strengths reference fact-bank entries; gaps name requirements the fact bank doesn't cover.
- [ ] AC-3: Jobs at or above the draft threshold move on to drafting; others stay scored and are counted as "below threshold" in Review.
- [ ] AC-4: HN Who's Hiring threads are split into individual jobs before scoring.
- [ ] AC-5: A batch that fails or returns malformed output is retried once, then those jobs are marked "not scored" with the reason; the run continues.
- [ ] AC-6: Scoring stops when the token budget hard stop is reached.

## Must not break
- MNB-1: Jobs already scored are not re-scored on later runs.

## Known risks
- Open question: batch size (cost vs quality). Recommended: tune after measuring; start at 10.
- Score consistency between runs isn't guaranteed; thresholds may need adjusting.

## Test plan
- AC-1: Tests with a fake engine returning fixed scores; fields stored.
- AC-2: Test rejects strengths citing unknown facts.
- AC-3: Tests at, above and below the threshold.
- AC-4: Fixture HN thread split into expected jobs.
- AC-5: Tests with malformed output and an engine error.
- AC-6: Test with the budget guard at 100%.
- MNB-1: Test runs twice; the engine is called once per job.

## Out of scope
- Drafting (PR-17).
