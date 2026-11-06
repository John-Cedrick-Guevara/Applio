## Feature goal
Fix what the pre-production QA pass found in the real app (2026-11-06): live sources, the real Claude Code engine and MCP server, and every page, on an isolated data folder.

## Acceptance criteria
- [x] AC-1: `get_jobs` sends at most 3,000 characters of each posting, so a 10-job batch stays inside Claude Code's tool-output limit and costs far fewer tokens (F5).
- [x] AC-2: Applio's Claude Code calls run with the operator's own hooks disabled (F7).
- [x] AC-3: Review can list the jobs scored below the draft threshold, best first, each linking to its posting (F9).
- [x] AC-4: With no target role yet, the scheduler checks again on the next tick instead of waiting a full interval, and doesn't log it as a failure (F1).
- [x] AC-5: Each unscored job gets one "Not scored" note, not two (F6).
- [x] AC-6: A fresh install starts Upwork switched off (no source behind it yet) and doesn't claim watchlist companies it doesn't have (F3, F4).
- [x] AC-7: The sidebar token meter turns amber from 80%, like the Usage page, and its numbers don't wrap (F8, F11).
- [x] AC-8: Applications with no applications at all says "No applications yet" (F10).

## Must not break
- MNB-1: Scoring, drafting, sending and every earlier test behave as before.

## Decisions (2026-11-06)
- 3,000 characters per posting: requirements come early in nearly every post. In QA, whole postings averaged 3,500 and reached 10,400, and the batch holding the longest ones saved no scores.
- Hooks are switched off with `--settings '{"disableAllHooks":true}'`. Checked live: 0 hook events, and a call's fixed overhead fell from about 9,500 to about 800 tokens.
- Below-threshold jobs are listed in place in Review's queue (Show them / Hide them). Drafting one anyway is a later feature.
- Existing installs keep their own source settings; only fresh installs get the new Upwork and watchlist defaults.

## Known risks
- A posting whose requirements come after 3,000 characters is scored on less; the cap is one constant to raise.

## Test plan
- AC-1: `tools.test.ts` › "sends at most 3,000 characters of each posting…"
- AC-2: `claude-code-engine.test.ts` › "keeps the operator's own Claude Code hooks out of Applio's calls"
- AC-3: `review-page.test.tsx` › "lists the jobs scored below the draft threshold when asked, each linking to its posting"
- AC-4: `scheduler.test.ts` › "retries on the next tick when no target role is set yet, without logging it as a failure"
- AC-5: `score-jobs.test.ts` › "notes each unscored job once, even when a retry note came before the stop"
- AC-6: `settings-service.test.ts` › "starts sources Applio cannot fetch yet switched off, and claims no watchlist companies"
- AC-7: `engine-card.test.tsx` › "turns the token meter amber from 80% of the daily budget"
- AC-8: `applications-page.test.tsx` › "says there are no applications yet, rather than that a filter hid them"
- MNB-1: the full suite.

## Out of scope
- Drafting a below-threshold job on request; a watchlist editor; the Upwork API.
