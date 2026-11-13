## Feature goal
Turn Review into an Inbox that holds only decisions, one tab at a time, so it stays calm with dozens of drafts and its badge matches its list. Undrafted, below-bar and unscored jobs now live in Matches (PR-3). Roadmap: `docs/features/redesign-v2/redesign-v2-roadmap.md` PR-4a (PR-4b adds approve-and-next, keys and Undo). Design: canvas row "Redesign v2", board 1 (Inbox).

## Acceptance criteria
- [x] AC-1: `/inbox` and `/inbox/:id` show the Inbox; `/review` and `/review/:id` redirect there, and the app opens on it. Every in-app link that pointed at Review points at the Inbox.
- [x] AC-2: Four tabs with counts: Fix first (approved but not sent, and suspicious posts), Answer (Claude's questions), Approve (drafts that send on approval), Hand off (drafts you apply to yourself). Each waiting job is in exactly one tab.
- [x] AC-3: The Inbox opens on the most urgent non-empty tab, or on the tab of the job in the URL.
- [x] AC-4: Rows are one line (score, role · company, age), with a label only for an exception (Not sent, Check post); the list scrolls in its own frame and sorts by best match or oldest.
- [x] AC-5: The sidebar's Inbox badge equals the number of jobs in the four tabs.
- [x] AC-6: Jobs Claude is drafting show under "Drafting now" with a link to each, so no job in progress is in no list.
- [x] AC-7: An empty tab says it's clear and offers the next non-empty tab; an empty Inbox says nothing needs a decision, with Matches and Find jobs.
- [x] AC-8: Review's undrafted, below-bar and not-scored footers are gone; a job opened from Matches still shows its detail.

## Must not break
- MNB-1: ↑ and ↓ still move between rows and open the one they land on.
- MNB-2: An approved job that didn't send stays listed (Fix first) until it sends or is skipped.
- MNB-3: No job is in neither the Inbox, Matches nor Applications.
- MNB-4: The job state card, stepper and approve flow from PR-1 are unchanged.

## Known risks
- Old bookmarks and Telegram/notification links use `#/review/:id`; the redirect keeps them working.
- The page files keep their `review-*` names to keep the diff small; only routes and copy change.

## Test plan
- AC-1: `app.test.tsx` › "redirects old Review links to the Inbox", "opens on the Inbox".
- AC-2: `review-model.test.ts` › "files each waiting job under exactly one tab", "puts a suspicious post under Fix first".
- AC-3: `inbox-queue.test.tsx` › "opens on the most urgent tab with jobs", "opens on the tab of the job in the URL".
- AC-4: `inbox-queue.test.tsx` › "shows one line per job with a label only for exceptions", "sorts by best match or oldest"; `review-model.test.ts` › "sorts a tab by best match or oldest".
- AC-5: `sidebar.test.tsx` › "badges the Inbox with exactly its decisions".
- AC-6: `inbox-queue.test.tsx` › "lists jobs Claude is drafting, each linked".
- AC-7: `inbox-queue.test.tsx` › "points an empty tab to the next one with jobs"; `review-page.test.tsx` › "says nothing needs a decision when the Inbox is empty".
- AC-8: `review-page.test.tsx` › "opens a job from Matches in the detail", "has no undrafted or below-bar footers".
- MNB-1: `review-page.test.tsx` › "moves through the queue with the arrow keys".
- MNB-2: `review-page.test.tsx` › "keeps a refused send in the Inbox as Not sent with the reason and Retry, never as Sent", "lists a job left approved but unsent after a reload…".
- MNB-3: `review-model.test.ts` › "files each waiting job under exactly one tab"; `matches-model.test.ts` (unscored and scored jobs).
- MNB-4: existing `job-card.test.ts`, `review-page.test.tsx` card and approve tests unchanged.

## Out of scope
- Approve-and-next, A/S keys, Skip with Undo (PR-4b). Renaming the `review-*` files.
