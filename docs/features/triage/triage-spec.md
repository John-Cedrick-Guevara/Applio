## Feature goal
Drop most jobs for free before any AI token is spent (SPEC F3, principle 5).

## Acceptance criteria
- [ ] AC-1: Jobs that match an existing job by company + normalized title + apply URL are merged, whichever source they came from.
- [ ] AC-2: The prefilter drops jobs that miss target-role keywords, aren't remote when remote-only is set, fall below a parseable minimum pay, can't overlap the required hours, or are of an employment type not wanted.
- [ ] AC-3: Jobs from blocklisted companies are dropped (case-insensitive).
- [ ] AC-4: Each run records how many jobs were dropped per reason and how many passed.
- [ ] AC-5: Jobs whose pay or hours can't be read are kept, not dropped.

## Must not break
- MNB-1: An already-sent application is never re-queued because a duplicate posting appears.

## Known risks
- Open question: how strict should role keyword matching be (exact phrase vs any keyword)? Recommended: any keyword, case-insensitive.
- Target is dropping 80–90%; real rates need measuring after PR-11.

## Test plan
- AC-1: Pure tests in `core/triage`: same job from two sources, normalized titles ("Sr." vs "Senior"), different apply URLs kept apart.
- AC-2: One test per filter, including boundary values.
- AC-3: Test with mixed-case blocklist names.
- AC-4: Test asserts the per-reason counts for a mixed batch.
- AC-5: Tests with unparseable pay and hours.
- MNB-1: Test with a duplicate of an applied job.

## Out of scope
- AI scoring (PR-16).
