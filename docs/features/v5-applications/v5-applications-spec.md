## Feature goal
Show Applications as a full-width list with stat cards, and open an application's timeline, what was sent and follow-up actions in the side panel on demand, instead of a table and detail side by side. Roadmap: `docs/features/v5-redesign/v5-redesign-roadmap.md` PR-5. Design: canvas board "v5 · 3 Applications (list + side panel)" (https://claude.ai/artifact/3T4Bs69qQWvxy9xKiND79T). Filters, search, statuses and the detail's contents do not change.

## Acceptance criteria
- [ ] AC-1: The page is headed "My applications" and shows the four stats (Sent this month, Replies incl. interviews, Interviews, Follow-ups due) as cards, then the status filters with counts, the search box and the full-width table.
- [ ] AC-2: No application is open on arrival; nothing sits beside the table.
- [ ] AC-3: Clicking anywhere on a row, or pressing Enter on its button, opens that application's existing detail (timeline, exactly what was sent, follow-up and status actions) in the side panel.
- [ ] AC-4: The panel shows "n of m" for the filtered list and steps to the previous or next application in it.
- [ ] AC-5: The panel closes on Escape, the dim layer or Close, and focus returns to the row that opened it (or the first row if that row is gone).
- [ ] AC-6: Filtering, searching, the empty states and a status or follow-up change made in the panel behave as before and update the list behind it.

## Must not break
- MNB-1: A follow-up is sent only on the operator's click, and "sent" shows only from a sent record.
- MNB-2: The page reloads when main reports a job changed (a reply moving it to Interview).
- MNB-3: The send log shows exactly what was sent, even after the draft is edited.

## Known risks
- The row is clickable as a whole and has a button inside; a click on the button must open once, not twice (tested via one dialog).
- Stats stay computed by `appStats` from records; only their look changes.

## Test plan
- AC-1: `applications-page.test.tsx` › "shows the list full width with no application open", "shows the four stats as cards", "filters by status group and search".
- AC-2: `applications-page.test.tsx` › "shows the list full width with no application open".
- AC-3: › "opens an application in the side panel, from the whole row, with its position", "shows the timeline and what was sent for the selected application".
- AC-4: › "steps to the next application in the filtered list".
- AC-5: › "closes on Escape and returns focus to the row".
- AC-6: › "filters by status group and search", "reloads when main reports a job changed…".
- MNB-1: existing follow-up tests in `applications-page.test.tsx`; MNB-2: "reloads when main reports a job changed…"; MNB-3: "shows the subject and recipient exactly as the send log stored them…".

## Out of scope
- A URL per application (`/applications/:id`); the panel state is local.
- Inbox, Matches, Get jobs (other PRs).
