## Feature goal
Send approved email applications from the operator's Gmail and log exactly what went out (SPEC F5 channel 1, F7, F8).

## Acceptance criteria
- [ ] AC-1: Approving an email draft sends the cover letter as the body with the resume PDF attached from the operator's Gmail via SMTP with the app password.
- [ ] AC-2: After sending, the job is Applied with who sent it and the time, and `sent.md` records recipient, subject, body, attachments, channel, time and tokens.
- [ ] AC-3: The same job can never be sent twice, including after a crash or a double click.
- [ ] AC-4: Sending stops at the Gmail daily cap and the per-channel daily cap with a readable message.
- [ ] AC-5: An SMTP failure leaves the job Approved (not Applied) with the reason, and can be retried.
- [ ] AC-6: Send test email sends to the operator's own address and reports success or the reason.
- [ ] AC-7: Mark as applied and I didn't apply work for any channel and are logged.

## Must not break
- MNB-1: Nothing is sent from a platform or career-site job.
- MNB-2: The app password never appears in logs or files.

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

## Out of scope
- Reading replies (PR-21); autonomous sends (PR-20).
