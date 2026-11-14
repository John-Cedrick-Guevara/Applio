## Feature goal
Put each kind of setting on its own pill tab (Sources, Channels, Guardrails, Connections, Files) instead of one long scrolling page, and share one accessible tabs component with Profile. Every control, validation and save call is unchanged. Roadmap: `docs/features/v5-redesign/v5-redesign-roadmap.md` PR-10. Design: canvas board "v5 · 8 Settings" (https://claude.ai/artifact/3T4Bs69qQWvxy9xKiND79T).

## Acceptance criteria
- [ ] AC-1: The page is headed "My settings", still says "Changes save automatically.", and shows five pill tabs in order: Sources, Channels, Guardrails, Connections, Files. It opens on Sources.
- [ ] AC-2: Sources shows the sources and autonomy list; Channels the apply channels; Guardrails the thresholds, caps, weekly goal and blocklist; Connections the AI engine, Gmail and Telegram; Files the startup switch, the name on documents and the output folder.
- [ ] AC-3: A half-typed field or an open editor survives switching tabs (panels stay mounted; only the chosen one shows).
- [ ] AC-4: The tabs are a labelled tablist: arrow keys, Home and End move and wrap; only the selected tab is in the Tab order; each panel is labelled by its tab. The same component serves Profile.
- [ ] AC-5: Every setting saves, validates and reports errors exactly as before.
- [ ] AC-6: `/settings/:tab` opens that tab, also while the page is already open; choosing a tab puts it in the link (so following a link to the tab you were on still works); an unknown tab in the link is corrected to `/settings`. A tab's panel mounts the first time its tab is opened, so nothing in an unvisited tab loads or probes a connection. Links that point at a setting go to its tab: Raise budget and Edit limits to Guardrails, the engine alert and the Gmail links to Connections, Channel settings to Channels, and the name prompt to Files.

## Must not break
- MNB-1: Secrets still go to the keychain and are never shown again; no setting is saved that the operator did not change (SPEC non-negotiable, CLAUDE.md §3).
- MNB-2: Guardrail rules (auto-send not below the draft bar, monthly not below daily) and the weekly goal range still validate.
- MNB-3: The Profile tabs, their keyboard behaviour and their tests still pass on the shared component.

## Known risks
- Hidden panels are out of the accessibility tree; a link into a setting would land on Sources unless it names the tab, so AC-6 adds the tab route and repoints each such link.

## Test plan
- AC-1: `settings-page.test.tsx` › "shows five pill tabs, opens on Sources, and keeps each section on its own tab", "is headed 'My settings' and still says changes save automatically".
- AC-2: › the same test, plus every existing section test (each now switches to its tab first).
- AC-3: › "keeps a half-typed guardrail while the operator looks at another tab".
- AC-4: `tabs.test.tsx` › four tests (selection, count, arrow/Home/End with labels, tab order); `profile-page.test.tsx` › "moves between tabs with the arrow keys…".
- AC-6: › "opens on the tab named in the link, and falls back to Sources for an unknown one", "follows a link to another settings tab from inside the app", "puts the tab in the link when it is clicked…", "corrects an unknown tab in the link to Settings", "does not probe the connections until the Connections tab is opened"; `tabs.test.tsx` › "mounts a panel only once its tab has been opened, then keeps it"; link targets in `activity-bar.test.tsx`, `dashboard-page.test.tsx`, `review-page.test.tsx`, `applications-page.test.tsx`.
- AC-5, MNB-1, MNB-2: the existing tests in `settings-page.test.tsx`, `guardrails-model.test.ts`, `connections-model.test.ts`.
- MNB-3: `profile-page.test.tsx` (all).

## Out of scope
- The ± steppers for guardrails from the board.
- Usage and the States kit.
