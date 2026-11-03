## Feature goal
Let the operator follow and approve work from their phone through a Telegram bot, with no server (SPEC F9).

## Acceptance criteria
- [ ] AC-1: With a bot token and chat ID saved, Applio long-polls the bot and sends: new matches above the threshold, drafts awaiting approval, replies, follow-ups due, and quota warnings.
- [ ] AC-2: Draft messages have Approve, Open and Skip buttons; Approve behaves exactly like approving in the app (same gates); the result is posted back.
- [ ] AC-3: Messages from any chat other than the saved chat ID are ignored.
- [ ] AC-4: Send test message delivers a message and reports success or the reason.
- [ ] AC-5: Network loss pauses polling and resumes without duplicate notifications.

## Must not break
- MNB-1: Platform and career-site drafts can't be sent from Telegram; Approve there opens the handoff instead.
- MNB-2: The bot token never appears in logs.

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
