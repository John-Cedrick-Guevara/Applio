## Feature goal
Drafted résumés fill one A4 page and always carry a Projects section with real bullets. Before: recent drafts came back at 38–54% of the page with no Projects and thin bullets (6–9 bullets, down from 13–15 on Nov 8). The fact bank is unchanged; this fixes the drafting instructions (SPEC F4) only.

## Root causes (measured on copies of the live DB, 2026-11-18)
1. The Nov 15 prompt (`0fbcaac`) swapped "2 projects, 2–3 bullets each" for permissions to drop ("at most 3", "drop a project that can't support 2 substantive bullets", "don't repeat Experience", "never restate the context line"). With no minimum, the model dropped every project.
2. "One line, ~110–125 characters, tighten" shrank strong facts into thin bullets.
3. "18–22 bullets" overflows A4: a draft measuring 1.001 of the page prints as 2 pages.
4. Every run's first `save_draft` carried no headline/summary/resume (the published schema is `partial()`), was rejected, and a thin retry (2–5 sections) or an unparseable `keywords` object produced the cut-down résumé.

## Acceptance criteria
- [x] AC-1: The prompt requires exactly 2 projects with 3 bullets each, ranked by depth of mechanism first; an empty Projects section is declared a failed draft.
- [x] AC-2: The page budget is stated in characters (1,650–1,900 across Experience and Projects, 13–14 bullets), and the prompt says 1,950+ spills to page 2.
- [x] AC-3: Bullets keep the fact's mechanism and result (about 110–170 characters), instead of being shrunk to headlines.
- [x] AC-4: One complete `save_draft` call; a retry after a rejection or parse failure resends the complete draft and is never shorter or thinner.
- [x] AC-5: Every skills section and every certification is included (they are part of the page fill).

## Must not break
- MNB-1: Never invent. Every bullet still cites one fact id and its numbers still match that fact (tool validation untouched).
- MNB-2: The prompt contains no personal facts (names, employers, projects, phone); they come from `get_profile`.
- MNB-3: Questions flow, cover-letter rules, redraft prompts and `save_draft` validation are unchanged.

## Known risks
- The model still varies by a few percent run to run; an automatic page-count trim in the app would close the gap (out of scope).
- Skills/cert inclusion assumes the current bank size; a much larger bank would need the budget retuned.

## Test plan
- AC-1…AC-5, MNB-2: `draft-jobs.test.ts` › "follows the operator's résumé-strategist instructions…" pins each rule and checks no personal text.
- MNB-1, MNB-3: `tools.test.ts`, `draft-jobs.test.ts` unchanged and green.
- Behavior (manual, real Claude Code + real MCP tools, copy of the live DB, 7 jobs): baseline 4 runs at 0.38–0.54 fill, 0–1 projects; final prompt 14 runs at 0.91–0.99 fill, 2 projects each, none over one page.

## Out of scope
- Making `resume`/`headline`/`summary` required in the published `save_draft` schema; an app-side one-page trim.
