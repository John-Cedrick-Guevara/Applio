## Feature goal
Make the token budget reflect real cost and stop before going over it, not after (SPEC F10; QA: 95k used against a 60k cap, and cached reads counted at full price).

## Acceptance criteria
- [x] AC-1: Each AI call's usage is recorded as input (fresh plus cache writes), cache reads and output, and counts against the budget with cache reads at a tenth (their share of the price).
- [x] AC-2: Before a call, Applio estimates it from the average of the last 5 calls of the same step; if that would take today or this month past its budget, the call is refused before it runs, saying what it would cost and what's left.
- [x] AC-3: Job token totals, the analysis cost shown in Add job, interview-prep cost, the sidebar and the Usage page all use the same weighted count.

## Must not break
- MNB-1: The 80% warning and the hard stop at 100% still work, and raising a budget still resumes work at once.
- MNB-2: A step with no history yet isn't blocked by the estimate (only the hard stop applies).

## Decisions (2026-11-06)
- Weighted tokens = input (fresh + cache writes) + output + cache reads ÷ 10 (rounded up). Cache writes are counted in full; they cost slightly more than full. The budget stays a token count, not money.
- The estimate is the mean weighted cost of the step's last 5 recorded calls.
- Existing usage rows keep their stored totals; the new columns start at 0 for them.

## Known risks
- An unusually large call can still exceed its estimate; the hard stop then catches the next one, as before.

## Test plan
- AC-1: `ai-service.test.ts`: the usage row holds every part and the weighted total; `claude-code-engine.test.ts` and `api-engine.test.ts` report cache reads apart; `records.test.ts` round-trips the new columns.
- AC-2: `ai-service.test.ts`: refused when the estimate would pass the daily or monthly budget, with the message; allowed when it fits.
- AC-3: `draft-jobs.test.ts` › "adds each call's tokens to the job" and the backend drafting tests (job totals); `budgetTokens` is the one function every total uses (drafting, Add job analysis, interview prep, usage rows).
- MNB-1: existing `ai-service.test.ts` warning and stop tests; `backend.test.ts` raise-the-budget test.
- MNB-2: `ai-service.test.ts`: no history → no estimate.

## Out of scope
- A money-based budget.
