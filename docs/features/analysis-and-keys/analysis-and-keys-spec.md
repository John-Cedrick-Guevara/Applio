## Feature goal
Fix two problems from the operator's second run (2026-11-06): Add a job failed on a real post as "Claude's reading of the post couldn't be used", and a connected Telegram bot's token couldn't be changed.

## Acceptance criteria
- [x] AC-1: A post whose optional details come back loose (null location, "Part-time" type, non-link apply URL, a fractional score, too many tags, a long summary) is still added, with those fields defaulted, clipped or rounded.
- [x] AC-2: A strength citing a fact not in the bank is dropped and the job is kept. Every kept strength still cites a real fact.
- [x] AC-3: An answer with no company, title or numeric score is still refused, and the error's cause names the failing fields but not their values.
- [x] AC-4: A connected Gmail or Telegram row has a Change button that shows its fields again, so the token or chat ID can be replaced.

## Must not break
- MNB-1: Unparseable answers are refused as before.
- MNB-2: Secrets are never shown again after saving.

## Test plan
- AC-1: `analyze-job.test.ts` "keeps a job whose optional details come back loose".
- AC-2: `analyze-job.test.ts` "drops a strength citing a fact not in the bank, keeping the rest of the job".
- AC-3, MNB-1: `analyze-job.test.ts` "refuses an answer that cannot be read, or that has no company, title or score".
- AC-4: `settings-page.test.tsx` "lets a connected Telegram bot get a new token".
- MNB-2: `settings-page.test.tsx` "stores an API key in the keychain without showing it again".

## Out of scope
- Finding which field failed on the operator's own post: the new log names the field if it still fails.
