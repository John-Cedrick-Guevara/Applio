# Applio

**A local-first desktop app that finds remote jobs, scores them against your real experience, drafts tailored applications with Claude, and applies through the safest channel — at the autonomy level you choose.**

[![CI](https://github.com/John-Cedrick-Guevara/Applio/actions/workflows/ci.yml/badge.svg)](https://github.com/John-Cedrick-Guevara/Applio/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

<!--
Screenshots: add PNGs under docs/screenshots/ and uncomment.
<p align="center"><img src="docs/screenshots/dashboard.png" alt="Applio dashboard" width="800"></p>
-->

Your data stays on your machine: SQLite plus plain files in a folder you pick. No account, no server, no telemetry.

## Why Applio

- **It never invents.** Resumes, cover letters and form answers are built only from your *fact bank* (your roles, dates, metrics, skills). Every generated claim traces back to a fact.
- **No ban risk.** No scraping of LinkedIn, Indeed, JobStreet or Upwork, no CAPTCHA bypass. Platform-native applies are never autonomous.
- **Free by default.** Public job feeds, your own Claude subscription (or API key), and a quota guard that hard-stops anything before it passes a free limit.
- **You stay in control.** Scans run only when you click. Every automated path has a manual fallback, and every send is logged with exactly what was sent.
- **AI last.** Dedup, a free prefilter and your saved answers run first, so tokens are only spent on plausible matches.

## Features

| | |
|---|---|
| **Profile & fact bank** | Upload a PDF/DOCX resume to seed an editable fact bank, plus an answer bank (salary, notice period, work authorization…) reused before any AI call. |
| **Job discovery** | RemoteOK, Remotive, Himalayas, Jobicy, Arbeitnow, We Work Remotely, Hacker News "Who's Hiring", and Greenhouse / Lever / Ashby / Workable boards for a company watchlist. Add jobs from anywhere else by hand. |
| **Triage** | Cross-source dedup → free prefilter (keywords, remote, salary, timezone, blocklist) → batched AI scoring (0–100, summary, gaps). |
| **Generation** | Tailored resume and cover letter as structured data, rendered to an ATS-safe PDF. |
| **Apply channels** | Email (Gmail SMTP), standard ATS forms (Greenhouse, Lever, Ashby, Workable), assisted fill for platform and custom career sites, and a manual handoff that is always available. |
| **Autonomy levels** | Per source: *Notify only*, *Draft → Approve*, or *Autonomous* (email and ATS channels only), with a minimum score and daily caps. |
| **Brain** | A log of every application: scores, channel, exactly what was sent, status from `found` to `offer`, token cost, and a link to its folder. |
| **Replies & follow-ups** | IMAP reply detection, approval-gated follow-up drafts, and interview prep. |
| **Telegram** | Optional bot for new matches, approvals, replies and quota warnings. |
| **Usage dashboard** | Tokens per run, job and step, with warn and hard-stop limits. |
| **MCP server** | Six small tools (`get_profile`, `get_jobs`, `save_match`, `save_draft`, `get_answers`, `log_event`) so Claude can work with your data without being able to send anything itself. |

### Output folder

Each application gets a folder in a location you choose:

```
<root>/2026-11/Acme — Senior Engineer (87%)/
  resume.pdf
  cover-letter.pdf
  job.md          original posting + AI summary
  sent.md         what was submitted, channel, timestamp, tokens
```

## Getting started

### Requirements

- macOS on Apple silicon for the packaged build. Running from source should work wherever Electron does, but only macOS is tested.
- Node.js (current LTS) and npm
- An AI engine, either:
  - [Claude Code](https://docs.claude.com/en/docs/claude-code) installed and signed in (default; uses your own subscription), or
  - an Anthropic API key
- Optional: a Gmail app password (sending and reply detection) and a Telegram bot token

### Run from source

```bash
git clone https://github.com/John-Cedrick-Guevara/Applio.git
cd Applio
npm install
npm run dev
```

### Build a macOS app

```bash
npm run package   # outputs release/mac-arm64/Applio.app
```

The build is signed ad hoc, not notarized. On first launch, right-click the app and choose **Open**.

### First run

1. Upload your reference resume on **Profile** and review the fact bank it fills.
2. Set your preferences: target roles, minimum salary, timezones, remote-only.
3. Add your AI engine and any optional credentials in **Settings**. Secrets are kept in the OS keychain via Electron `safeStorage`, never in the database.
4. Choose an output folder.
5. Open **Find jobs**, pick sources, and start a scan.

## How it works

```
sources → dedup → prefilter (free) → AI scoring (batched) → review → draft → apply
                                                                    ↑ you decide here
```

Applio shells out to headless Claude Code (or uses the API) for scoring and drafting. Sending, form filling and PDF rendering happen inside the app, never through the model.

Job postings, emails and web pages are treated strictly as data. Their content is never allowed to change what the app does.

## Project layout

```
src/
  main/       Electron main process (wiring only)
  preload/    typed contextBridge API
  renderer/   React UI, talks to main over IPC
  core/       pure domain logic (jobs, triage, generation, apply, quota…)
  infra/      adapters: db, sources, ai, email, telegram, pdf, browser
  mcp/        local MCP server
  shared/     types and zod schemas
```

Dependencies point inward: `core/` never imports from `infra/`, `main/` or `renderer/`. The full product definition is in [SPEC.md](SPEC.md); engineering conventions are in [CLAUDE.md](CLAUDE.md).

## Development

```bash
npm run check      # typecheck + lint + tests
npm test           # vitest
npm run test:watch
npm run e2e        # Electron end-to-end run
```

Development is test-driven, and source adapters are tested against recorded fixtures, so tests never hit live APIs.

## Contributing

Issues and PRs are welcome. Before a feature PR, read [SPEC.md](SPEC.md) and write a short spec under `docs/features/<slug>/` with acceptance criteria. Keep PRs to one purpose and roughly 1,000 changed lines. See [CLAUDE.md](CLAUDE.md) for the commit format and testing rules.

New job source? It is one file in `src/infra/sources/` behind the `JobSource` interface.

## Responsible use

Applio automates your own applications, not other people's. Respect each job board's terms and rate limits, and review what it drafts before it goes out. You are responsible for what you send.

## License

[MIT](LICENSE)
