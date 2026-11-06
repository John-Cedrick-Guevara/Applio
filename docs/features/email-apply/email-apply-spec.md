## Feature goal
Send approved email applications from the operator's Gmail and log exactly what went out (SPEC F5 channel 1, F7, F8).

## Acceptance criteria
- [x] AC-1: Approving an email draft sends the cover letter as the body with the resume PDF attached from the operator's Gmail via SMTP with the app password.
- [x] AC-2: After sending, the job is Applied with who sent it and the time, and `sent.md` records recipient, subject, body, attachments, channel, time and tokens.
- [x] AC-3: The same job can never be sent twice, including after a crash or a double click.
- [x] AC-4: Sending stops at the Gmail daily cap and the per-channel daily cap with a readable message.
- [x] AC-5: An SMTP failure leaves the job Approved (not Applied) with the reason, and can be retried.
- [x] AC-6: Send test email sends to the operator's own address and reports success or the reason.
- [x] AC-7: Mark as applied and I didn't apply work for any channel and are logged.

## Must not break
- MNB-1: Nothing is sent from a platform or career-site job.
- MNB-2: The app password never appears in logs or files.

- MNB-3: An application that was sent stays logged exactly as sent, even if the draft is edited later.

## Decisions (defaults picked while building, 2026-11-06; change any in review)
- SMTP goes through `nodemailer` (one new dependency) to `smtp.gmail.com:465` over TLS, with the Gmail address and app password from the keychain.
- The message: from your Gmail, to the job's email address. The subject is "Application: <Role> — <your name>" (just the role when no name is set). The body is the cover letter as plain text, and `resume.pdf` is attached from the job folder.
- Send log: a new `sends` table holds one row per job, with exactly what was sent (recipient, subject, body, attachment names, time). Approve claims the row (`sending`) before calling SMTP and marks it `sent` after.
  - A failure deletes the claim, so the job stays Approved with the reason as a note, and Approve can retry (AC-5).
  - A claim left by a crash blocks any automatic resend (AC-3). Applio can't know whether that email went out, so it asks you to check Gmail's Sent folder, then Mark as applied or choose I didn't apply.
- Caps, counted from the send log for your local day: Gmail 100 sends a day (SPEC F10's default; the editable quota table comes with PR-24), and the per-channel cap from Guardrails. A capped send leaves the job Approved.
- Approving a job on any other channel only moves it to Approved. ATS submits in PR-19, and platform and career-site jobs go to the manual handoff (MNB-1).
- On approval, new AI-written answers in the draft join the answer bank (origin ai), as PR-17a promised.
- `sent.md` is written to the job folder right after a send. The job's token count is the total spent on it.
- Mark as applied works from Scored, Drafted or Approved (sent by you, manually). I didn't apply (`skipJob`) works from any status before Applied. Both add an event to the timeline.
- Send test email sends a short message to your own address.

## Known risks
- Gmail may require "less secure" or app-password setup the operator hasn't done; the setup copy must explain it.

## Test plan
- AC-1: Test with a fake SMTP server: body, attachment, sender.
- AC-2: Test asserts status, sentBy, and `sent.md` content.
- AC-3: Tests: double approve, crash between send and record (send idempotency key).
- AC-4: Tests at both caps.
- AC-5: Test with SMTP error; then retry succeeds.
- AC-6: Test with the fake server; manual check with a real account.
- AC-7: Tests for both actions.
- MNB-1: Test approving a platform job never calls SMTP.
- MNB-2: Test greps logs and files for the password.
- MNB-3: `backend.test.ts` › "keeps a sent application exactly as sent: its letter can no longer be edited".

## Out of scope
- Reading replies (PR-21); autonomous sends (PR-20).
