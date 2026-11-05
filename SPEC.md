# Applio — Feature Spec (locked 2026-11-02)

Local-first desktop app that finds remote international jobs, scores them against your real
experience, generates tailored resumes/cover letters with Claude, and applies through the
safest available channel — at the autonomy level you choose.

Status: personal tool first, open source once polished.

---

## 1. Principles

1. **Free-only.** Every default source and service runs on free tiers. Nothing exceeds a free limit without the operator raising a cap.
2. **Never invent.** AI may only select, reorder, and rephrase facts from the fact bank.
3. **No ban risk by default.** No scraping of LinkedIn/Indeed/JobStreet/Upwork. Platform-native apply is never autonomous.
4. **Operator stays in control.** Every automated path has a manual fallback; every send is logged.
5. **Spend tokens only where they matter.** Free filtering first, AI last.

## 2. Stack

| Piece | Choice |
|---|---|
| App shell | Electron (tray mode, launch at login) |
| AI engine (default) | Headless Claude Code (`claude -p --output-format stream-json --strict-mcp-config`) using the operator's own subscription |
| AI engine (fallback) | Anthropic API key (BYOK), same interface |
| AI ↔ app bridge | Local MCP server, 5–6 tools only |
| Storage | SQLite + files in operator-chosen folder |
| Email | Gmail via app password (IMAP for replies, SMTP for sending) |
| Notifications | Telegram bot (long polling, no server). Discord later |
| PDF | Electron `printToPDF` from one HTML template |

## 3. Features

### F1. Profile, fact bank, answer bank
- Upload a **reference resume** (PDF/DOCX): it fills the fact bank on first run and sets the style reference.
- **Fact bank:** roles, dates, metrics, skills, projects, links. Editable. It is the only source the AI may draw facts from.
- **Answer bank:** saved answers to form questions (salary, notice period, work authorization, "why us" patterns). Reused before calling the AI.
- **Preferences:** target roles, seniority, min salary, timezones, remote-only, full-time / contract / freelance.

### F2. Discovery (scheduler, every 4–6h, catches up after sleep)
| Source | Access |
|---|---|
| RemoteOK, Remotive, Himalayas, Jobicy, Arbeitnow, WeWorkRemotely | Public JSON / RSS (polite polling + attribution) |
| Greenhouse, Lever, Ashby, Workable | Public board JSON for a company watchlist |
| HN "Who's Hiring" | Algolia HN API, monthly thread parsed by AI |
| Upwork | Official GraphQL API (key needs approval; Clip button is the fallback) |
| LinkedIn, Indeed, JobStreet, Facebook, anything else | **Clip button**: operator browses, clicks, job enters the pipeline |
| JSearch | Optional, off by default (free tier ~200 calls/mo) |

### F3. Triage pipeline
1. **Dedup** across sources (company + normalized title; boards each give their own URL, so the apply URL can't be part of the key).
2. **Free prefilter** (no AI): role keywords, remote, salary, timezone, blocklist. Target: drop 80–90%.
3. **AI scoring** (batched): match score 0–100, role summary, job description summary, gaps.
4. Jobs above the threshold go to generation.

### F4. Generation
- Tailored resume as structured data → one ATS-safe template → PDF.
- Cover letter, or Upwork proposal for freelance jobs.
- Both must cite only fact-bank entries.

### F5. Apply channels (detected from the apply URL / posting)
| # | Channel | Detection | Behavior | Max autonomy |
|---|---|---|---|---|
| 1 | Email | `mailto:` or email in posting | Send cover letter + PDF via Gmail SMTP | Autonomous |
| 2 | Standard ATS form | greenhouse / lever / ashby / workable domains | In-app browser fills the form, uploads, submits. CAPTCHA → hand off to operator | Autonomous |
| 3 | Platform in-app apply | LinkedIn Easy Apply, Indeed, JobStreet, Upwork | **Optional assisted fill (toggle, off by default).** On: in-app browser with operator's session pre-fills, operator clicks Submit. Off: **manual handoff** | Draft → Approve |
| 4 | Custom career site | Workday, iCIMS, others | Assisted fill (best effort) or manual handoff | Draft → Approve |

**Manual handoff** (always available, any channel): the app opens the job link and shows the resume, cover letter, and suggested answers ready to copy. The operator applies themselves, then clicks **Mark as applied** to log it.

Upwork never runs autonomously: proposals cost Connects, and the Connects cost is shown before submit.

### F6. Autonomy levels (set per source, capped per channel)
- **Notify only:** match is surfaced, nothing is generated.
- **Draft → Approve:** everything is prepared, operator approves (in app or Telegram).
- **Autonomous:** sends automatically if score ≥ threshold, only on channels 1–2.

Guardrails: min score, max applications/day per channel, company blocklist, cross-platform dedup, AI budget cap (F10).

### F7. Brain (application log)
Per application: role summary, job description summary, match score, channel, **exactly what was sent**, timestamp, status, token cost, folder link.
- Status flow: `found → scored → drafted → approved → applied → replied → interview → offer / rejected / ghosted`
- **Reply detection:** IMAP watcher matches inbox replies to applications.
- **Follow-up drafts** after N days without a reply (always approval-gated).
- **Interview prep:** generated from the job, what was sent, and the company.

### F8. Output folder
Operator chooses a root folder. Layout:
```
<root>/YYYY-MM/<Company> — <Role> (<score>%)/
  resume.pdf
  cover-letter.pdf      (or proposal.md)
  job.md                original posting + AI summary
  sent.md               what was submitted, channel, timestamp, tokens
```
Each brain entry has an "Open folder" button. Folders re-link by job ID if renamed or moved.

### F9. Telegram notifications
New matches ≥ threshold, drafts awaiting approval (inline Approve / Open / Skip), HR replies, follow-ups due, quota warnings.

### F10. Usage dashboard + free-limit guard
- Tokens per run, job, step (score / generate / answers), day, month — from Claude Code's JSON usage output.
- Quota table (editable defaults):

| Resource | Default | Warn | Hard stop |
|---|---|---|---|
| Claude tokens | operator-set daily / monthly budget | 80% | 100% → AI pauses |
| Gmail sends | 100/day (Gmail allows ~500) | 80% | 100% |
| Board APIs | polls/day per source | — | skip source until tomorrow |
| Upwork API | its rate limit | 80% | 100% |
| JSearch (opt.) | 200/month | 80% | 100% |

Warnings go to the dashboard and Telegram. Nothing runs past a hard stop until the operator raises the cap.

## 4. MCP tools exposed to Claude
`get_profile`, `get_jobs`, `save_match`, `save_draft`, `get_answers`, `log_event`.
Kept minimal so tool definitions cost few tokens. Sending, filling forms, and PDF rendering happen in the app, not via Claude.

## 5. Out of scope (v1)
Discord, mobile app, multiple resume templates, Gmail OAuth, scraping of any platform, autonomous platform-native apply, CAPTCHA bypass.

## 6. Open risks to verify in prototype spikes
- Upwork API key approval for a personal tool; whether proposals can be submitted via the API.
- Real token cost per application (target: 20–40 tailored apps/day within a Pro/Max plan).
- Exact free-tier terms of each remote board (rate limits, attribution).
- CAPTCHA frequency on Greenhouse / Lever forms.
- Anthropic terms for headless Claude Code invoked by a desktop app (BYOK fallback ready).
