## Feature goal
Keep the application log current without manual work: detect replies and what they mean (SPEC F7). Follow-ups, No reply, prep and status corrections are PR-21a (`docs/features/follow-ups/follow-ups-spec.md`).

## Acceptance criteria
- [x] AC-1: An IMAP watcher matches incoming emails to applications (by thread, sender domain or company) and moves them to Replied, with the reply summarized on the timeline.
- [x] AC-2: Interview invitations move the application to Interview; rejections to Rejected.
- [x] AC-3: Unmatched emails are ignored and never stored.

## Must not break
- MNB-1: Only the minimum needed from each matched email is stored (sender, date, short summary).

## Decisions (defaults picked while building, 2026-11-06)
- Keyword rules only, no AI (the spec's recommendation); a rejection wins over an interview mention.
- Matching: thread (Message-ID) first, then the application's email domain, then the company name in the sender's domain or name; webmail domains never match by domain.
- Gmail IMAP, read-only, every 15 minutes on the scheduler tick, from the last UID read (30 days back the first time). New dependency: `imapflow`.
- Only "Reply from <sender>: <first 200 characters>" is kept, on the timeline; unmatched mail is dropped (MNB-1, AC-3).

## Known risks
- Open question: AI classification of replies (costs tokens) vs keyword rules. Recommended: rules first, AI only when unsure.

## Test plan
- AC-1: `replies.test.ts` (thread, domain, company, webmail, closed); `inbox.test.ts` with a fake IMAP client; `backend.test.ts` › "reads a reply in the application's thread from Gmail and moves the application to Interview".
- AC-2: `replies.test.ts` › classifyReply; `track-replies.test.ts` moves to Interview and Rejected, and only notes a reply that would move backwards.
- AC-3: `track-replies.test.ts` › "ignores mail that matches no application, and the operator's own mail, keeping nothing of it".
- MNB-1: `track-replies.test.ts`: the only write is the timeline note with sender and summary; `replies.test.ts` caps the summary at 200 characters.

## Out of scope
- Telegram alerts for replies (PR-22).
