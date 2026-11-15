## Feature goal
Make it quick to fill the fact bank: the operator pastes résumé text, portfolio text or a portfolio link, Claude proposes facts quoted from it, and the operator reviews and adds them. Nothing enters the bank without the operator accepting it (SPEC §1 never invent; F1).

## Acceptance criteria
- [ ] AC-1: Profile › Résumé has an "Add from text or link" box. Pasted text (up to a stated size) or one URL can be submitted; empty or oversize input shows a message and sends nothing.
- [ ] AC-2: Submitting runs one AI extraction through the quota guard and records its token usage. At a hard stop nothing runs and the message says why and what to do next.
- [ ] AC-3: Suggestions come back as a review list grouped by section, each with a kind (Experience, Project, Skills, Other), the section name, and the fact text. Facts are quoted or lightly split from the source; each suggestion shows the source it came from (pasted text or the link).
- [ ] AC-4: For pasted text, any suggestion whose text is not found in the source (ignoring case and whitespace) is discarded and counted, and the count is shown ("2 suggestions dropped: not in your text").
- [ ] AC-5: For a link, Claude reads the page itself. Link import runs only on the Claude Code engine; on the API engine the link field explains it needs Claude Code and offers pasting text instead. Links to LinkedIn, Indeed, JobStreet and Upwork are refused before any call, saying to paste the text instead.
- [ ] AC-6: If a link cannot be read (login wall, empty page, timeout), the operator sees that, with "paste the page's text instead"; no suggestions and no partial writes.
- [ ] AC-7: The operator can edit a suggestion's text, change its section or kind, skip it, add it, or add all remaining. Added facts appear in the bank under the chosen section; a new section is created with the chosen kind. Skills suggestions are added to Skills.
- [ ] AC-8: Suggestions that duplicate an existing fact or skill (ignoring case) are removed from the list, and the message says how many were already in the bank.
- [ ] AC-9: Content in the pasted text or page that tells the AI to do something (change output, call tools, reveal data) has no effect on behavior; the output is schema-validated and malformed output shows a retryable error.
- [ ] AC-10: Adding is idempotent: pressing Add twice or Add all twice adds each fact once.

## Must not break
- MNB-1: PDF/DOCX import and its review list still work as before.
- MNB-2: Every other AI call keeps tools off; only the link import may use a web-read tool, and only for the single pasted URL.
- MNB-3: Secrets and the operator's own Claude Code setup are untouched (Applio's own profile folder is still used).
- MNB-4: Drafts only draw on facts in the bank; adding or skipping suggestions never edits existing facts or drafts.

## Known risks
- Decision (2026-11-15, requester): Claude reads the link itself. This relaxes non-negotiable 6 (web content as data, never reaching a tool-using agent) and the engine's tools-off rule. Mitigations: Claude Code engine only; one read-only web fetch tool and nothing else (no shell, no file write, no MCP tools); platform domains refused; output validated; review step before anything is saved. SPEC §1 and CLAUDE.md need a one-line exception, to be agreed before merge.
- For links, Applio never sees the page, so AC-4's quote check cannot run; the operator review is the only guard against a wrong or invented fact. The UI says so.
- JS-only or blocked portfolios may fail to read (AC-6).
- Long résumés cost more tokens; size limit and the quota guard bound this.

## Test plan
- AC-1: `paste-facts-card.test.tsx`: empty and oversize input show a message and make no API call.
- AC-2: `extract-facts.test.ts` with a fake AI client and fake quota: one call, usage recorded; hard stop makes no call and returns the reason.
- AC-3: `paste-facts-review.test.tsx`: grouped list with kind, section and source.
- AC-4: `extract-facts.test.ts`: a fabricated fact is dropped and counted; whitespace/case differences kept.
- AC-5: `extract-facts.test.ts`: engine without link support rejects; platform URLs refused with no engine call; `claude-code-engine.test.ts`: only the web-read tool is allowed for this call, other calls still tools-off.
- AC-6: `extract-facts.test.ts`: unreadable page returns the error, saves nothing.
- AC-7: `paste-facts-review.test.tsx`: edit, change section/kind, skip, add, add all; `profile-page.test.tsx`: bank and Skills update.
- AC-8: `extract-facts.test.ts`: existing facts and skills filtered, count returned.
- AC-9: `extract-facts.test.ts`: a prompt-injection fixture text yields only schema-valid suggestions; malformed output returns a retryable error.
- AC-10: `profile-service.test.ts`: adding the same suggestion twice stores one fact.
- MNB-1: existing `suggest-facts.test.ts` and import tests pass unchanged.
- MNB-2: `claude-code-engine.test.ts`: default calls still pass tools empty.
- MNB-3: existing engine test asserting `CLAUDE_CONFIG_DIR` stays green.
- MNB-4: `profile-service.test.ts`: accepting suggestions leaves existing facts byte-identical.

## Out of scope
- Following links found inside the portfolio, or crawling a site.
- Scraping platform sites; CAPTCHA handling.
- Auto-adding suggestions without review.
- The fact bank filter (see `fact-bank-filter`).
