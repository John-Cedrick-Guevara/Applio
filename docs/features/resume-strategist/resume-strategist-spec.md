## Feature goal
The operator wrote the instructions they want Claude to follow when tailoring applications (2026-11-07). The instructions cover a résumé strategist that gets past ATS screening and reads well to a hiring manager in 30 seconds, a locked one-page résumé layout, and cover-letter rules. Applio should generate every résumé and cover letter by those instructions. The operator's fact bank stays the only source of truth, and nothing in it is invented. When something needed for a truthful draft is missing or conflicts with the facts, Claude asks the operator up to 5 questions instead of guessing. The operator answers in the app, and the draft continues.

## Decisions (settled with the operator, 2026-11-07)
- **Header details:** contact details, links and education live in new Profile fields, not in the fact bank. Claude can't change them.
- **Fact bank:** the operator's fact bank is rebuilt from their prompt's "About Me" section, replacing the 32 facts from the broken import.
- **Answers to Claude's questions:** each answer is used for that job's draft. A per-answer "Save to fact bank" choice adds it as a fact for future drafts.
- **When Claude asks:** only when blocked (something missing, or a conflict with the facts). The job waits in Review while other jobs keep drafting, and answering re-runs its draft.
- **Defaults chosen while writing (change in review):**
  - Effort level comes from the match score: High 75+, Medium 50–74, Quick under 50.
  - The prompt's 0–10 match score is Applio's 0–100 score divided by 10.
  - The prompt text is built into Applio; editing it in the app is out of scope.

## Acceptance criteria
- [ ] AC-1: Profile has a "Contact & links" card with phone, location line (e.g. "Philippines • Open to Remote"), links (label + URL, any number), education, and "notes for Claude" (personal rules such as "never call the Afterhours role an internship"). Each saves and shows after a restart.
- [ ] AC-2: A fact-bank group can carry dates, a one-line context (or project description and stack), an optional link, and a kind: Experience, Project, Skills, Certifications or Other. The Profile fact bank shows and edits these.
- [ ] AC-3: The operator's fact bank is replaced with the facts from their prompt.
  - Each role and project becomes a group with its exact dates, context and link.
  - Each bullet becomes a fact with its numbers unchanged.
  - Skills are grouped as Languages, Frontend, Backend, Databases, AI / LLM and Tools; certifications and achievements become facts too.
  - The old 32 facts are gone, and nothing else in the database changes.
- [ ] AC-4: Drafting uses the operator's instructions: role, source-of-truth rules, résumé rules and cover-letter rules. The "About Me" content comes from the fact bank and the Contact & links card, never from text built into the app.
- [ ] AC-5: A generated résumé follows the locked layout, top to bottom:
  1. Name, bold, centered, all caps.
  2. A title line matching the role.
  3. The contact line.
  4. The links line, as hyperlinks with labels only.
  5. SUMMARY, 3 lines at most.
  6. EXPERIENCE: "Role — Company" bold with dates right-aligned on the same line, then the context line, then bullets.
  7. PROJECTS: "Name | link | Solo build", one description-and-stack line, then up to 3 bullets.
  8. TECHNICAL SKILLS, grouped.
  9. CERTIFICATIONS & ACHIEVEMENTS.
  10. EDUCATION, without years.

  Formatting: single column, Times at about 10pt, A4, about 0.5" margins, uppercase section headings with a thin rule, selectable text, no tables, images or columns.
