## Feature goal
Drafted résumés read as generic: task bullets without proof, soft-skill claims, thin pages, and project bullets that repeat the project's description. The operator wrote a stricter résumé prompt (read the post like a hiring manager, map evidence, select, write, self-review). Applio's drafting instructions should follow it, so each résumé passes ATS for that exact post and proves fit in a 6-second scan, still using only fact-bank content.

## Acceptance criteria
- [ ] AC-1: The drafting instructions tell Claude to rank the post's 8–10 requirements and mark each as Proven, Supported, or Gap from the fact bank, and never to fill a Gap with invented content (Gaps are left out of the résumé and reported in keywords.gaps).
- [ ] AC-2: The instructions set the selection rules: most relevant role 5–6 bullets, other roles 3–4, at most 3 projects with at least 2 substantive bullets each, no project that repeats Experience work, about 18–22 bullets for a 90–100% full A4 page.
- [ ] AC-3: The instructions set the writing rules: a headline worded as the post words the role; a summary of 3 lines max, one sentence each (scope, two numbered proofs, one differentiator); banned soft-skill claims; bullets as strong action verb + what I built or changed + how (the mechanism) + result/scale, with numbers used exactly as the fact states.
- [ ] AC-4: Project bullets must not restate the project's context line, which Applio prints from the fact bank (Claude does not write a description line).
- [ ] AC-5: The instructions end the résumé with a self-review checklist (must-haves present, top third proves fit, every bullet has proof, no repeats, nothing invented, page fill).

## Must not break
- MNB-1: The instructions hold no personal facts (name, employers, phone, handle); those come from get_profile at run time.
- MNB-2: Fact-citation rules still apply: every résumé line rewords one fact and cites its id, and save_draft still refuses lines whose numbers aren't in the cited fact.
- MNB-3: Questions flow, cover-letter rules, untrusted-post rule, and "never tell me to skip a job" are unchanged.
- MNB-4: Drafting behavior (one call per job, retry once, Notify-only skip, budget stop) is unchanged.

## Known risks
- A longer system prompt costs more input tokens per draft; it's static, so prompt caching absorbs most of it after the first job.
- The 5–6-bullet top role and 18–22 total may exceed save_draft's 12-items-per-section cap only if Claude ignores the targets; the cap still refuses it and Claude retries.
- Quality improvement is judged by reading real drafts, not by unit tests.

## Test plan
- AC-1, AC-2, AC-3, AC-4, AC-5: `draft-jobs.test.ts` "follows the operator's résumé-strategist instructions…" asserts the key rule phrases are in DRAFT_SYSTEM (Gap rule, bullet formula, summary shape, 18–22 bullets, context-line rule).
- AC-1, AC-2, AC-3, AC-4, AC-5: Manual: draft one saved job on a copy of the DB and check the résumé against the self-review checklist.
- MNB-1: same test asserts no personal facts appear in DRAFT_SYSTEM.
- MNB-2: `src/mcp/tools.test.ts` save_draft citation and metrics tests still pass.
- MNB-3: same prompt test still asserts the questions, cover-letter, untrusted, and never-skip phrases.
- MNB-4: the rest of `draft-jobs.test.ts` passes unchanged.

## Out of scope
- Changing the résumé PDF layout or the save_draft schema.
- Cover letter and proposal rules.
- Automatic page-fill measurement (Claude estimates; Applio does not re-flow).
