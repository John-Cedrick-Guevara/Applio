## Feature goal
Let the operator look at one kind of fact at a time in the fact bank (Experience, Projects, Skills) so a long bank stays easy to scan and edit (SPEC F1). Skills move from read-only chips to editable entries so they can be maintained like everything else.

## Acceptance criteria
- [ ] AC-1: Above the sections, the Fact bank shows one filter row: All · Experience · Projects · Skills, each with a count. All is selected on open and shows every section as it does today.
- [ ] AC-2: Choosing Experience or Projects shows only sections whose kind matches; Skills shows the skill chips and any section of kind Skills. Sections with no kind or another kind (certifications, other, unset) show under All only.
- [ ] AC-3: A filter with nothing in it shows a message naming the filter and a next step ("No projects yet. Set a section's kind to Project with its Edit section button.") instead of a blank panel.
- [ ] AC-4: The selected filter is kept while the operator edits, adds or deletes a fact, and is reset to All when they leave Profile.
- [ ] AC-5: Add fact opened while a filter is active preselects a section of that kind; if none exists, it offers all sections.
- [ ] AC-6: Skills can be added and removed from the Skills filter (duplicates ignored ignoring case, empty rejected with a message) and the change persists.
- [ ] AC-7: The filter row is keyboard operable and announces the selected filter and counts to assistive technology.

## Must not break
- MNB-1: With All selected, grouping, section order, dates, context, link, per-fact edit/delete and "used n×" look and behave as before.
- MNB-2: Drafts already generated are unchanged by editing skills (they were made from the fact bank at the time).
- MNB-3: The Profile page's own tabs (Fact bank, Answer bank, Preferences, Résumé) and their add buttons are unaffected.

## Known risks
- Existing sections may have no `kind`, so they would be absent from Experience/Projects until the operator sets one. Mitigation: they stay visible under All, and the section editor already sets kind.
- Skills are stored apart from facts today; a save path for them may be needed.

## Test plan
- AC-1: `profile-page.test.tsx`: renders four filters with counts, All selected.
- AC-2: `preferences-model.test.ts` filtering by kind incl. unset/other; `profile-page.test.tsx` per-filter content.
- AC-3: `profile-page.test.tsx`: empty Projects shows the message.
- AC-4: `profile-page.test.tsx`: open an edit under Projects and cancel, filter still Projects; the filter lives in the Fact bank component, so leaving Profile resets it to All (manual).
- AC-5: `profile-page.test.tsx`: Add fact under Projects preselects a project section.
- AC-6: `profile-page.test.tsx` add, duplicate, empty, remove; `profile-service.test.ts` `saveSkills`.
- AC-7: `profile-page.test.tsx`: accessible names with counts and `aria-pressed`; manual screen reader pass skipped, noted in PR.
- MNB-1: existing `profile-page.test.tsx` fact-bank tests pass unchanged.
- MNB-2: `mock-api.test.ts`: change skills, existing draft text unchanged.
- MNB-3: existing profile tab tests pass unchanged.

## Out of scope
- Importing facts from pasted text or links (see `paste-facts`).
- Reordering or merging sections; changing how drafts use skills.
