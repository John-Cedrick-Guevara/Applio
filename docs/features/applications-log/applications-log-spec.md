## Feature goal
Show the operator everything that was sent, exactly what went out, and how each application is going, with the next useful action ready (SPEC F7; prototype screen 3).

## Acceptance criteria
- [ ] AC-1: Applications lists only jobs that were sent, newest first, with role, company, match, channel, who sent it (Autonomous / You, in app / You, via Telegram / You, manually), status, sent date and tokens.
- [ ] AC-2: Statuses read Applied, Follow-up due, Replied, Interview, Offer, Rejected, No reply; "Follow-up due" appears when an applied job has had no contact for longer than the follow-up window, and clears once a follow-up is sent.
- [ ] AC-3: The header shows sent this month, replies, interviews and follow-ups due.
- [ ] AC-4: Filter pills (All, Waiting, Replied, Interview, Closed) show counts and filter the table; search matches company, role and channel; with no matches, "No applications match" and Clear filters appear.
- [ ] AC-5: Selecting a row shows its detail: company, role, status, a timeline (found, scored, drafted with tokens and facts, sent via channel by whom, later replies/closure, follow-up nudge when due).
- [ ] AC-6: "What was sent" shows the email subject and opening text for email, or the form summary (answer count, how many were AI-written) otherwise, plus the saved file names.
- [ ] AC-7: For Replied / Interview / Offer, Interview prep loads on request and shows what you told them, likely questions and questions to ask, with its token cost.
- [ ] AC-8: For Follow-up due, Draft follow-up opens an editable message pre-filled with the role and sent date; Send logs it on the timeline and confirms; Cancel closes it.
- [ ] AC-9: Open folder opens the application's folder, and is disabled when there is none.

## Must not break
- MNB-1: A follow-up is never sent without the operator clicking Send (SPEC F7 "always approval-gated").
- MNB-2: Drafts and skipped jobs never appear in Applications.

## Known risks
- "Sent this month" uses local time; applications sent near midnight on the 1st may count in the other month.
- Interview prep spends tokens each time it is opened until results are cached (PR-21).

## Test plan
- AC-1: `applications-page.test.tsx` — sent job listed, drafted job absent.
- AC-2: `applications-model.test.ts` — window exceeded, within window, reset after follow-up, ghosted wording.
- AC-3: `applications-model.test.ts` appStats.
- AC-4: `applications-page.test.tsx` — Closed pill, search with no match, Clear filters.
- AC-5: `applications-page.test.tsx` detail timeline; `applications-model.test.ts` timeline titles and meta.
- AC-6: `applications-page.test.tsx` — resume.pdf shown; manual check of an email and a form application.
- AC-7: `applications-page.test.tsx` — Interview prep shows Likely questions.
- AC-8: `applications-page.test.tsx` — pre-filled text, send, timeline note; manual Cancel.
- AC-9: Manual: in Electron, Open folder opens Finder; button disabled for a job without a folder.
- MNB-1: `applications-page.test.tsx` — opening and editing the follow-up leaves the job history unchanged until Send is clicked.
- MNB-2: `applications-page.test.tsx` — Northwind (drafted) absent.

## Out of scope
- Manual status editing, reply detection and real sending (PR-21).
