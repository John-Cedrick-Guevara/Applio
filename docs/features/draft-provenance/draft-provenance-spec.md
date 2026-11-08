## Feature goal
A draft never claims more than Applio checked (QA 2026-11-07 #10, SPEC §1 "never invent"). Drafts made from an older profile say so and can be redrafted. Cover-letter lines naming something no fact backs are listed. Terms the notes forbid are caught. The trace badge states only what the check proved.

## Acceptance criteria
- AC-1: Each draft keeps the version of the profile it was made from (facts, sections, contact, notes). Once any of those changes, the draft shows "Made from an older profile" with **Redraft** in Review and a notice on the handoff page. Drafts from before this change count as older.
- AC-2: **Redraft** drops the waiting draft and drafts again from the current profile, in the background.
- AC-3: A cover-letter sentence naming a capitalized term or a number that no fact, profile line or posting states is listed under "Check these lines before sending" (e.g. "Marikina City", "PhD", "70%"). Greetings, sign-offs, dates and the operator's own contact details aren't flagged.
- AC-4: A simple rule in Notes for Claude ("Never use 'Internship'") is checked in the letter and résumé, including the shorter form ("intern").
- AC-5: The badge depends on the check: "Every claim traced…" only for a clean, unedited letter; otherwise "cover letter: N unverified lines", "letter edited by you, not checked", "cover letter not checked", or the forbidden term.
- AC-6 (found in passing): Claude's email subject and keywords are kept with the draft. They were dropped on save, so emails went out with the fallback subject.

## Must not break
- MNB-1: save_draft's MCP schema is unchanged (the #56 failure mode).
- MNB-2: Editing a letter, approving and sending.

## Test plan
- AC-1: `draft-check.test.ts` › `profileVersion`; `backend.test.ts` › "marks a draft stale once the fact bank changes…"; `review-page.test.tsx` › "marks a draft made from an older profile and redrafts it on request"
- AC-2: `backend.test.ts` (same test, redraft half)
- AC-3: `draft-check.test.ts` › "flags a place and a degree…", "ignores greetings…", "accepts a section's dates and the operator's own phone and email…"; `backend.test.ts` › "flags cover-letter lines that state something no fact does"
- AC-4: `draft-check.test.ts` › "flags a term the operator's notes forbid…", `forbiddenTerms`
- AC-5: `review-model.test.ts` › `traceLine`; `review-page.test.tsx` › "claims every line traced only when the check says so"
- AC-6: `backend.test.ts` › "keeps Claude's email subject and keywords with the draft"
- MNB-1/2: full suite; `tools.test.ts` unchanged.

## Decisions
- A deterministic check instead of per-paragraph fact IDs from Claude: it keeps the save_draft schema as it is (the #56 risk), costs no tokens, and meets AC-3. Run read-only on the operator's 4 real drafts, it flagged Marikina, Manila (UTC+8), an unbacked "USD 3,000", the forbidden "intern", and one project name ("AOL") worth a look.
- The check runs when a draft is read, so it always uses today's profile.

## Out of scope
- Per-paragraph fact IDs in save_draft.
