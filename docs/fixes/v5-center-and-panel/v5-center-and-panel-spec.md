## Feature goal
Follow-up to the v5 redesign: centre the Get jobs and Profile pages in the window, and make the side panel a little wider so drafts and details have more room.

## Acceptance criteria
- [ ] AC-1: The Get jobs page (header, tabs and both tab panels) is one column centred in the window, at most 820px wide; the Paste a job and Scan sources panels fill that column.
- [ ] AC-2: The Profile page is centred in the window, at most 1040px wide.
- [ ] AC-3: The side panel is 640px wide (was 560px) and still never wider than the window.

## Must not break
- MNB-1: Nothing else on those pages changes: tabs, scans, pasting, profile editors and panel behaviour (focus, Escape, stepping) work as before.
- MNB-2: The Get jobs tab group stays as wide as its tabs, not the full column.

## Known risks
- The panel is 80px wider, so the page behind it is dimmed over a little more of the list; the list stays usable at the 960px minimum window.

## Test plan
- AC-1, AC-2: `styles.test.ts` › "centres the Get jobs and Profile columns"; manual: screenshot of Get jobs.
- AC-3: `styles.test.ts` › "makes the side panel 640px wide, still capped to the window".
- MNB-1, MNB-2: the existing `get-jobs`, `find-jobs`, `add-job`, `profile` and `side-panel` suites pass unchanged.

## Out of scope
- Other pages' widths, and the style guide board's 520–560px note.
