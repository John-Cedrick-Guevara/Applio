## Feature goal
Give the manual hand-off screen the v5 layout: one column with a job strip, then the numbered steps to copy and apply, instead of steps beside a summary column. Applio still never submits on a platform or career site. Roadmap: `docs/features/v5-redesign/v5-redesign-roadmap.md` PR-8. Design: canvas board "v5 · 6 Hand-off (you apply)" (https://claude.ai/artifact/3T4Bs69qQWvxy9xKiND79T).

## Acceptance criteria
- [ ] AC-1: The header reads "Apply to **Company** on Platform" (company in bold), with a back link "Inbox · Hand off" to the job in the Inbox.
- [ ] AC-2: A job strip above the steps shows the match score, role, company and source credit, type, apply target, pay when given, the role summary and the tokens used; there is no side column.
- [ ] AC-3: The steps, their numbering (no gaps), copy buttons, assisted-fill, Upwork Connects cost, the older-profile warning and the done step behave as before.
- [ ] AC-4: The "Want this filled for you?" tip shows below the steps only when assisted fill is off.

## Must not break
- MNB-1: Applio never submits on a platform or career site; "Mark as applied" logs only on the operator's click and writes the sent record once.
- MNB-2: Copy buttons copy exactly the answer, letter or proposal shown.
- MNB-3: An older-profile draft still warns before copying.

## Known risks
- Role summary and facts moved from the side column into the strip; nothing is dropped except the duplicate Channel and Type labels.

## Test plan
- AC-1: `handoff-page.test.tsx` › "names the company in bold and links back to the Inbox hand-off list", "walks through applying on the platform".
- AC-2: › "puts a job strip above the steps instead of a side column".
- AC-3: existing tests: "numbers only the steps it shows…", "copies an answer to the clipboard", "fills the form in Applio when assisted fill is on…", "shows the Connects an Upwork proposal costs…", "logs the application once the operator is done", "records when the operator decided not to apply".
- AC-4: › "words the assisted-fill tip for a career-site job as career sites, not platforms", "stays a manual handoff when assisted fill is off".
- MNB-1..3: the existing tests above.

## Out of scope
- Redrafting from this page; the Inbox owns drafts.
- Profile, Settings, Usage.
