## Feature goal
Drop most jobs for free before any AI token is spent (SPEC F3, principle 5).

## Acceptance criteria
- [x] AC-1: Jobs that match an existing or earlier job by company + normalized title are merged into one, whichever source they came from ("Sr." = "Senior", "Back-end" = "Backend", "Acme, Inc." = "Acme").
- [x] AC-2: The prefilter drops jobs whose title doesn't contain every word of at least one target role (any order, ignoring case, with common variants treated as one word), aren't remote when remote-only is set, fall below a parseable minimum pay, can't overlap the required hours, or are of an employment type not wanted.
- [x] AC-3: Jobs from blocklisted companies are dropped (case-insensitive).
- [x] AC-4: Each run records how many jobs were dropped per reason and how many passed.
- [x] AC-5: Jobs whose pay or hours can't be read are kept, not dropped.

## Must not break
- MNB-1: An already-sent application is never re-queued because a duplicate posting appears.

## Decisions (settled with the requester, 2026-11-05)
- Role match: all words of any one target role, in any order. "Senior Backend Developer (Node)" passes "Backend Engineer"; "Sales Engineer" doesn't.
- Dedup key: company + normalized title, with no apply URL. Each board links to its own copy of a job, so URLs would never match across boards. SPEC F3 is updated to match. Two openings with the same title at one company are merged; that's rare for remote roles.
- Pay and hours preferences stay free text. They're parsed best-effort ("$90k / year", "€45/hour", "At least 4h with UTC−5 to UTC+2"), and anything unreadable filters nothing (AC-5).

## Found while building
- AC-4: `triage()` returns the counts in a `TriageReport`. Storing them with the run summary is the scheduler's job (PR-13).
- Himalayas gives each job's UTC offsets, so the hours filter uses them. Other boards' offsets come from "UTC−3 to UTC+1" / "GMT+8" in the location, when present.

## Known risks
- Target is dropping 80–90%; real rates need measuring after PR-11.

## Test plan
- AC-1: Pure tests in `core/triage`: the same job from two sources, normalized titles ("Sr." vs "Senior"), company suffixes, and different titles kept apart.
- AC-2: One test per filter, including boundary values.
- AC-3: Test with mixed-case blocklist names.
- AC-4: Test asserts the per-reason counts for a mixed batch.
- AC-5: Tests with unparseable pay and hours.
- MNB-1: Test with a duplicate of an applied job.

## Out of scope
- AI scoring (PR-16).