- [ ] AC-6: Every résumé bullet still cites a fact, and its numbers match that fact exactly. Group dates, titles and employers are printed exactly as stored, never as Claude wrote them.
- [ ] AC-7: The résumé PDF is named `<LastName>_<Role>.pdf` (e.g. `Guevara_AI_Engineer.pdf`), with the role made filename-safe. The cover letter is `<LastName>_<Role>_Cover_Letter.pdf`. Emails attach these names.
- [ ] AC-8: The cover letter is under 250 words, follows hook → proof with numbers → value → close with availability and a call to action, and ends with the sign-off built from name, phone and first link. A draft over 250 words is refused and Claude retries.
- [ ] AC-9: For email applications Claude writes the subject line, and the send uses it. Other channels keep the letter as written.
- [ ] AC-10: Each draft shows its effort level (High, Medium or Quick) and the job's top keywords, split into those the operator can claim (with the fact behind each) and gaps.
- [ ] AC-11: When Claude can't draft truthfully, it saves up to 5 questions instead of a draft. The job shows in Review under "Needs your answers" with the questions, and other jobs in the run still draft. The run's toast counts the jobs waiting on answers.
- [ ] AC-12: The operator answers in Review, each answer with a "Save to fact bank" choice. Submitting re-drafts that job with the answers available. Answers marked for saving become facts in a group the operator picks, and the rest are used for that draft only. Answers are never sent anywhere except to Claude for that draft.
- [ ] AC-13: A job waiting on answers is never drafted or sent automatically, whatever its source's autonomy, until the operator answers or skips it.

## Must not break
- MNB-1: The fact checks on save still refuse a résumé line citing an unknown fact or adding a number its fact doesn't state.
- MNB-2: The double-send guard, the autonomy caps and the budget guard behave as before.
- MNB-3: Drafts saved before this change still open and print in Review, in the old layout.
- MNB-4: Job postings stay untrusted: nothing in a posting can change the instructions or trigger a question that asks for secrets.
- MNB-5: Screening answers still reuse the answer bank first.

## Known risks
- **Page length:** a stricter prompt and structured résumé make each draft call longer and pricier. This is measured on the first real drafts.
- **Fitting one page:** depends on Claude's choices. If a résumé overflows, Applio notes it, but it doesn't cut content on its own.
- **Data loss:** rebuilding the fact bank deletes the old facts, so a backup of the database is taken first.

## Test plan
- AC-1, AC-2: profile service and repository tests round-trip each field; Profile page tests edit and save them; restart test in `backend.test.ts`.
- AC-3: a one-off rebuild script with a test against a copy of the schema (facts replaced, other tables untouched). Manual: open Profile and compare with the prompt.
- AC-4: `draft-jobs.test.ts` asserts the system prompt holds the operator's instructions and no personal facts; the MCP `get_profile` test asserts the Contact & links fields and group details are returned.
- AC-5: `application-documents.test.ts` renders a structured draft and checks section order, heading text, right-aligned dates, link labels and the absence of tables. Manual: open a printed PDF and check the layout against the rules.
- AC-6, MNB-1: `tools.test.ts` refuses an uncited bullet and an extra number; it also asserts that dates, titles and employers come from the group, not the draft.
- AC-7: `application-folder.test.ts` file names, including unsafe role characters; the send test asserts the attachment names.
- AC-8: `tools.test.ts` refuses a 251-word letter; a sign-off test.
- AC-9: `send-application.test.ts` uses the draft subject for email and falls back to the old subject when none is given.
- AC-10: Review page test shows the effort level and the keyword lists; an effort-from-score unit test at 49, 50, 74 and 75.
- AC-11: a `tools.test.ts` test for saving questions (max 5, with a 6th refused); a `draft-jobs.test.ts` test where one job asks and the next drafts; a `review-model` toast test.
- AC-12: a Review page test answering two questions, one saved to the bank; a backend test that the re-draft prompt includes the answers and the saved one becomes a fact.
- AC-13: `approve`/auto-send tests refuse a job with open questions; an autonomous-source test where it isn't sent.
- MNB-2: existing send-guard, autonomy and budget tests pass.
- MNB-3: a test rendering a draft without the new fields in the old layout.
- MNB-4: a prompt test checks the posting stays inside its untrusted-data tags; the question schema refuses anything asking for passwords, keys or tokens.
- MNB-5: existing answer-bank reuse test passes.

## Out of scope
- Editing the drafting instructions inside the app.
- Platform-specific short messages for LinkedIn and OnlineJobs.ph notes. Applio doesn't send on those platforms, and the handoff shows the full letter.
- Automatic trimming of a résumé that runs past one page.
- Changing how jobs are scored.
