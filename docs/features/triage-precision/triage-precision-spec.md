## Feature goal
Spend tokens only on jobs the operator could get (QA 2026-11-07 #4, #6, #14). The free prefilter drops roles too senior for them and places that exclude their country, matches target roles precisely, treats "Northbeam Labs" and "Northbeam" as one company, and counts only truly new jobs.

## Acceptance criteria
- AC-1: With seniority "Entry level", Senior/Staff/Principal/Lead/Head of/Director/Architect/VP titles drop as `seniority` unless the title also opens to juniors. Mid level drops only Staff and above. No seniority set drops nothing.
- AC-2: With the operator in the Philippines, a job limited to places that leave the Philippines out (US only, EEA, Czechia…) drops as `location`, whether the place is in the location or the title. Worldwide, APAC, unreadable, or loose regions ("Africa, W Asia") pass. If the operator's country can't be read, the rule is skipped.
- AC-3: Target roles match a title part, not a bag of words. "SEO and Web Dev Specialist" isn't a Web Developer, and "QA Engineer – Backend & Frontend" isn't a Back-end Engineer. "AI/Automation Engineer", "Backend Engineer, Payments", "Software Development Engineer II - CRM" and "Engineer, Platform" still match.
- AC-4: On the operator's 83 real stored jobs, at least half of those the AI scored under 20 are dropped, and every job scored 50 or more passes.
- AC-5: "Northbeam Labs" and "Northbeam, Inc." share a dedup key. Stored jobs are re-keyed on start; a key that would collide is kept as it was.
- AC-6: Add job with a job Applio already has shows "You already have this job in Applio (status)" and **Open existing**, with no Add button.
- AC-7: A run counts as new only jobs no earlier run saw, dropped ones included. Dropped jobs are still re-checked each run, so loosening a filter brings them back.

## Must not break
- MNB-1: Existing triage rules (blocklist, type, remote, pay, hours) and their order.
- MNB-2: A job is never stored twice (unique dedup key).
- MNB-3: Discovery, scoring and drafting flow.

## Test plan
- AC-1: `triage.test.ts` › `seniority rule` suite
- AC-2: `triage.test.ts` › `location rule` suite
- AC-3: `triage.test.ts` › `role match` suite
- AC-4: `real-titles.test.ts` (fixture `real-titles.ts`, from the QA DB)
- AC-5: `dedup.test.ts` › "treats a company with or without a descriptor like "Labs" as the same company"; `jobs.test.ts` › "re-keys stored jobs when the dedup rules change…"
- AC-6: `analyze-job.test.ts` › "names the job Applio already has…"; `add-job-page.test.tsx` › "offers Open existing…"; `backend.test.ts` › "refuses to add a job Applio already has, naming it"
- AC-7: `discover.test.ts` › "counts as new only jobs no earlier run has seen…", "remembers the key of every job it saw this run…"; `jobs.test.ts` › "remembers every key it has seen…"; `backend.test.ts` › "does not save the same job again on the next run"
- MNB-1–3: full suite.

## Measured on the real data
83 jobs → 19 pass (77% dropped for free): 42 seniority, 18 location, 4 role. Scored under 20: 44 of 49 dropped. Scored 20–49: 20 of 26 dropped. Scored 50+: all 8 kept.

## Decisions
- Country names come from the platform's ISO region list (`Intl.DisplayNames`), with no new dependency. Cities and US states aren't mapped, so "Kansas" or "Berlin" alone is "can't tell" and kept.
- Seniority stays free text until PR 4 makes it a select. The rule reads "intern/entry/junior/graduate" and "mid" from it.

## Out of scope
- A per-reason drop breakdown on the Usage page, and disabling Run now when every source is at its limit (PR 7).
- A dedup check before spending AI tokens in Add job.
