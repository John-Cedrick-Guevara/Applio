## Feature goal
Let the operator follow and approve work from their phone through a Telegram bot, with no server (SPEC F9).

## Acceptance criteria
- [x] AC-1: With a bot token and chat ID saved, Applio long-polls the bot and sends: new matches above the threshold, drafts awaiting approval, replies, follow-ups due, and quota warnings.
- [x] AC-2: Draft messages have Approve, Open and Skip buttons; Approve behaves exactly like approving in the app (same gates); the result is posted back.
- [x] AC-3: Messages from any chat other than the saved chat ID are ignored.
- [x] AC-4: Send test message delivers a message and reports success or the reason.
- [x] AC-5: Network loss pauses polling and resumes without duplicate notifications.

## Must not break
- MNB-1: Platform and career-site drafts can't be sent from Telegram; Approve there opens the handoff instead.
- MNB-2: The bot token never appears in logs.

- MNB-3: Every notification is sent at most once, even across retries and restarts.

## Decisions (defaults picked while building, 2026-11-06; change any in review)
- Messages carry summaries, never full letters or résumés: the company, the role, the score, one line of why, and the reason when something's held (the open question, settled the private way).
- No library: the Bot API is HTTPS JSON, so a small `fetch` client in `infra/telegram`. The token is part of the request URL, so errors are rebuilt from Telegram's description and never include the URL (MNB-2).
- Long polling: `getUpdates` with a 30 s timeout, one request at a time. A network error waits 5 s, doubling up to 60 s, then retries. The last update id is stored, so a restart neither repeats a button press nor drops one (AC-5).
- Only the saved chat counts: updates from any other chat are skipped without a reply (AC-3).
- What's sent:
  - a scored job at or above the draft threshold
  - a draft waiting for approval, with Approve / Open / Skip
  - a sent autonomous application
  - a reply Applio matched
  - a follow-up coming due (once per waiting period)
  - the 80% budget warning
- Each notification has a key (kind + job + moment), stored once it's sent, so nothing goes out twice (MNB-3).
- Approve calls the same `approveDraft` as the app, recorded as sent by you on Telegram. For a platform or career-site job it approves without sending, replies that it's waiting in Applio, and brings the app up on the handoff (MNB-1). Open brings the app up on the draft. Skip skips it.
- Send test message is a real `sendMessage` to the saved chat.

## Known risks
- Telegram messages leave the machine; they should carry summaries, not full letters (open question: confirm).

## Test plan
- AC-1: Tests with a fake bot API for each notification type.
- AC-2: Test: Approve callback → same result as in-app approve, reply posted.
- AC-3: Test with a foreign chat ID.
- AC-4: Test with the fake API; manual with a real bot.
- AC-5: Test simulating a network drop.
- MNB-1: Test approving a platform draft from Telegram.
- MNB-2: Log capture test.

## Out of scope
- Discord (SPEC §5).
