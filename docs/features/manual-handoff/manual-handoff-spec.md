## Feature goal
For jobs Applio must never submit itself (platform apply, career sites, Upwork), prepare everything so the operator can apply in a minute, then log exactly what happened (SPEC F5 "Manual handoff", principle 3; prototype screen 2).

## Acceptance criteria
- [ ] AC-1: The handoff page (`#/handoff/:id`) is titled "Apply to <company> on <platform>" and shows numbered steps: open the job on the platform, the tailored resume file and its folder, each screening answer with its source (answer bank / AI with tokens) and a Copy button, the cover letter (or proposal) with Copy, and a final step.
- [ ] AC-2: A side panel shows the job's company, source, role, match score, summary, type, channel and tokens, and a note linking to Settings to turn on assisted fill.
- [ ] AC-3: Copy puts the text on the clipboard, the button reads "Copied" briefly, and a toast confirms; if the clipboard refuses, a toast tells the operator to copy by hand.
- [ ] AC-4: "Mark as applied" logs the job as applied, sent by the operator manually, and confirms; "I didn't apply" marks it skipped; both then link to Applications.
- [ ] AC-5: "Open on <platform>" opens the job in the system browser; "Show in folder" opens the job's folder and is disabled when there is none.
- [ ] AC-6: "← Review" returns to the job in the review queue.

## Must not break
- MNB-1: Applio sends nothing from this page; only the operator's own confirmation changes the job's status.
- MNB-2: Review's "Open handoff" button lands on this page for the same job.

## Known risks
- The "done" state is local to the page; reloading after Mark as applied shows the steps again (the job is already applied, so the actions then fail with a readable message).

## Test plan
- AC-1: `handoff-page.test.tsx` — heading, Open on LinkedIn, screening answers listed.
- AC-2: Manual visual check against the prototype's handoff screen.
- AC-3: `handoff-page.test.tsx` — clipboard holds the answer and the button reads Copied; manual check with the clipboard refused.
- AC-4: `handoff-page.test.tsx` — Mark as applied and I didn't apply update the job.
- AC-5: Manual in Electron: the link opens the default browser; Show in folder opens Finder/Explorer.
- AC-6: Manual: the back link opens `#/review/<id>`.
- MNB-1: Code review: the page calls only `markApplied`, `skipJob`, `openExternal`, `openJobFolder`.
- MNB-2: `review-page.test.tsx` — the Open handoff link targets `#/handoff/j3`; manual click-through.

## Out of scope
- Assisted fill and Upwork Connects cost (PR-23).
