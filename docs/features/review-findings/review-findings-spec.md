## Feature goal
Fix the smaller defects found while reviewing PR-13 to PR-23a (#26–#38), so the merged pipeline behaves as its specs promise in the edge cases too.

## Acceptance criteria
- [x] AC-1: Jobs left unscored because the token budget ran out or automation was paused get a "Not scored: <reason>" note, like any other unscored job.
- [x] AC-2: Two jobs whose folder names come out the same never share a folder: the second gets its own, named with a short job id.
- [x] AC-3: An API-engine reply cut off at the output limit is reported as an error, not used as a complete answer.
- [x] AC-4: A saved draft's kind follows Applio's rule (proposal for freelance and Upwork, cover letter otherwise), whatever Claude sent.

## Must not break
- MNB-1: Jobs scored, drafted and filed normally behave exactly as before.

## Known risks
- None beyond the original PRs'.

## Test plan
- AC-1: `score-jobs.test.ts` › budget stop notes the remaining jobs.
- AC-2: `application-files.test.ts` › a taken folder name gets a short job id.
- AC-3: `api-engine.test.ts` › a `max_tokens` stop is an error.
- AC-4: `tools.test.ts` › the kind follows the job, not the input.
- MNB-1: the full suite passes unchanged.

## Out of scope
- New behavior, and #39 / #40, which are still in review.
