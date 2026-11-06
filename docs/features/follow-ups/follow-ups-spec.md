## Feature goal
Keep the application log current between replies: nudge and send follow-ups, mark silence as No reply, prepare for interviews, and let the operator correct any status (SPEC F7). Reply detection is PR-21b (`docs/features/reply-tracking/reply-tracking-spec.md`).

## Acceptance criteria
- [x] AC-1: Applications with no reply after the follow-up window show Follow-up due; Send follow-up emails the operator's edited text and restarts the window.
- [x] AC-2: Applications with no reply after 21 days move to No reply.
- [x] AC-3: Interview prep is generated from the job, what was sent and the company; the result is saved and reused on reopen.
- [x] AC-4: The operator can correct a status manually (e.g. a reply that wasn't matched).

## Must not break
- MNB-1: Follow-ups are never sent without the operator clicking Send.
- MNB-2: Every follow-up is logged with exactly what was sent.

## Decisions (defaults picked while building, 2026-11-06; change any in review)
- Split from PR-21 (size). This PR covers the time rules, follow-ups, prep and status; PR-21b covers the IMAP watcher.
- A follow-up goes from your Gmail to the address the application went to, as a reply in the same thread ("Re: <original subject>", with In-Reply-To set to the original's Message-ID). Every email Applio sends now has its own Message-ID, stored in the send log, which PR-21b also uses to match replies. Applications that didn't go by email have no address to write to, so Send follow-up says so.
- Each follow-up adds a "Follow-up sent" event, which restarts the window, and is appended word for word to `follow-ups.md` in the job folder (MNB-2).
- No reply: an application still Applied 21 days after its last event becomes No reply ("ghosted"), with a note. This is checked on the scheduler's minute tick.
- Interview prep: one AI call (step `prep`, operator-triggered, so it runs even while paused), given what was sent. Claude answers in JSON (what you told them, likely questions, what to ask them), which is checked before it's saved. It's stored per job and returned as-is on every later open, at 0 extra tokens.
- Status correction: a "Correct status" menu in the application detail offers only the moves the status rules allow (`nextStatuses`), and each correction is logged on the timeline.

## Known risks
- Prep quality depends on the prompt; it's one constant.

## Test plan
- AC-1: `follow-up.test.ts`: threaded reply to the original address, the "Follow-up sent" event, `follow-ups.md`, a non-email application refused, empty text refused; `backend.test.ts` end to end.
- AC-2: `no-reply.test.ts` with a fake clock: 20 days stays, 21 moves, other statuses untouched; `backend.test.ts` on tick.
- AC-3: `interview-prep.test.ts`: generated, saved, second open makes no AI call; bad JSON gives a readable error and saves nothing.
- AC-4: `backend.test.ts`: an allowed move is logged, a disallowed one refused; `applications-page.test.tsx`: the menu offers only allowed moves.
- MNB-1: Nothing but `sendFollowUp` sends a follow-up: `follow-up.test.ts` and code review.
- MNB-2: `follow-up.test.ts` reads `follow-ups.md`.

## Out of scope
- Detecting replies (PR-21b). Telegram alerts (PR-22).
