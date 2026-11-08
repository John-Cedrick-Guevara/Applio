## Feature goal
No page leaves the operator unsure what's happening (QA 2026-11-07 #13, #16, #17, #18, plus the Usage and Run now pieces of #4/#14). The sidebar tells the truth about tokens and budget. Run now and AI buttons say why they're off. The Usage page shows what each filter dropped. Handoff and Applications read cleanly, and toasts don't vanish while being read.

## Acceptance criteria
- AC-1: Status is pushed after every recorded AI call, so the token meter moves at once.
- AC-2: Once a budget stops AI, the sidebar reads "Paused · daily budget used" (red) with **Raise budget**. Analyze job and Draft this one are disabled, with the reason shown.
- AC-3: Token counts of 10k or more are rounded to whole thousands ("227k / 500k") and the label ellipsizes rather than overflowing.
- AC-4: When every enabled source has used today's polls, Run now is disabled with "Every source has used today's polls…", and a run that fetched nothing with nothing to retry isn't recorded.
- AC-5: Usage shows "Filtered before AI": found, already seen, scored, % dropped for free, and drops per reason, biggest first.
- AC-6: Handoff numbers only the steps it shows, and the assisted-fill tip names the job's own channel (career sites vs platforms).
- AC-7: Reply snippets drop the quoted thread even when Gmail wraps "On … wrote:". Sent file chips open the file. The header stat reads "Replies, incl. interviews". Identical consecutive timeline events show once.
- AC-8: Toasts pause while hovered.

## Must not break
- MNB-1: Scheduled runs, scoring and drafting; the budget hard stop itself.
- MNB-2: Existing status pushes (pause, jobs version, drafting).

## Test plan
- AC-1/2: `backend.test.ts` › "pushes the new token total after every AI call, and says when the daily budget stops AI"; `engine-card.test.tsx` › "says AI is paused for the day…"; `add-job-page.test.tsx` › "disables Analyze with the reason…"; `review-page.test.tsx` › "disables Draft this one with the reason…"
- AC-3: `engine-card.test.tsx` › "rounds big token counts so the line fits the card"
- AC-4: `review-page.test.tsx` › "disables Run now and says why…"; `discover.test.ts` › "records no run when every source has used its polls…"
- AC-5: `build-usage.test.ts` › "sums the period's prefilter, per drop reason…"; `usage-page.test.tsx` › "shows how many jobs each filter dropped…"
- AC-6: `handoff-page.test.tsx` › "numbers only the steps it shows…", "words the assisted-fill tip for a career-site job…"
- AC-7: `replies.test.ts` › "cuts the quoted thread even when Gmail wraps…"; `applications-page.test.tsx` › "opens the sent résumé from its file chip"; `applications-model.test.ts` › "shows identical consecutive events once"
- AC-8: `toast.test.tsx`
- MNB-1/2: full suite.

## Decisions
- #18: on current code the Add job confirmation is an inline banner that stays until **Add another**, not a toast, so the reported disappearance couldn't be reproduced. The hover pause is the general fix QA asked for.
- Reply notes already stored with a quote stay as they are; new replies are clean.

## Out of scope
- Disabling Redraft on a budget stop (it fails with the budget's own message instead).
