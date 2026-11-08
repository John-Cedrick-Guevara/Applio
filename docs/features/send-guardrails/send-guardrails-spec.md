## Feature goal
Guardrails on sending (QA 2026-11-07 #7, #8). A post that tries to steer Applio's AI is flagged, never sent on its own, and shown to the operator plainly. Saved Gmail and Telegram credentials are called Connected only after they actually signed in.

## Acceptance criteria
- AC-1: A free, deterministic check flags posts that tell AI tools to ignore instructions, address AI tools directly, or (for email jobs) ask for applications at another address. Ordinary AI-company posts aren't flagged.
- AC-2: A flagged job is never sent automatically, and Telegram offers it no one-tap Approve. A Telegram approval of one is refused.
- AC-3: A flagged draft shows a red banner. Approving it needs an explicit second confirm. The recipient is always the parsed apply target.
- AC-4: Saving Gmail credentials signs in without sending; Telegram's are checked with a test message. The badge reads **Connected** (with when it was verified), **Can't sign in** (with the reason, fields left open), or **Saved, not verified** (offline or never checked). Never Connected for unchecked credentials.
- AC-5: Every send and test updates the check. A send refused for the password marks Gmail as failing, and Review warns before Approve.

## Must not break
- MNB-1: PR 1's send states and double-send guard.
- MNB-2: Existing autonomy gates and Telegram buttons for ordinary posts.
- MNB-3: The page can't write `checks` (IPC schema rejects it).

## Test plan
- AC-1: `suspicious.test.ts` (QA's injected post, three planted phrasings, three ordinary AI posts, form jobs); `jobs.test.ts` › "flags a stored post that tries to steer AI tools…"
- AC-2: `auto-send.test.ts` › "holds a job when its post looks like it steers AI tools"; `telegram-bot.test.ts` › "leave out one-tap Approve for a suspicious post…"; `send-application.test.ts` › "refuses a Telegram approval…"
- AC-3: `review-page.test.tsx` › "warns in red about a suspicious post and sends it only after an explicit second confirm"; `send-application.test.ts` › "sends to the parsed apply address, never one the post asks for…"
- AC-4: `gmail.test.ts` › verify tests; `backend.test.ts` › "signs in to Gmail when its credentials are saved…", "records a rejected app password…", "records an unreachable Gmail as not verified…", "checks Telegram with a test message…"; `connections-model.test.ts`; `settings-page.test.tsx` › "never shows Connected for a Gmail password that was rejected…", "shows Connected with when it was verified…"
- AC-5: `backend.test.ts` › "marks Gmail as failing when a send is rejected…"; `review-model.test.ts` › `gmailIssue`
- MNB-1/2: full suite. MNB-3: `schemas.test.ts` › "accepts every saved setting…"

## Decisions
- The check is derived from the post text when a job is read, not stored, so older jobs get it with no migration.
- An AI-set flag from scoring is left out for now: the regex check is free and deterministic, and the scoring prompt stays unchanged.
- IMAP sign-in isn't checked separately; it uses the same app password SMTP verifies.

## Out of scope
- Flagging requests for personal data (too many false positives without the AI flag).
