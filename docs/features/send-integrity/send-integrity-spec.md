## Feature goal
Show the operator exactly what happened to each application. A send that fails is never shown as sent, never leaves its list, and can be retried. The sent log shows what actually went out. Follow-ups never contain placeholders. (QA 2026-11-07 #1, #2, #3, #11, #12, folder part of #16.)

## Acceptance criteria
- AC-1: Approving while Gmail is unset (or caps, résumé or form link block the send) refuses before the status changes: the job stays `drafted`, the error shows inline, and Approve stays.
- AC-2: An SMTP failure after approval leaves the job `approved` with the reason. Review lists it under "Approved, not sent (n)", the draft shows "Not sent. <reason>" with **Retry send**, and a retry sends exactly once.
- AC-3: "Sent" renders only when a `sent` send record exists. An unfinished send, a handoff and a manual application each get their own wording and next step.
- AC-4: No status except `skipped` is shown in neither Review nor Applications.
- AC-5: "What was sent" shows recipient, subject, body and attachments from the send log, unchanged by later draft edits. With no send record it says the operator applied outside Applio.
- AC-6: The follow-up prefill signs with the operator's name and greets "Hi there," when the company is unknown. Send stays disabled while a placeholder remains or no name is set, and says why. The backend refuses a placeholder too.
- AC-7: A second click while a send is in flight doesn't call the API again.
- AC-8: An email draft with Gmail unset says so before the click and offers **Set up Gmail to send** instead of Approve.
- AC-9: The sent banner names the saved folder, with an **Open folder** button, rather than a truncated path.

## Must not break
- MNB-1: The double-send guard: concurrent approvals send one email.
- MNB-2: Platform and career-site approvals never send.
- MNB-3: Autonomous sends that fail stay drafted with a note (unchanged).
- MNB-4: Existing suite, typecheck, lint.

## Test plan
- AC-1: `send-application.test.ts` › "refuses to approve while Gmail is not set up…", "stops at Gmail's daily cap and leaves the job waiting in Review", "refuses to send before the résumé PDF is saved, without approving"; `backend.test.ts` › "refuses to approve while Gmail is not set up…"; `mock-api.test.ts` › "refuses an email send while Gmail is not set up…"
- AC-2: `backend.test.ts` › "keeps a refused send approved and unlogged, then a retry sends exactly once…"; `review-page.test.tsx` › "keeps a refused send in Review as Not sent with the reason and Retry, never as Sent", "lists a job left approved but unsent after a reload…"
- AC-3: `review-model.test.ts` › `sendState` suite (sent, not-sent, unconfirmed, handoff, applied-manually, skipped)
- AC-4: `job-lists.test.ts` › "shows a %s job in Review or Applications…"
- AC-5: `applications-page.test.tsx` › "shows the subject and recipient exactly as the send log stored them…", "says an application made outside Applio has no send record…"
- AC-6: `applications-model.test.ts` › `followUpDraft`, `followUpProblem`; `applications-page.test.tsx` › "keeps Send follow-up disabled while a placeholder remains…", "asks for a name in Settings…"; `follow-up.test.ts` › "refuses text that still has a template placeholder…"; ESLint placeholder rule
- AC-7: `use-action.test.tsx` › "runs one action at a time…"
- AC-8: `review-page.test.tsx` › "offers Set up Gmail instead of Approve while Gmail is not set up"
- AC-9: `review-model.test.ts` › "says Sent only when a sent record exists, naming the recipient and folder"
- MNB-1: `backend.test.ts` › "never sends twice, even on a double click"
- MNB-2: `send-application.test.ts` › "only approves a %s job; nothing is sent"
- MNB-3/4: full suite.

## Out of scope
- Re-verifying Gmail credentials (PR 2). ATS confirmation screenshot in the detail panel (PR 7).
