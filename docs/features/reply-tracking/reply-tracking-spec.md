## Feature goal
Keep the application log current without manual work: detect replies, nudge follow-ups and prepare for interviews (SPEC F7).

## Acceptance criteria
- [ ] AC-1: An IMAP watcher matches incoming emails to applications (by thread, sender domain or company) and moves them to Replied, with the reply summarized on the timeline.
- [ ] AC-2: Interview invitations move the application to Interview; rejections to Rejected; applications with no reply after 21 days to No reply.
- [ ] AC-3: Applications with no reply after the follow-up window show Follow-up due; Send follow-up emails the operator's edited text and restarts the window.
- [ ] AC-4: Interview prep is generated from the job, what was sent and the company; the result is saved and reused on reopen.
- [ ] AC-5: The operator can correct a status manually (e.g. a reply that wasn't matched).
- [ ] AC-6: Unmatched emails are ignored and never stored.

## Must not break
- MNB-1: Follow-ups are never sent without the operator clicking Send.
- MNB-2: Only the minimum needed from each matched email is stored (sender, date, short summary).

## Known risks
- Open question: AI classification of replies (costs tokens) vs keyword rules. Recommended: rules first, AI only when unsure.
- Manual status editing returns here although the prototype doesn't show it; needs a UI decision (open question).

## Test plan
- AC-1: Tests with a fake mailbox: thread match, domain match, no match.
- AC-2: Fixture emails for invite and rejection; fake clock for 21 days.
- AC-3: Tests: due after window, send restarts window.
- AC-4: Test: second open uses the cache (no engine call).
- AC-5: Test for manual status move; manual UI check.
- AC-6: Test asserts unmatched email not stored.
- MNB-1: Test asserts no send without the action.
- MNB-2: Test inspects stored fields.

## Out of scope
- Telegram alerts for replies (PR-22).
