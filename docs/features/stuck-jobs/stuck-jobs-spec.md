## Feature goal
Fix why the operator's first real day looked broken (2026-11-06). Run now showed "0 found" with no reason. 68 unscored jobs and one failed draft were stuck and invisible. A draft failure read "couldn't finish (success)". A reply that moved a job to Interview didn't show until the operator navigated away and back.

## Acceptance criteria
- [x] AC-1: When Claude Code flags a result as an error, the failure keeps Claude's own text (e.g. "API Error: 429 …").
- [x] AC-2: Every run also scores jobs left in `found` by earlier runs, and drafts scored jobs at or above the draft threshold that have no draft.
- [x] AC-3: A run whose sources were all at their daily poll limit says so in the Review header instead of "0 found". A run where only some were at the limit adds "N sources at today's limit".
- [x] AC-4: Review lists jobs not scored or drafted yet, each with its last failure note or "Not scored yet" / "Not drafted yet".
- [x] AC-5: When a job changes outside a page's own request (a reply, a send, a draft by Claude's MCP process), the next tick pushes status, and Review and Applications reload.
- [x] AC-6: The run line says "not yet in Applio" instead of "new after dedup": jobs dropped by filters aren't stored, so they count again each run.

## Must not break
- MNB-1: A run's new jobs are scored once, not twice; they aren't also counted as left over.
- MNB-2: The budget guard still applies to retries.
- MNB-3: A tick with no job change pushes nothing.

## Test plan
- AC-1: `claude-code-engine.test.ts` "keeps Claude Code's own error text when it flags a result as an error".
- AC-2, MNB-1: `discover.test.ts` "also retries jobs an earlier run left unscored or undrafted"; `backend.test.ts` "retries a job an earlier run left unscored/undrafted once the engine works again".
- AC-3: `records.test.ts` "says how many sources the latest run skipped at their daily poll limit"; `review-model.test.ts` both limit cases.
- AC-4: `review-page.test.tsx` "lists jobs still waiting to be scored or drafted"; `review-model.test.ts` pendingReason.
- AC-5, MNB-3: `backend.test.ts` "pushes status on a tick only when a job changed"; `jobs.test.ts` version; `applications-page.test.tsx` "reloads when main reports a job changed in the background".
- AC-6: `review-model.test.ts` "summarizes the last run".
- MNB-2: retries go through the same `ai.run` guard; existing `ai-service.test.ts`.
- Manual: in the real app, run discovery and see the 68 stuck jobs scored and the failed draft retried.

## Out of scope
- Storing filtered-out jobs for exact dedup counts.
- A per-job retry cap; the budget guard bounds cost.
