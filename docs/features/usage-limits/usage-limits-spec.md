## Feature goal
Show what Applio spends against every free limit, so nothing passes a hard stop unseen and the operator knows where tokens go (SPEC F10; prototype screen 5).

## Acceptance criteria
- [ ] AC-1: Usage has a Today / This month toggle; tiles show Claude tokens against the budget with a percentage, applications sent with how they went out, average tokens per application, and tokens saved by the answer bank.
- [ ] AC-2: The free-limit guard lists every limit with used, limit, a meter with a mark at the warning level, and a state: OK, Warning, Stopped (or a friendlier label such as "Done for today"), or Off for disabled optional sources; "Edit limits" links to Settings.
- [ ] AC-3: "Where tokens went" shows tokens per pipeline step for the selected period; "Last 7 days" shows a column per day against the daily budget line, with today highlighted and an accessible text description.

## Must not break
- MNB-1: Usage numbers are read-only on this page; limits change only in Settings.

## Known risks
- Numbers come from the mock store until PR-24 records real usage.

## Test plan
- AC-1: `usage-page.test.tsx` — today tile values and switching to This month.
- AC-2: `usage-page.test.tsx` — Warning, Done for today, Off, meter value.
- AC-3: `usage-page.test.tsx` — chart's accessible label; manual visual check against the prototype.
- MNB-1: Code review: no write calls in `pages/usage`.

## Out of scope
- Real usage numbers (PR-24).
- Editing limits (Settings, PR-7).
