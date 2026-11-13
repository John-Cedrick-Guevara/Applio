## Feature goal
Let the operator work through the Inbox in order instead of scanning it: after each decision the next job opens, the list answers to A (approve) and S (skip), and a skip can be undone for a few seconds instead of being confirmed up front. Roadmap: `docs/features/redesign-v2/redesign-v2-roadmap.md` PR-4b. Design: canvas row "Redesign v2", board 1 (Inbox).

## Acceptance criteria
- [x] AC-1: Skip job in the Inbox hides the job at once, opens the next job, and shows "Skipped <role> at <company>." with Undo for about 5 seconds, with no confirm dialog. Undo brings the job back and opens it, and nothing is skipped; otherwise `skipJob` runs once. Leaving the Inbox saves a held skip.
- [x] AC-2: With "Open the next job after each decision" on (the default), a send that went out (a sent record exists) or Mark as applied opens the next job and says what happened ("Sent to … ." / "Marked as applied."). Off, the job stays open on its result.
- [x] AC-3: A send that didn't go out never moves on: the job stays open with Not sent and Retry.
- [x] AC-4: With focus in the list, A presses the open job's Approve (same rules: disabled with its reason, the suspicious second confirm, Gmail setup) and S skips it (held with Undo). A hint under the list names the keys.
- [x] AC-5: Approve has no Undo; its message says it went out.
- [x] AC-6: The sidebar's Inbox badge updates when a job changes in main (a saved skip, a send), without navigation, so it never lags the list.

## Must not break
- MNB-1: A suspicious post still needs the second "Send anyway" click, also via A.
- MNB-2: ↑ and ↓ still move between rows.
- MNB-3: No send without the operator's click or key press.
- MNB-4: A skip that fails to save brings the job back and says why.

## Known risks
- A held skip is lost if the app quits within 5 seconds; the job just stays in the Inbox.
- A presses the button found on the page by id; if the detail isn't a draft (no Approve), A does nothing.

## Test plan
- AC-1: `inbox-flow.test.tsx` › "skips with undo instead of a confirm, opening the next job", "brings a skipped job back on undo, and opens it", "saves a held skip when the Inbox closes"; `use-held-action.test.tsx` (PR-3).
- AC-2: `inbox-flow.test.tsx` › "opens the next job after a send that went out, saying where it went", "stays on the sent job when Open the next job is off", "moves on after Mark as applied".
- AC-3: `review-page.test.tsx` › "keeps a refused send in the Inbox as Not sent with the reason and Retry, never as Sent".
- AC-4: `inbox-flow.test.tsx` › "approves with A from the list, through the same button", "does nothing on A while Approve is disabled", "skips with S from the list"; `inbox-queue.test.tsx` › "names the keys under the list, with the next-job switch on".
- AC-5: `inbox-flow.test.tsx` › "opens the next job after a send that went out, saying where it went, with no undo".
- AC-6: `sidebar.test.tsx` › "updates the Inbox badge when main reports a job changed, without navigation".
- MNB-1: `inbox-flow.test.tsx` › "asks for the second confirm when A approves a suspicious post".
- MNB-2: `review-page.test.tsx` › "moves through the queue with the arrow keys".
- MNB-3: `inbox-flow.test.tsx` › "approves with A from the list, through the same button" (A only clicks the visible, enabled button).
- MNB-4: `inbox-flow.test.tsx` › "brings a job back when its skip fails, saying so".

## Out of scope
- Skip with Undo on the undrafted job panel (opened from Matches; Matches has its own Undo). The ConfirmDialog component is removed with its last use.
