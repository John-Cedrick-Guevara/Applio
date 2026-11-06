## Feature goal
Keep the application log current without manual work: detect replies and what they mean (SPEC F7). Follow-ups, No reply, prep and status corrections are PR-21a (`docs/features/follow-ups/follow-ups-spec.md`).

## Acceptance criteria
- [ ] AC-1: An IMAP watcher matches incoming emails to applications (by thread, sender domain or company) and moves them to Replied, with the reply summarized on the timeline.
- [ ] AC-2: Interview invitations move the application to Interview; rejections to Rejected.
- [ ] AC-3: Unmatched emails are ignored and never stored.

## Must not break
- MNB-1: Only the minimum needed from each matched email is stored (sender, date, short summary).

## Known risks
- Open question: AI classification of replies (costs tokens) vs keyword rules. Recommended: rules first, AI only when unsure.

## Test plan
- AC-1: Tests with a fake mailbox: thread match, domain match, no match.
- AC-2: Fixture emails for invite and rejection.
- AC-3: Test asserts unmatched email not stored.
- MNB-1: Test inspects stored fields.

## Out of scope
- Telegram alerts for replies (PR-22).
