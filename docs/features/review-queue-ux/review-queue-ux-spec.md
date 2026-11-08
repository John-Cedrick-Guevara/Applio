## Feature goal
Keep Review calm with a long queue (operator feedback 2026-11-08: 25 drafts read as one wall of identical three-line rows, each repeating "Career site · Ready to hand off").

## Acceptance criteria
- AC-1: The queue is grouped by the next action, most urgent first: Approved, not sent · Needs your answers · Drafting now · Ready to send · To hand off. Each group header shows its count; empty groups are hidden.
- AC-2: A filter (All · Needs you · Send · Hand off, each with a count; empty filters hidden) shows one kind of work at a time.
- AC-3: Rows have two lines: the title (one line, full title on hover) and score, then company · channel. A badge appears only for exceptions: not sent, questions, suspicious post, skipped.
- AC-4: The queue stays in view and scrolls inside its card, so a long queue never pushes the draft away.
- AC-5: With 12 or more drafts and a draft score under 50, the queue says most matches get drafted and links to Settings.
- AC-6: "Not scored yet" and "below threshold" stay collapsed, as one-line footers with inline Show them links.

## Must not break
- MNB-1: Every Review test from #58–#68 (the not-sent group, drafting, questions, below-threshold rows, selection).

## Test plan
- AC-1: `review-model.test.ts` › `queueGroups`; `review-queue.test.tsx` › "groups drafts by what to do next…"
- AC-2: `review-queue.test.tsx` › "groups drafts by what to do next, with counts, and filters to one group"
- AC-3: `review-queue.test.tsx` › "shows a badge only for exceptions…", "keeps the full title available…"
- AC-4/6: visual check in Chrome
- AC-5: `review-queue.test.tsx` › "suggests raising a low draft score…", "stays quiet about the draft score…"
- MNB-1: `review-page.test.tsx` unchanged and passing.
