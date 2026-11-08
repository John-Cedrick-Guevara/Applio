## Feature goal
Every prefilter input is editable and unambiguous (QA 2026-11-07 #9). Work type and remote-only can be changed after onboarding. Seniority is a choice the prefilter understands. Minimum pay always carries its currency and period, so "30,000" is never silently read as $30,000 a year.

## Acceptance criteria
- AC-1: The preferences editor has Work type checkboxes (Full-time, Contract, Freelance) and a Remote only toggle. They save, and the next run's triage uses them.
- AC-2: Seniority is a select (Any, Intern, Entry level, Mid level, Senior, Lead or above). A value typed earlier stays selectable rather than being replaced.
- AC-3: Minimum pay is entered as amount + currency + period and saved as "30,000 PHP / month". The currency defaults from the profile location.
- AC-4: A "30,000 PHP / month" minimum doesn't drop a "USD 1,500 / month" job. PHP (₱) and other ISO codes are read.
- AC-5: A minimum with no currency (legacy "30,000") filters nothing on pay, and Profile shows "Pick a currency and period…" with **Fix it**.

## Must not break
- MNB-1: Stored preferences load unchanged: `minimumPay` stays text, so there's no migration and the scoring prompt still reads it.
- MNB-2: Existing pay parsing ($, €, £, ranges, hourly/monthly/yearly).

## Test plan
- AC-1: `preferences-model.test.ts` › "saves work type and remote-only…"; `profile-page.test.tsx` › "edits work type and remote-only, and saves pay with its currency and period"
- AC-2: `profile-page.test.tsx` (select drives the saved value); `triage.test.ts` › `seniority rule` (PR 3)
- AC-3: `preferences-model.test.ts` › "writes minimum pay with its currency and period…", "reads a saved minimum back…", "defaults the currency from the operator's location"
- AC-4: `pay.test.ts` › "never compares a PHP monthly minimum against a USD monthly job…", "compares like with like…", PHP/₱/AUD parsing
- AC-5: `pay.test.ts` › "drops nothing on a minimum with no currency…"; `preferences-model.test.ts` › "flags a legacy minimum…"; `profile-page.test.tsx` › "asks for a currency and period…"
- MNB-1/2: `pay.test.ts` existing cases; full suite.

## Decisions
- No exchange-rate table: jobs paid in another currency are kept, and the editor says so.
- "Re-check stored jobs with the new filters" is left out; new filters apply from the next run.

## Out of scope
- Converting between currencies; re-filtering stored jobs.
