## Feature goal
Give the app the v5 frame: a dark collapsible rail with the new logo and an activity block that always says what is running, plus a reusable side panel that later screens open details in. Roadmap: `docs/features/v5-redesign/v5-redesign-roadmap.md` PR-2. Design: canvas board "v5 · Logo and sidebar" and "Style guide › Layout" (https://claude.ai/artifact/3T4Bs69qQWvxy9xKiND79T).

Deviation from the roadmap, recorded: the top activity bar stays for now. It holds Pause auto-send, Stop scan and Raise budget, and removing it before the Dashboard exists would drop operator controls (SPEC non-negotiable 4). It goes when the Dashboard header takes those controls (PR-3).

## Acceptance criteria
- [ ] AC-1: The rail is dark ink, 232px open with labels and 72px collapsed with icons only. A button at the top toggles it, is labelled "Collapse sidebar" / "Expand sidebar" and carries `aria-expanded`.
- [ ] AC-2: The open/collapsed choice is remembered across restarts; when storage is unavailable the rail opens expanded and still works.
- [ ] AC-3: Collapsed, every link keeps its accessible name and a tooltip (`title`), and the Inbox and Matches counts still show as a small badge.
- [ ] AC-4: The nav lists Inbox, Matches, Get jobs, Applications, Profile, then Usage & limits and Settings at the bottom. The current page has `aria-current="page"`. Inbox's count is still exactly the number of decisions.
- [ ] AC-5: The logo is the v5 mark (an A whose crossbar becomes a lavender arrow) on a 34px tile with a 10px corner, with the word "applio" beside it when open; it links to the default page.
- [ ] AC-6: An activity block at the bottom of the rail says in words what is running (scanning with its phase, drafting n, AI paused, or nothing running with the last scan) and shows today's token use as 10 blocks. It is a polite status region, updates when main pushes a status, and is a link to Usage & limits. Collapsed, it shows a dot or spinner with the same words in its title.
- [ ] AC-7: A `SidePanel` opens over a 32% ink dim layer at 520–560px. It moves focus inside on open, returns focus to the trigger on close, closes on Escape and on a click on the dim layer, and traps Tab inside. It shows "n of m" and previous/next buttons when given a position, and its close button is labelled.

## Must not break
- MNB-1: Every existing route still renders, and old redirects (`/review`, `/find-jobs`, `/add-job`) still work.
- MNB-2: The Inbox badge and "n new" on Matches stay correct and refresh as before (existing sidebar tests).
- MNB-3: The top activity bar and its Pause, Stop and Raise budget controls are unchanged.
- MNB-4: The page behind the panel does not scroll or act while the panel is open.

## Known risks
- Collapsing changes the grid column width; pages must not assume a fixed sidebar width. Checked by running two pages in both states.
- Focus trap bugs: tested with real Tab presses.

## Test plan
- AC-1: `sidebar.test.tsx` › "collapses to icons and expands again, announcing its state".
- AC-2: `sidebar.test.tsx` › "remembers the choice", "opens expanded when storage throws".
- AC-3: `sidebar.test.tsx` › "keeps names, titles and counts when collapsed".
- AC-4: `sidebar.test.tsx` › "lists the pages in order with the current one marked"; existing "badges the Inbox with exactly its decisions".
- AC-5: `sidebar.test.tsx` › "links the logo home"; `styles.test.ts` › "sizes the logo tile 34px with a 10px corner".
- AC-6: `activity-block.test.tsx` › "says a scan's phase", "says drafting", "says nothing running with the last scan", "says AI paused when the budget is used", "fills the blocks from today's use", "updates on a pushed status", "links to usage".
- AC-7: `side-panel.test.tsx` › "moves focus in and returns it on close", "closes on Escape and on the dim layer", "keeps Tab inside", "shows its position and steps", "labels the close button".
- MNB-1, MNB-2: existing `app.test.tsx` and `sidebar.test.tsx`.
- MNB-3: existing `activity-bar.test.tsx`.
- MNB-4: `side-panel.test.tsx` › "makes the page behind it inert".

## Out of scope
- The Dashboard entry and screen (PR-3).
- Using the side panel in Inbox, Applications and Matches (PR-4 to PR-6).
- Removing the top activity bar (PR-3).
- The phone-width top bar: the app window's minimum is 960px.
