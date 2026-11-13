## Feature goal
A pasted job Applio already has is caught for free, before Claude reads it, so duplicates cost no tokens (QA 2026-11-07 #6). Roadmap: `docs/features/redesign-v2/redesign-v2-roadmap.md` PR-7.

## Acceptance criteria
- [x] AC-1: A pasted post or page whose first lines plainly name a role and company ("Role at Company", "Company is hiring a Role", "A — B" either way) that matches a stored job returns that job as a duplicate with no AI call and zero tokens used.
- [x] AC-2: A duplicate found this way cannot be added; the existing "Open existing" flow still applies.
- [x] AC-3: A post that names no clear role and company, or no stored match, is analyzed by AI exactly as before.
- [x] AC-4: Get jobs › Paste a job says a post naming a job you already have is caught first, for free.

## Must not break
- MNB-1: Analysis of a new post is unchanged (same prompt, same checks).
- MNB-2: Platform links are still never opened, and the post stays untrusted data (only used as text to match, never followed).

## Known risks
- The first-lines match is a heuristic: it can miss a duplicate (it then costs one analysis, as today) but only returns a duplicate when company and title match a stored job's dedup key.

## Test plan
- AC-1: `backend.test.ts` › "finds a pasted job Applio already has without calling AI"; `analyze-job.test.ts` › `statedJobs` tests.
- AC-2: `backend.test.ts` › "finds a pasted job Applio already has without calling AI" (add refused); existing "refuses to add a job Applio already has, naming it".
- AC-3: `backend.test.ts` › "reads a post with no clear role and company with AI as before"; `analyze-job.test.ts` › "reads nothing from a post that names no clear role and company".
- AC-4: `add-job-page.test.tsx` › "states the paste's cost against today's budget".
- MNB-1: existing `analyze-job.test.ts` and `backend.test.ts` analyze tests.
- MNB-2: existing platform-link refusal tests.

## Out of scope
- Matching on the apply email or domain; page-metadata extraction for links.
