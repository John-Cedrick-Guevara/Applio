## Feature goal
Fix what the pre-production QA pass found on `main` after the QA 2026-11-07 PRs (#58–#65). That pass ran the real backend on a copy of the operator's DB with the real Claude Code engine and MCP server (sending faked), plus a visual pass of every page.

## Findings
1. **A draft can be approved before its PDFs exist.** Claude's `save_draft` marks the job drafted mid-turn; the files are printed only after the turn ends. Approve was enabled meanwhile, and a click failed with "Open the job folder", for a folder that didn't exist yet. Once the files landed, open pages weren't told, so Open PDF stayed disabled until a reload.
2. **A placeholder in a cover letter or answer could be sent.** Only follow-ups were guarded. The draft check listed `[Your Name]` merely as an unverified "Name".
3. **Editing preferences rewrote a minimum with alternatives.** "$120k / year or $45 / hour" was read as 120,000 per *hour* and saved that way when any other field was edited.
4. **The pay fields stacked vertically** on Profile (their row style lived in the Settings stylesheet).
5. **A "sent.md" file chip opened the folder**, duplicating Open folder under a misleading name.
6. **An HN post listing two roles stored the second as the location** ("AI Product Manager"), seen in the live discovery run.

## Acceptance criteria
- AC-1: While a fresh draft's files are being written, Review says "Saving the résumé and letter PDFs…" and Approve waits. A failed save shows its reason. The send refuses with "still saving" rather than pointing at a missing folder. Open pages refresh when the files land.
- AC-2: A letter with a placeholder is never sent (the draft stays drafted, Approve is disabled, and the badge reads "Replace [X] before sending"). A placeholder answer is never typed into a form; that question is handed to the operator.
- AC-3: An untouched saved minimum is kept exactly as stored. The editor reads only its first alternative, with that alternative's own period.
- AC-4: Amount, currency and period sit on one row.
- AC-5: No file chip claims to be a file it doesn't open.
- AC-6: An HN place field that names a role, with no remote/onsite wording, is left empty.

## Must not break
- MNB-1: Sending, retry, double-send guard; drafting through the MCP server.

## Test plan
- AC-1: `send-application.test.ts` › "says the files are still being saved when the draft has no folder yet"; `jobs.test.ts` › "moves the version when a job's files are saved…"; `review-model.test.ts` › `filesState`; `review-page.test.tsx` › "waits to approve until the PDFs are saved, and says so"; QA harness (real Claude) › "approving before the PDFs exist says they are still saving"
- AC-2: `send-application.test.ts` › "refuses to send a letter that still has a placeholder…", "never types a placeholder answer into a form…"; `draft-check.test.ts` › `placeholders`; `review-model.test.ts` › "puts a leftover placeholder first…"
- AC-3: `preferences-model.test.ts` › "keeps a saved minimum exactly as it was…", "reads only the first of several alternatives…"
- AC-4/5: visual check in Chrome
- AC-6: `feeds.test.ts` › "does not take a second role for the location"
- MNB-1: full suite; QA harness send path.
