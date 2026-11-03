## Feature goal
Let any job the operator finds anywhere be pasted in, scored and queued, with the channel and highest autonomy shown before it joins the queue (SPEC F2 Clip, F5; prototype screen 7).

## Acceptance criteria
- [ ] AC-1: Add job offers Paste text / Paste link and Use an example; Analyze job with empty input says what to paste; a link must start with http(s).
- [ ] AC-2: Analysis shows company, source, role, tags, score (above/below the draft threshold), summary, the detected channel, how Applio will apply, the highest autonomy allowed and tokens used; platform links are capped at Draft → Approve; posts with no apply route say so.
- [ ] AC-3: Add to review queue creates a drafted job and confirms with links to Add another and Go to Review; Discard clears the form.

## Must not break
- MNB-1: Nothing is added to the review queue until the operator clicks "Add to review queue".

## Known risks
- Analysis is canned in the mock; real parsing comes in PR-23.

## Test plan
- AC-1: `add-job-model.test.ts`; `add-job-page.test.tsx` empty input.
- AC-2: `add-job-page.test.tsx` — email post and LinkedIn link results; `mock-api.test.ts` analyze cases.
- AC-3: `add-job-page.test.tsx` — added banner and drafted job in store; manual Discard and Add another.
- MNB-1: `add-job-page.test.tsx` — the job is absent from the store after Analyze and present only after Add to review queue.

## Out of scope
- Real job parsing and assisted fill (PR-23).
