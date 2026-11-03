## Feature goal
Put every source, automation level, guardrail, output folder and connection under the operator's control, saved as they change, with credentials kept out of the UI once saved (SPEC F2, F5, F6, F8; prototype screen 6).

## Acceptance criteria
- [ ] AC-1: Sources and autonomy lists each source with an on/off switch, how it is fetched, and Notify / Draft → Approve / Autonomous; changes save immediately; a disabled source's autonomy control is dimmed.
- [ ] AC-2: Autonomous cannot be chosen for Clipped jobs or Upwork (button disabled with an explanation), and the store refuses it too.
- [ ] AC-3: Apply channels show each channel's ceiling (Up to Autonomous for Email and ATS; Up to Draft → Approve for Platform apply and Company career sites); Platform and career sites have an assisted-fill switch labelled Manual handoff / Assisted fill that saves immediately.
- [ ] AC-4: Guardrails (draft score, auto-send score, max applications per channel per day, Claude tokens per day) save on blur and confirm "Saved"; scores must be 0–100, auto-send at least the draft score, the per-day cap a whole number, the token budget above 0 (thousands separators allowed); invalid input shows a message and saves nothing.
- [ ] AC-5: "Never apply to" shows blocked companies with remove buttons; Add company opens an inline field where Enter adds and Escape cancels; duplicates and blanks are ignored.
- [ ] AC-6: Output folder shows the path and folder layout; Change… opens the native picker and saves the choice; Open opens the folder.
- [ ] AC-7: AI engine switches between Claude Code and API key; with API key and no saved key the badge reads "Needs a key"; a key must start with `sk-ant-`; saving stores it in the keychain, clears the field and never shows it again.
- [ ] AC-8: Gmail and Telegram show "Not set up" with their fields until connected, then "Connected" with a summary; secret fields are write-only; the test button reports the result (e.g. "Missing credentials…" or "Test email sent to …").

## Must not break
- MNB-1: No secret value is ever rendered or returned to the page after saving.
- MNB-2: Platform and career-site channels can never be set to send on their own.

## Known risks
- Settings saves per field; two quick edits can race. The last response wins.

## Test plan
- AC-1: `settings-page.test.tsx` — switch off Jobicy, set Remotive autonomous.
- AC-2: `settings-page.test.tsx` disabled button; `mock-api.test.ts` refuses clip autonomous.
- AC-3: `settings-page.test.tsx` — platform assisted fill saved.
- AC-4: `guardrails-model.test.ts` all rules; `settings-page.test.tsx` error then save on blur.
- AC-5: `settings-page.test.tsx` add with Enter, remove; manual Escape and duplicate.
- AC-6: Manual in Electron: Change… (choose and cancel) and Open.
- AC-7: `settings-page.test.tsx` — Needs a key, bad prefix, save clears field and body text lacks the key.
- AC-8: `settings-page.test.tsx` — Gmail test reports missing credentials; manual connected state after saving address and password.
- MNB-1: `settings-page.test.tsx` secret absence assertion; `mock-api.test.ts` secrets test.
- MNB-2: `autonomy.test.ts`; code review of ChannelsSection (no autonomous option for these channels).

## Out of scope
- Real Gmail, Telegram and AI connections (Stage 2).
- Add job (PR-7b).
