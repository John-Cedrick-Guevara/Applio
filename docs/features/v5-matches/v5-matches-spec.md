## Feature goal
Restyle Matches to v5 and let a match's summary, fit and Draft/Skip decision open in the side panel from its row, instead of sending the operator to the Inbox page. Sorting, the draft bar, bulk actions, clean up and Trash behave as before. Roadmap: `docs/features/v5-redesign/v5-redesign-roadmap.md` PR-6. Design: canvas board "v5 · 4 Matches (sort, then draft)" (https://claude.ai/artifact/3T4Bs69qQWvxy9xKiND79T).

## Acceptance criteria
- [ ] AC-1: The page is headed "My matches", with the draft bar card, pill tabs with counts (ink when selected), the New-since-last-scan switch and search above the full-width list.
- [ ] AC-2: Each row's role is a button that opens that match in the side panel; no match is open on arrival.
- [ ] AC-3: The panel shows the match's existing state card (why it was not drafted, Draft this one with its cost, Skip job) and "n of m" for the rows the filters show, with previous/next.
- [ ] AC-4: Drafting from the panel starts the draft through the same call as the row button, closes the panel and reloads the list. Skip from the panel uses the same held skip with Undo as the row's Skip and stays on Matches.
- [ ] AC-5: The panel closes on Escape, the dim layer or Close, and focus returns to the role button of the match shown.
- [ ] AC-6: A held skip's Undo bar and the clean-up Undo bar stay reachable while a panel is open.
- [ ] AC-7: A trashed job has no panel (its row says it is in the Trash and offers Restore).

## Must not break
- MNB-1: No token spend without a click, and every spending button shows its cost (SPEC F2, F10); Draft stays disabled over the remaining budget with the reason beside it.
- MNB-2: Row Draft/Skip/Score, bulk selection, draft bar saving, Undo for skips, Clean up and the Trash behave as before (existing `matches-page.test.tsx`).
- MNB-3: Every job stays reachable: tab membership is unchanged.

## Known risks
- The role is a button rather than a link to `#/inbox/:id`; the Inbox still opens such jobs by URL for notifications.
- Reload after a panel action uses the page's loader, so a stale list is not shown.

## Test plan
- AC-1: `matches-page.test.tsx` › "side panel › is headed 'My matches'"; existing tab, search and new-filter tests.
- AC-2: › "opens a match in the side panel with its state card, position and steps".
- AC-3: › same test (Draft this one, "n of m", Next).
- AC-4: › "drafts from the panel, then closes it and says drafting started", "skips from the panel through the same held path as the row, staying on Matches with Undo".
- AC-5: › "closes on Escape and returns focus to the role button", "closes on the dim layer and on Close".
- AC-6: › "skips from the panel…" (Undo bar is a child of the body); existing Undo tests (skip and cleanup).
- AC-7: › "does not open a trashed job in the panel: it has Restore on its row instead".
- MNB-1..3: existing `matches-page.test.tsx` and `matches-model.test.ts`.

## Out of scope
- A `±` stepper for the draft bar (the existing slider stays).
- Selection bar redesign, Inbox, Get jobs.
