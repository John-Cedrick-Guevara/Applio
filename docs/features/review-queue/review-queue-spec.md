## Feature goal
Give the operator one place that lists every prepared draft waiting on them, best match first, with the last run's results and control over automation (SPEC F5, F6; prototype screen 1). The selected draft's detail is PR-4b.

## Acceptance criteria
- [ ] AC-1: Review lists drafts waiting on the operator, highest match first, each with role, company, source, score, a channel chip (amber for manual-handoff channels) and its state (Draft ready / Ready to hand off / Sent / Skipped).
- [ ] AC-2: The header shows the last run summary; Run now runs discovery and refreshes the queue; Pause automation shows a paused banner with Resume and disables Run now.
- [ ] AC-3: With no drafts waiting, Review shows an empty state pointing to Add job.

## Must not break
- MNB-1: The sidebar Review count matches the number of drafts waiting.

## Known risks
- "Sent" items stay in the queue until reload, which the operator might read as still pending.

## Test plan
- AC-1: `review-page.test.tsx` — four rows, first is the 88 match and selected; `review-model.test.ts` queueState.
- AC-2: `review-page.test.tsx` — pause disables Run now; `review-model.test.ts` runLine; manual Run now.
- AC-3: Manual: skip all drafts and reload Review.
- MNB-1: Manual: approve one draft, navigate, count drops by one.

## Out of scope
- The draft detail, approval and editing (PR-4b); the handoff page (PR-4c).
- Real sending and the scheduler (Stage 2).
- Bulk approve.
