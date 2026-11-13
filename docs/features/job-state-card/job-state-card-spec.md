## Feature goal
Every job in Review says where it is, why, and what moves it on, in one card instead of a stack of banners, and every progress stepper uses the same five words: New → Matched → Drafted → Ready → Sent. Roadmap: `docs/features/redesign-v2/redesign-v2-roadmap.md` PR-1. Design: canvas row "Redesign v2", boards 4 (Job state card) and 6 (Lifecycle and words).

## Acceptance criteria
- [x] AC-1: A draft's detail shows exactly one state card, chosen by priority: send failed > suspicious post > PDFs failed > placeholders left > older profile > Gmail not ready > PDFs saving > ready (what's wrong in the draft before what's wrong with the channel). After a decision: not sent, unconfirmed, handed off, sent, applied by you, skipped.
- [x] AC-2: Every other state that also applies is listed, folded, under "More notes" (title only); nothing that applied before is dropped.
- [x] AC-3: Under the card, a "What happens next" line says what Applio will or won't do on its own, read from the job's channel, the post's suspicious flag and its saved "Not sent automatically" note, never from a guess.
- [x] AC-4: "Sent" (card and stepper) shows only when a sent record exists.
- [x] AC-5: Review's draft, drafting and job panels and Add job use one stepper with the labels New, Matched, Drafted, Ready, Sent.
- [x] AC-6: The undrafted-job panel words its state as one card too (strong match not drafted, below the draft bar, draft failed, not scored), and its "Dismiss" becomes "Skip job".
- [x] AC-7: "Draft bar" replaces "draft score / draft threshold / Draft at" in Review, Add job and Settings copy.

## Must not break
- MNB-1: A suspicious post still needs the second "Send anyway" click.
- MNB-2: A refused send still reads "Not sent." with Retry, and stays in Review.
- MNB-3: Approve stays disabled with its reason beside it until the PDFs are saved, and turns on by itself when they land.
- MNB-4: Retry saving PDFs reprints without AI.
- MNB-5: No token spend without a click; Redraft and Draft this one still show their cost.

## Test plan
- AC-1: `job-card.test.ts` › one test per rung ("picks a failed send over everything", … "shows ready when nothing else applies"), "reads after-decision states from the send log".
- AC-2: `job-card.test.ts` › "folds every other state that applies into notes"; `review-page.test.tsx` › "shows one state card and folds the rest into More notes".
- AC-3: `job-card.test.ts` › nextLine tests (handoff channel, suspicious, held with a saved reason, held without one, sent, skipped).
- AC-4: `job-card.test.ts` › "never says sent without a sent record"; `review-model.test.ts` › "calls a job sent only when a sent record exists".
- AC-5: `review-model.test.ts` › jobSteps tests with the new labels; `add-job-page.test.tsx` › pipeline test asserts "Ready: done".
- AC-6: `job-card.test.ts` › undraftedCard tests; `review-page.test.tsx` › below-bar, strong-match and skip tests.
- AC-7: `review-page.test.tsx` › "below your draft bar (75)"; `settings-page.test.tsx` label check; manual read.
- MNB-1..5: existing `review-page.test.tsx` tests for suspicious send, refused send, PDFs saving/landing, retry saving, and redraft/draft costs.

## Out of scope
- Moving Approve/Skip into the card: the footer keeps the decision buttons; the card carries the recovery action (Retry, Redraft, Retry saving PDFs, Set up Gmail). Inbox (PR-4) revisits layout.
- Questions panel copy (it already leads with one state); Activity bar (PR-2).
