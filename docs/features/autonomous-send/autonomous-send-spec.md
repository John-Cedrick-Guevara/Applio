## Feature goal
Let Applio send on its own only where the operator allowed it and every guardrail passes (SPEC F6).

## Acceptance criteria
- [ ] AC-1: A drafted job is sent without approval only if its source is Autonomous, its channel is email or ATS, its score is at or above the auto-send score, the channel's daily cap isn't reached, the company isn't blocklisted, and it isn't a duplicate of an application already sent.
- [ ] AC-2: Any failed gate leaves the job in Review with the reason shown.
- [ ] AC-3: Autonomous sends are logged with sentBy = Autonomous and appear in Applications.
- [ ] AC-4: Nothing is sent autonomously while automation is paused or the AI or Gmail hard stop is reached.

## Must not break
- MNB-1: Platform and career-site jobs are never sent autonomously, whatever the source setting.
- MNB-2: Upwork proposals are never sent autonomously.

## Known risks
- A misconfigured threshold could send many applications quickly; consider a first-run cap (open question).

## Test plan
- AC-1: One test per gate, each failing alone, plus the all-pass case.
- AC-2: Tests assert the shown reason per gate.
- AC-3: Test checks sentBy and Applications listing.
- AC-4: Tests: paused, AI budget stop, Gmail cap.
- MNB-1: Tests with Autonomous source on platform and custom channels.
- MNB-2: Test with the Upwork source.

## Out of scope
- New channels.
