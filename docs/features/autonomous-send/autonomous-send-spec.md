## Feature goal
Let Applio send on its own only where the operator allowed it and every guardrail passes (SPEC F6).

## Acceptance criteria
- [x] AC-1: A drafted job is sent without approval only if its source is Autonomous, its channel is email or ATS, its score is at or above the auto-send score, the channel's daily cap isn't reached, the company isn't blocklisted, and it isn't a duplicate of an application already sent.
- [x] AC-2: Any failed gate leaves the job in Review with the reason shown.
- [x] AC-3: Autonomous sends are logged with sentBy = Autonomous and appear in Applications.
- [x] AC-4: Nothing is sent autonomously while automation is paused or the AI or Gmail hard stop is reached.

## Must not break
- MNB-1: Platform and career-site jobs are never sent autonomously, whatever the source setting.
- MNB-2: Upwork proposals are never sent autonomously.

## Decisions (defaults picked while building, 2026-11-06; change any in review)
- When: right after a job's draft and files are saved in a discovery run, one job at a time.
- The gate, in order: channel (platform and career sites never), Upwork never, the source's autonomy capped by its own ceiling, pause, the AI budget hard stop, the auto-send score, and the blocklist (checked again, since it may have changed since triage). The daily caps (Gmail and per channel) and the double-send guard come from the send path itself (PR-18/19).
- Duplicates: an application already sent can't be sent again. Each company + title is stored once (triage MNB-1), and the send log allows one send per job.
- A held job stays drafted, so it stays in Review. Jobs from Autonomous sources get "Not sent automatically: <reason>" on their timeline; jobs from other sources get no note, since nobody expected them to go out.
- Autonomous sends skip the Approved step: drafted goes straight to applied, `sentBy = autonomous`. AI-written answers don't join the answer bank, because no one approved them.
- ATS forms run in a hidden window that closes on a handoff, instead of popping up. The job waits in Review with the reason.
- First-run cap (the open question): no extra cap. The per-channel daily cap (default 10) already bounds how much goes out, and Autonomous is off for every source except Himalayas and the ATS watchlist by default.

## Known risks
- A misconfigured threshold could send many applications quickly; consider a first-run cap (open question).

## Test plan
- AC-1: One test per gate, each failing alone, plus the all-pass case.
- AC-2: Tests assert the shown reason per gate.
- AC-3: `backend.test.ts`: sentBy autonomous, and the job is listed among applied jobs, which is what Applications shows.
- AC-4: Tests: paused, AI budget stop, Gmail cap.
- MNB-1: Tests with Autonomous source on platform and custom channels.
- MNB-2: Test with the Upwork source.

## Out of scope
- New channels.
