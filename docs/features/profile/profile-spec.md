## Feature goal
Let the operator keep the facts, answers and preferences the AI writes from, so nothing gets into a resume or an answer that isn't theirs (SPEC F1, principle 2; prototype screen 4).

## Acceptance criteria
- [ ] AC-1: Profile shows the reference resume (file name, upload date, facts seeded), with Replace and Preview template; Replace opens the file picker and updates the card; cancelling changes nothing.
- [ ] AC-2: Preview template toggles the ATS-safe single-column template preview.
- [ ] AC-3: "What you are looking for" shows target roles as chips, seniority, work type, location, hours overlap and minimum pay; Edit opens an inline form; Save persists and returns to the read view; saving with no target role shows an error and saves nothing; Cancel discards.
- [ ] AC-4: The fact bank groups facts by role/section in profile order, each section showing dates and fact count, each fact showing its text, tags and how many drafts used it; skills show as chips.
- [ ] AC-5: Add fact requires text ("Write the fact first." otherwise), lets the operator choose the section, adds the fact at the top of it and confirms.
- [ ] AC-6: Edit fact replaces the row with an inline editor; Save updates the text; Delete fact removes it and confirms; Cancel restores the row.
- [ ] AC-7: The answer bank lists question, answer, who wrote it (You / AI, approved by you) and reuse count; Add answer requires both fields ("Fill in both the question and the answer." otherwise) and adds it to the top.

## Must not break
- MNB-1: Deleting a fact never changes drafts that were already generated.

## Known risks
- Resume import only records the file until PR-10 adds parsing.
- Minimum pay and hours overlap are free text; the prefilter (PR-12) must parse or ignore them.

## Test plan
- AC-1: Manual: Replace with a file and with cancel (Electron and browser dev).
- AC-2: `profile-page.test.tsx` — Preview template shows the template region.
- AC-3: `profile-page.test.tsx` — edit roles and save; `preferences-model.test.ts` — round trip and empty roles error; manual Cancel.
- AC-4: `profile-page.test.tsx` — grouped heading and "used 14×"; `preferences-model.test.ts` groupFacts.
- AC-5: `profile-page.test.tsx` — empty error, then add to Projects.
- AC-6: `profile-page.test.tsx` — inline edit and delete; manual Cancel.
- AC-7: `profile-page.test.tsx` — AI badge, both-fields error, added answer.
- MNB-1: `mock-api.test.ts` — delete a fact, the existing draft text is unchanged.

## Out of scope
- Parsing resumes into facts (PR-10).
- Usage and limits (PR-6b).
