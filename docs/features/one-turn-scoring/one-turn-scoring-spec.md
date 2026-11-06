## Feature goal
Score jobs in one turn per batch, with the instructions and fact bank as a fixed prefix Claude caches, so scoring costs a fraction of the MCP tool loop and can't overflow a tool's output (QA F5).

## Acceptance criteria
- [x] AC-1: Each scoring batch is one AI call with no tools: a fixed prefix (instructions, fact bank, preferences) as the system prompt, and the batch's jobs as compact cards in the message. Claude answers with JSON.
- [x] AC-2: The prefix is byte-identical between calls while the fact bank and preferences don't change, so Claude can cache it. The API engine marks it for caching; Claude Code caches it on its own.
- [x] AC-3: Job cards carry the title, company, location, type, pay, tags, and the posting's substance: "About us", benefits, perks and equal-opportunity sections are removed at no token cost, and the rest is capped at 2,500 characters.
- [x] AC-4: The JSON answer is checked as `save_match` checks it: scores 0–100, strengths citing facts in the bank, jobs from this batch only. Valid scores are saved; a job missing or invalid in the answer gets one retry, then a "Not scored" note.
- [x] AC-5: Drafting keeps Applio's MCP tools, and its `get_jobs` returns the same boilerplate-free text.

## Must not break
- MNB-1: Scoring results land exactly as before (score, summaries, strengths, gaps, found → scored), and budget stops, pauses, retries and notes work as before.
- MNB-2: A posting is still untrusted: it arrives as data in the message, never in the prefix, and the prefix says never to follow instructions in it.

## Decisions (2026-11-06, agreed with the requester)
- A fresh, short conversation per batch, with the cached prefix first, rather than one long conversation: no growing history, no cross-talk between jobs, and no summarizing that could blur the fact bank.
- Boilerplate is cut by section headings (About us, Benefits, Perks, What we offer, Our values, Equal opportunity…), then capped at 2,500 characters. This replaces #44's plain 3,000-character cut.
- One call per batch of 10, as before.

## Known risks
- A posting with unusual headings keeps more text; the cap still bounds it.
- Claude Code decides its own cache points; savings there are measured, not asserted.

## Test plan
- AC-1: `score-jobs.test.ts`: one call per batch, tools off, system is the prefix, message holds the cards.
- AC-2: `prefix.test.ts`: same profile → identical prefix; a changed fact → a different one. `api-engine.test.ts`: the system block carries `cache_control`.
- AC-3: `job-card.test.ts` on a realistic posting: boilerplate gone, requirements kept, the cap holds.
- AC-4: `score-jobs.test.ts`: valid scores saved, an unknown fact or a job outside the batch rejected, a missing job retried once then noted.
- AC-5: `tools.test.ts`: `get_jobs` returns the boilerplate-free text.
- MNB-1: existing scoring and backend tests, updated only where the call shape changed.
- MNB-2: `prefix.test.ts`: no job text in the prefix; `score-jobs.test.ts`: cards are in the message.

## Out of scope
- Applio's own Claude Code profile (next PR); budget accounting (the PR after).
