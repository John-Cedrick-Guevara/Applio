## Feature goal
Fix the v3 UX audit's shared failures once, in tokens and shared components, so every page picks them up: text under 12px and off-scale sizes, 36–40px controls, two primary colors (blue and ink), heavy shadows, and no shared way to show a state. Roadmap: `docs/features/ux-v3/ux-v3-roadmap.md` PR-3. Design: canvas row "v3", board "State kit".

## Acceptance criteria
- [x] AC-1: No text is smaller than 12px, and every size sits on 12 / 14 / 16 / 20 / 24 (plus 32px score numbers).
- [x] AC-2: Buttons, tabs and filter pills are at least 44px tall.
- [x] AC-3: Strong buttons use the same blue as primary ones.
- [x] AC-4: Light shadows stay under 8% opacity.
- [x] AC-5: `StatusChip` shows a status with a mark and words; `Callout` shows one state message with an optional action, as an alert for failures and a status otherwise.
- [x] AC-6: `Stepper` marks the job's current step (`aria-current="step"`) and names each step's state for screen readers; `StepList` lists a long task's stages.
- [x] AC-7: `ConfirmDialog` names the thing in its title, starts focus on Cancel, keeps Tab inside, cancels on Escape or backdrop, and returns focus to the trigger.

## Must not break
- MNB-1: Existing pages keep their layout; only sizes, colors and shadows change.
- MNB-2: Busy buttons still show their delayed spinner, and reduced motion still stops it.

## Test plan
- AC-1: `styles.test.ts` › "never sets text below 12px, in tokens or hard-coded", "keeps text on the 12 / 14 / 16 / 20 / 24 scale, plus big score numbers".
- AC-2: `styles.test.ts` › "makes buttons at least 44px tall".
- AC-3: `styles.test.ts` › "gives strong buttons the same blue as primary ones…".
- AC-4: `styles.test.ts` › "keeps light shadows under 8% opacity".
- AC-5: `job-state.test.tsx` › "says the state in words, never by color alone", "announces a failure as an alert with its next step", "announces other states politely".
- AC-6: `job-state.test.tsx` › "marks the step the job is on, and says when it is blocked", "lists each stage with its state".
- AC-7: `job-state.test.tsx` › ConfirmDialog tests.
- MNB-1, MNB-2: the full existing page and component suites pass unchanged.

## Out of scope
- The narrow (under 640px) nav and list-then-detail layout from the design: the app window's minimum width is 960px, so it can't be that narrow.
- Small editor controls in Profile and Settings (chip add/remove, toggles): a later polish pass.
- Using the components in pages: PR-4 and PR-5.
