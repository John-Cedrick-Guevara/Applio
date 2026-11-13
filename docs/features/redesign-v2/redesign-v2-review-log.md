# Redesign v2 — review log

One entry per PR: how it was reviewed (`/review-pr` passes against its spec) and what was found. Kept in the repo so the evidence outlives a session.

## Per PR

| PR | Review | Findings → fix |
|---|---|---|
| #78 job state card | `/review-pr`, 2 rounds | Backend "draft score" message (AC-7) → fixed in the PR. Spec lacked Known risks and per-MNB test lines → fixed. |
| #79 activity bar | `/review-pr`, 2 rounds | A failed load left no bar (LOGIC-003) → message with Retry, AC-8. |
| #80 matches | `/review-pr`, 2 rounds | Saved skip's row reappeared; draft bar change lost on quick leave (LOGIC-004) → fixed. **Missed then, found later:** a job with open questions was also listed here → #87. |
| #81 inbox 4a | `/review-pr`, 2 rounds | Dead `queueState` export (LOGIC-007) → removed. ~1,020 changed lines (guide ~1,000), accepted. |
| #82 inbox 4b | `/review-pr`, 1 round | Badge lagged after a held skip saved → fixed before review (AC-6). |
| #83 get jobs | Merged before review (reviews were paused); full passes run afterwards (below) | Tabs unmounted each other (→ #86); scan count, sticky filter, stale copy (→ #87). |
| #84 score now | Merged before review; full passes run afterwards (below) | Concurrent double-score spent twice (STRESS-005) → this PR. |
| #85 paste dedup | `/review-pr`, 2 rounds | Duplicate preview showed the raw channel id and a fake route (LOGIC-002) → `describeRoute`. |
| #86 keep scan | Gate 0 + full passes (below) | Found by the #83 review; test failed before the fix. |
| #87 scan counts | Gate 0 + full passes (below) | Found by the #80/#83 review and the browser run. |
| score-now double submit | Gate 0 + full passes (below) | Found by the #84 review. |

## Full passes run after the fact

Rule cards from the review-pr skill (Pass 0 acceptance, 1 logic, 2 stress, 3 security, 4 data, 5 deployment). `n/a` = the diff doesn't touch the card's trigger.

| PR | Acc | Logic | Stress | Security | Data | Deploy |
|---|---|---|---|---|---|---|
| #83 | 4/4 AC, 3/3 MNB met | LOGIC-005 callers: repo-wide grep clean for `/find-jobs`, `/add-job`. **FAIL** LOGIC-001: result count ignored drafted/asked (→ #87). **FAIL** LOGIC-004: tab switch lost scan state (→ #86). | ok | ok (no new input; post text unchanged) | n/a | DEPLOY-001 unverified (CI off); local check green |
| #84 | 5/5 AC, 2/2 MNB met | ok: shared `scoreIds`; quota check before the AI call; status must be `found`; failure surfaces its note (LOGIC-003) | **FAIL** STRESS-005: two concurrent calls both passed the status check and both spent tokens (→ this PR) | ok: id validated by `z.tuple([id])`; fact ids checked by the existing scorer | ok: score + summaries + move saved together by `saveMatch` | unverified (CI off) |
| #86 | 2/2 AC met | ok (hidden panels stay mounted; assistive tech skips `hidden`) | ok (two small extra reads on open, in Known risks) | n/a | n/a | unverified (CI off) |
| #87 | 5/5 AC met | ok (`waiting` clamped at 0; `key` resets Matches' local state when the link changes, intended) | ok (one extra cheap read) | n/a | n/a | unverified (CI off) |
| this PR | 3/3 AC met | ok (set cleared in `finally`, so a failed score can be retried) | ok | n/a | n/a | unverified (CI off) |

## Verified in a browser (Chrome against the mock API, `npm run dev:web`)
Get jobs (redirect from `/find-jobs`, cost line, scan result survives a tab round-trip, "Open the 2 new matches" → `/matches/new` with the filter on and a working empty state), Matches, and the Inbox (ArrowDown, S → Skipped + Undo, next job opens on the right tab).

## Verified in a browser with a slowed scan (throwaway Vite config, deleted afterwards)
The dev-web mock with an 8 s `runDiscovery`: Get jobs showed "Scanning · 0:01 elapsed", "Fetch posts · In progress", Stop scan and "Results land in Matches"; switching to Paste a job and back kept the scan on screen (the #86 fix). The activity bar kept saying "Nothing running" because the mock never pushes scan status; that bar state is covered by `activity-bar.test.tsx`.

## Verified against the real backend (scratch Electron harness, not committed)
`createBackend` on a **copy** of the operator DB, real Claude Code engine and profile, no network sources, no sending. The real `~/Applio` DB and folders were checked untouched afterwards (same size and timestamp, no new files).
- **Free duplicate check:** a job already in the DB, pasted as "Title at Company": returned as a duplicate with the real channel label and route, `tokensUsed` 0, token delta 0 (no AI call).
- **Score now:** one scored job flipped back to `found` in the copy, then `scoreJob` with real Claude: status `scored`, score 15, 4,577 tokens recorded, role summary saved.
- **Refusal:** scoring that job again → "Only jobs not scored yet can be scored."
- **Real draft, PDFs, Approve and the double-send guard** (second harness, same rules; output folder and DB are scratch copies, Gmail is a recording stand-in addressed to a `.invalid` address): one real Claude draft of a scored job; its PDFs printed (`cover-letter.pdf`, `resume.pdf`, `job.md`) into the scratch folder only; the real draft check reported 2 unverified lines and 1 forbidden term (so the card would not claim "every claim traced"); `approveDraft` → status `applied`, send record `sent` to the test address, exactly one message with the résumé attached; a second `approveDraft` was refused ("is not awaiting approval") and still only one message went out. Nothing was sent anywhere real.
- `npm run e2e` (Electron ATS-form harness, fakes only): 13/13 pass on main.
- Harness note: the scratch Electron entry needs the real app's `app.on('window-all-closed', () => {})`, or PDF printing's hidden window quits it mid-run.

## Not verified
- The Inbox/Matches/Get jobs **UI** against real data in Electron (only the mock API in Chrome); the real draft/approve flow above was exercised through the backend, not the redesigned screens.
- The activity bar showing a scan in progress with real status pushes (only a test covers it; the mock has no push).
- In dev-web the sidebar badge refreshes only on navigation (no status push in the mock); the real app pushes, and a test covers the push.
- The Inbox badge leads the list by one for ~5 s while a skip is held (accepted).
