## Feature goal
Fix three problems the operator hit running the rebuilt app: a draft stuck on "Saving the résumé and letter PDFs" forever, "Open it" in the green banner unreadable (green on blue), and Skip pressed against the Draft button in Matches.

## Acceptance criteria
- [x] AC-1: A drafted job whose PDFs aren't printed and that main isn't working on shows "PDFs didn't save" with "Applio stopped before the PDFs were printed" and a free "Retry saving PDFs", in the card and stepper, instead of "Saving…".
- [x] AC-2: While main is working on the job (it is listed as drafting) the same job still shows "Saving…", and Approve waits.
- [x] AC-3: A recorded save failure keeps its own reason, and a job with a folder is ready whatever main is doing.
- [x] AC-4: A primary button in a success banner (e.g. "Open it") reads white on blue, like in warning and danger banners.
- [x] AC-5: The buttons in a Matches row have space between them.

## Must not break
- MNB-1: Approve still turns on by itself when main reports the PDFs saved; Retry saving PDFs still reprints without AI.
- MNB-2: Add job's and the handoff's own saving views are unchanged.

## Known risks
- "Not being worked on" is read from main's status pushes (`drafting`). In the first moments after Claude marks a draft, before the first push lands, a draft could briefly read as stalled and then correct itself when the push arrives.
- Add job's DraftProgress still reads a missing folder as "saving" (it is only on screen while the draft runs).

## Test plan
- AC-1: `job-progress.test.ts` › "says the save stopped when nothing is saving it, instead of spinning forever"; `job-card.test.ts` › "shows a stalled save as failed PDFs with a retry, when nothing is saving the job"; `review-model.test.ts` › "shows Drafted failed when the save stopped and nothing is printing"; `review-page.test.tsx` › "does not spin forever on a draft whose save stopped: it offers Save PDFs again".
- AC-2: `job-progress.test.ts` › "is saving only while main is working on the job"; `job-card.test.ts` › "still shows the PDFs saving while main is working on the job"; `review-page.test.tsx` › "waits to approve until the PDFs are saved, and says so".
- AC-3: `job-progress.test.ts` › "keeps a recorded failure over the stopped message, and never doubts a finished save".
- AC-4: `styles.test.ts` › "keeps primary buttons white inside warning, danger and success banners"; measured in Chrome (white on blue).
- AC-5: `styles.test.ts` › "spaces the buttons in a Matches row apart"; measured in Chrome (8px).
- MNB-1: `review-page.test.tsx` › "turns Approve on by itself once main reports the PDFs were saved", "retries saving the PDFs without drafting again, after a failed save".
- MNB-2: existing `add-job-page.test.tsx` draft-progress tests.

## Out of scope
- Repairing stalled drafts at launch (a startup sweep that records the failure); the card already offers the retry.
- The Inbox key tests now wait for their button (a flake under load, not part of the fix).
