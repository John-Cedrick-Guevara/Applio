## Feature goal
Fix the chopped UI the operator reported (screenshots, 2026-11-13): a pending step collapsing into a 12px circle, an unreadable button in warning banners, and Inbox rows cutting off the company. Roadmap: Trash (PR B) and Clean up (PR C) follow.

## Acceptance criteria
- [x] AC-1: A pending step in a step list (drafting panel, Get jobs scan) keeps its full row width; the small dot has its own class, separate from the row's state class.
- [ ] AC-2: A primary button inside a warning or danger banner reads white on blue (e.g. "Open existing").
- [ ] AC-3: An Inbox row truncates the role and the company separately, so a long role never hides the company; the full text stays in the tooltip.
- [ ] AC-4: The Inbox header no longer repeats the sidebar's Get jobs button.
- [ ] AC-5: The activity bar sits flush to the top of the window and no longer overlaps the page's first lines; the Inbox list's sticky offset sits just below it.

## Must not break
- MNB-1: Active and done steps still show their spinner and check.
- MNB-2: Banner links (non-button) keep inheriting the banner colour.
- MNB-3: An empty Inbox still offers Get jobs and Matches.

## Known risks
- Layout is not computed in jsdom; AC-1 and AC-2 are checked against the stylesheet text, AC-3 against structure. A browser look is part of the manual checks.

## Test plan
- AC-1: `job-state.test.tsx` › "gives a pending step's dot its own class, so the row keeps its width"; `styles.test.ts` › "keeps the step-list dot rule off the row's state class".
- AC-2: `styles.test.ts` › "keeps primary buttons white inside warning and danger banners".
- AC-3: `inbox-queue.test.tsx` › "truncates the role and the company separately, keeping the full text in the tooltip".
- AC-5: `styles.test.ts` › "pins the activity bar flush to the top, by cancelling the page padding in its sticky offset"; measured in Chrome (bar top 0).
- AC-4: `review-page.test.tsx` › "leaves starting a scan to the sidebar's Get jobs button".
- MNB-1: existing `job-state.test.tsx` StepList tests.
- MNB-2: `styles.test.ts` › "keeps primary buttons white…" (links rule unchanged).
- MNB-3: `review-page.test.tsx` › "says nothing needs a decision when the Inbox is empty".

## Out of scope
- Trash and Restore (PR B); Clean up (PR C); the activity bar's top spacing (checked separately).
