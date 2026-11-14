## Feature goal
Make the Inbox a full-width list of decisions, with each job's draft and decision in a side panel opened on demand, instead of a list and a detail squeezed side by side. Roadmap: `docs/features/v5-redesign/v5-redesign-roadmap.md` PR-4. Design: canvas board "v5 · 2 Inbox (list + side panel)" (https://claude.ai/artifact/3T4Bs69qQWvxy9xKiND79T). The tabs, sorting, decisions and send rules do not change.

Decision, recorded: A (approve) and S (skip) move from the list to the open panel, because with no job open on the list there is nothing for them to act on. They are ignored while typing in a field.

## Acceptance criteria
- [ ] AC-1: `/inbox` shows a header ("My inbox", the last-scan line) and the full-width queue (tabs with counts, hint, sort, rows). Nothing sits beside the list and no job opens by itself.
- [ ] AC-2: Each row is one link: score circle, role, "company · source", a label only for exceptions (Check post, Not sent), the apply channel, how long it has waited, and a chevron. ↑ and ↓ move focus between rows; Enter opens the focused one.
- [ ] AC-3: Opening a row (`/inbox/:id`, also from a deep link) opens the side panel with that job's existing detail (progress, state card, role and fit, draft or questions). The panel shows "n of m" for the current tab with Previous and Next, and closes on Escape, the dim layer or Close, leaving the URL at `/inbox` and focus on the row that opened it.
- [ ] AC-4: After a final decision (sent, marked applied) with "Open the next job after I decide" on, the panel shows the next job in tab order, and closes when none is left. The switch lives in the panel.
- [ ] AC-5: A approves and S skips the open job while focus is not in a text field. A goes through the Approve button, so a disabled Approve or a suspicious-post confirm still applies.
- [ ] AC-6: Skip removes the job and shows an Undo toast for about 5 seconds; Undo brings the job back and reopens it. A failed skip brings the job back and says so. Approve shows a plain confirmation with no Undo.
- [ ] AC-7: Jobs Claude is drafting are listed under the rows; opening one shows the drafting panel in the side panel.
- [ ] AC-8: An empty tab says it is clear and points to the next tab with jobs; with nothing at all, the page says nothing needs a decision with Get jobs and Open Matches.

## Must not break
- MNB-1: Nothing is sent without the operator's click, except auto-send on email/ATS at or above the auto-send score (SPEC F6).
- MNB-2: "Sent" shows only when a sent record exists.
- MNB-3: Every job is reachable: tab membership is unchanged (`inboxTabs`), and the sidebar badge equals the Inbox's decision count.
- MNB-4: `/review` and `/review/:id` still redirect; the page behind the open panel is inert.
- MNB-5: Held skips are saved when the Inbox closes.

## Known risks
- The panel unmounts on close, so a draft being edited could be lost; the existing draft editor saves on change, which a test proves still holds.
- Focus return depends on the row being mounted when the panel closes; tested with a real open and close.
- A and S while typing: guarded by an editable-target check.

## Test plan
- AC-1: `inbox-queue.test.tsx` › "opens on the most urgent tab with jobs…" (kept); `review-page.test.tsx` › "lists the queue full width with no job open".
- AC-2: `inbox-queue.test.tsx` › "shows score, role, company and source, channel, age and a label only for exceptions", "moves focus with the arrow keys and opens with Enter".
- AC-3: `review-page.test.tsx` › "opens the panel for a deep link", "shows the position and steps between jobs in the tab", "closes to the list and returns focus to the row".
- AC-4: `inbox-flow.test.tsx` › "opens the next job after a send that went out…" (kept), "closes the panel when no job is left", "stays on the sent job when Open the next job is off" (kept).
- AC-5: `inbox-flow.test.tsx` › "approves with A in the panel, through the same button", "does nothing on A while Approve is disabled", "asks for the second confirm when A approves a suspicious post", "skips with S in the panel", "ignores A and S while typing in a field".
- AC-6: `inbox-flow.test.tsx` › "skips with undo…", "brings a skipped job back on undo, and opens it", "brings a job back when its skip fails, saying so".
- AC-7: `inbox-queue.test.tsx` › "lists jobs Claude is drafting, each linked"; `review-page.test.tsx` › "opens a drafting job in the panel".
- AC-8: `inbox-queue.test.tsx` › "points an empty tab to the next one with jobs"; `review-page.test.tsx` › "says nothing needs a decision when everything is clear".
- MNB-1..3: existing `review-page.test.tsx`, `sidebar.test.tsx` badge tests; MNB-4: `app.test.tsx` redirects, `side-panel.test.tsx` inert; MNB-5: `inbox-flow.test.tsx` › "saves a held skip when the Inbox closes".

## Out of scope
- Matches, Applications and Get jobs layouts (PR-5 to PR-7).
- The panel's inner draft editor layout beyond the new width.
- Changing which jobs are decisions, or how sends work.
