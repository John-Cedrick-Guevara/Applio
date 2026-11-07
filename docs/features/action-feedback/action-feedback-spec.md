## Feature goal
Every action shows its result, and every action looks like a button (operator feedback, 2026-11-07). Before this, some actions were styled as links or bare text, and some finished with no visible result.

## Acceptance criteria
- [x] AC-1: Run now ends with a toast saying what it produced, or that every source had used today's polls.
- [x] AC-2: Skip confirms which job was skipped.
- [x] AC-3: Changes in Settings that save on their own (a source on or off, autonomy, schedule, launch at login, assisted fill, AI engine) each confirm with a toast.
- [x] AC-4: Importing a résumé says how many new facts were found, or that nothing was new.
- [x] AC-5: Actions look like buttons. "Show them", "Use an example", "Add another", "Discard", "Dismiss the rest", "Change", "Skip", "I didn't apply" and the empty-state "Add a job" use button styles. The text-only ghost style is kept only for Cancel.
- [x] AC-6: The draft's Approve, Edit and Skip bar stays visible at the bottom while the draft scrolls.
- [x] AC-7: Add a job's token estimate matches what a real analysis costs (about 8k, not 1k).

## Must not break
- MNB-1: Failure toasts are unchanged.
- MNB-2: Button roles and names tests rely on stay the same.

## Test plan
- AC-1: `review-model.test.ts` runResult (three cases); `review-page.test.tsx` "tells the operator what Run now did".
- AC-2: `review-page.test.tsx` "confirms a skip".
- AC-3: `settings-page.test.tsx` "turns a source off and changes its autonomy" (toast).
- AC-4: `profile-page.test.tsx` "imports a résumé…" (toast).
- AC-5, AC-6: manual in the mock renderer at 1280×800. The buttons render as outlined buttons, and the footer stays flush at the bottom while the letter scrolls under it.
- AC-7: copy read.
- MNB-1, MNB-2: the full suite passes.

## Out of scope
- A design-system pass on colour use (blue for send/approve vs ink for run/save stays as designed).
