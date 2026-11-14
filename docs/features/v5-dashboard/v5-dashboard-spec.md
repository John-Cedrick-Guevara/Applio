## Feature goal
Open the app on a Dashboard that answers "what needs me" and "how is my hunt going" before anything else: decisions waiting, this week's sent count against a goal you set, today's AI budget, a sent-per-day chart, what is next, and how far jobs got. Every number comes from job and status records. Roadmap: `docs/features/v5-redesign/v5-redesign-roadmap.md` PR-3. Design: canvas board "v5 · 1 Dashboard" (https://claude.ai/artifact/3T4Bs69qQWvxy9xKiND79T).

Decisions (requester, 2026-11-14): add a weekly goal setting (default 15). Recorded: the top activity bar stays for now (Pause, Stop scan, Raise budget have no other home yet); it is revisited in PR-12.

## Acceptance criteria
- [ ] AC-1: `/dashboard` is the app's default page. The rail lists Dashboard first, and the logo and unknown paths lead to it.
- [ ] AC-2: The header shows today's date, "My job hunt", a status chip (what is running, or "Nothing running" with the last scan time) and a "Get jobs" link.
- [ ] AC-3: "Needs you" lists Fix first, Answer, Approve and Hand off with the same counts the Inbox tabs show, a total, and an "Open Inbox" link. When all are zero it says nothing needs you.
- [ ] AC-4: "Sent this week" counts applications sent from Monday 00:00 (local) to now, split into sent by Applio (any send through the app) and applied by you (hand-off, manual). It shows `n / goal`, the percent, one block per goal unit (up to 20), and a line saying how many more reach the goal, or that the goal is met.
- [ ] AC-5: `weeklyGoal` is a saved setting: default 15, whole number 1–100, validated on save in main, editable in Settings › Guardrails with an inline error, and changing it updates the Dashboard.
- [ ] AC-6: "AI budget today" shows tokens used of the daily budget, the percent, 8 blocks filled in proportion, and a line naming the hard stop and midnight reset. When AI is stopped by budget it says so and links to Settings.
- [ ] AC-7: "Applications sent" is a stacked bar chart, last 10 days or last 8 weeks (a select), with Applio and You in two series. Each bar is a focusable button named "label: n sent, a by Applio, y by you"; the selected bar shows the same as a tooltip. Series use the colour-vision-safe marks and a legend with words.
- [ ] AC-8: "Up next" shows four tiles from records: replies waiting, follow-ups due (per the follow-up days setting), new matches since the last scan, and the last scan with its sources count. Each links to the screen that handles it; a zero says "None" instead of hiding the tile.
- [ ] AC-9: "Pipeline" shows Found, Matched, Drafted, Applied, Replied, Interview, Offer counts for This month or All time, a bar per stage scaled to Found, the conversion from the previous stage, and a closed line (rejected, no reply, skipped).
- [ ] AC-10: With no jobs at all, the page shows a first-use state with a Get jobs button and no zero-filled charts; while loading it shows skeletons; if loading fails it says so with Retry.

## Must not break
- MNB-1: The Inbox badge, redirects (`/review`, `/find-jobs`, `/add-job`) and every other route still work.
- MNB-2: The top activity bar and its controls are unchanged.
- MNB-3: Other settings round-trip untouched; existing settings and guardrails tests pass.
- MNB-4: The Dashboard reads and spends nothing: no AI call, no send, no quota use.
- MNB-5: A skipped or failed-send job is never counted as sent (SPEC: "Sent" only with a sent record).

## Known risks
- Week and day buckets use local time; tests pass a fixed clock and a time zone. Off-by-one at midnight is the likely bug.
- The chart derives "sent" from the `applied` history event; hand-off jobs marked applied count as "you".
- `listJobs()` with no filter loads every job; fine at personal scale (thousands), noted with a `perf:` comment.

## Test plan
- AC-1: `app.test.tsx` › "opens on the dashboard"; `sidebar.test.tsx` › "lists the pages in order" (Dashboard first), "links the logo home".
- AC-2: `dashboard-page.test.tsx` › "greets with the date and status chip", "links Get jobs".
- AC-3: `dashboard-model.test.ts` › "counts needs like the inbox tabs"; `dashboard-page.test.tsx` › "says nothing needs you when all are zero".
- AC-4: `dashboard-model.test.ts` › "counts this week from Monday, split by who sent", "ignores skipped and unsent jobs", "caps blocks at 20", "says how many more reach the goal".
- AC-5: `schemas.test.ts` › "rejects a weekly goal outside 1–100"; `settings-service.test.ts` › "defaults the weekly goal to 15 and keeps a saved one"; `guardrails-model.test.ts` › "validates the weekly goal"; `settings-page.test.tsx` › "saves the weekly goal on blur".
- AC-6: `dashboard-model.test.ts` › "fills budget blocks in proportion"; `dashboard-page.test.tsx` › "says AI is stopped when the budget is used".
- AC-7: `dashboard-model.test.ts` › "buckets sent per day and per week", `dashboard-page.test.tsx` › "names each bar and switches range".
- AC-8: `dashboard-model.test.ts` › "counts replies, follow-ups due, new matches"; `dashboard-page.test.tsx` › "shows None for a zero".
- AC-9: `dashboard-model.test.ts` › "counts each pipeline stage from history", "filters to this month", "gives conversion from the previous stage".
- AC-10: `dashboard-page.test.tsx` › "shows a first-use state with no jobs", "shows Retry when loading fails".
- MNB-1: existing `app.test.tsx`; MNB-2: existing `activity-bar.test.tsx`; MNB-3: existing settings tests; MNB-4: `dashboard-page.test.tsx` › "makes no mutating API call" (spies every mutating method); MNB-5: `dashboard-model.test.ts` › "ignores skipped and unsent jobs".

## Out of scope
- Removing the top activity bar (PR-12).
- A goal per month or per source; goal history.
- Applications, Inbox and Matches layouts (PR-4 to PR-6).
