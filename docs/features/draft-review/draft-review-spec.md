## Feature goal
Show the selected draft beside the queue so the operator sees exactly what will go out, can edit it, and approves or hands it off, with nothing sent that they didn't see (SPEC F4, F5, F6; prototype screen 1).

## Acceptance criteria
- [ ] AC-1: Selecting a draft shows it beside the queue and puts its id in the URL (`#/review/:id`); opening that URL selects it; with no id the top draft is selected.
- [ ] AC-2: The draft shows company, source, when found, role, tags, score with "Draft at X · Auto at Y", the role summary, strengths and gaps.
- [ ] AC-3: Tabs switch between Cover letter (Proposal for freelance jobs), Resume and Original post; the bar states how many fact-bank facts were used.
- [ ] AC-4: Edit opens the letter in an editor; Save persists it and labels it "Edited by you"; Cancel discards changes.
- [ ] AC-5: On email and ATS jobs the primary button is "Approve & send email" / "Approve & submit form"; approving sends, shows "Sent to … / Form submitted at HH:MM" with a link to Applications, and removes the actions.
- [ ] AC-6: On platform and career-site jobs the primary action is "Open handoff", linking to `#/handoff/:id` (page arrives in PR-4b); nothing is sent from Review.
- [ ] AC-7: Skip marks the job skipped (dimmed in the queue) and selects the next waiting draft.

## Must not break
- MNB-1: No platform or career-site job can be sent from Review (SPEC principle 3).

## Known risks
- Approving re-uses the stored draft; if two windows edit the same letter, the last save wins.

## Test plan
- AC-1: `review-page.test.tsx` opens with an id; manual URL/back-forward check.
- AC-2: `review-page.test.tsx` — selected draft heading, gap text.
- AC-3: `review-page.test.tsx` — Resume and Original post tabs.
- AC-4: `review-page.test.tsx` — edit, save, "Edited by you", stored text; manual Cancel.
- AC-5: `review-page.test.tsx` — approve email sends and shows confirmation; `review-model.test.ts` primaryAction.
- AC-6: `review-page.test.tsx` — Open handoff link for j3; `review-model.test.ts` handoff cases.
- AC-7: `app.test.tsx` — Skip selects the next draft and the skipped row stays, marked Skipped.
- MNB-1: `review-model.test.ts` — platform/custom never `handoff: false`.

## Out of scope
- The handoff page (PR-4c).
- Real sending (Stage 2).
