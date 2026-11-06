## Feature goal
Fix what the operator hit on the first real run (2026-11-06): a run that drafted nothing with no readable reason, résumé facts split mid-sentence, a Telegram test that failed without a next step, and Add a job inviting LinkedIn links it then refuses.

## Acceptance criteria
- [x] AC-1: When Applio's Claude Code profile is logged out, a call fails with the sign-in message, not "Claude Code exited with code 1:".
- [x] AC-2: Test connection for AI still offers the sign-in command when `claude auth status` exits 1 (it does when logged out).
- [x] AC-3: A résumé bullet the PDF wrapped onto several lines is suggested as one fact, under the right heading.
- [x] AC-4: Each suggested fact's "Add to fact bank" button sits on the right of its row, whatever the text length.
- [x] AC-5: Secrets are saved without the spaces or line breaks pasted around them.
- [x] AC-6: Telegram's "chat not found" says to press Start on the bot; a 404 (malformed token) says the token is wrong.
- [x] AC-7: Add a job says LinkedIn, Indeed, JobStreet, Upwork and Facebook posts are pasted as text, and its link example is a company ATS link.

## Must not break
- MNB-1: Platform pages are still never requested.
- MNB-2: Error messages never contain the Telegram token.

## Test plan
- AC-1: `claude-code-engine.test.ts` "says how to sign in when a call fails because Applio's profile is logged out" (the fake binary now exits 1 like the real one).
- AC-2: `claude-code-engine.test.ts` "tells how to sign in Applio's own profile when it's logged out".
- AC-3: `suggest-facts.test.ts` "joins a bullet wrapped across lines by the PDF back into one fact".
- AC-4: Manual: mock renderer, Profile → Replace, one long and one short suggestion; both buttons on the right.
- AC-5: `settings-service.test.ts` "drops spaces and line breaks pasted around a secret".
- AC-6: `bot-api.test.ts` "explains Telegram's refusal without the token" and "says the token is wrong when Telegram answers 404".
- AC-7: `fetch-page.test.ts` refusal message; manual read of Add a job.
- MNB-1: `fetch-page.test.ts` and `backend.test.ts` platform-link refusals still pass.
- MNB-2: `bot-api.test.ts` token checks still pass.

## Out of scope
- An uppercase continuation line (e.g. a wrapped bullet that continues with a name) still reads as its own fact or heading; the operator can skip it.
