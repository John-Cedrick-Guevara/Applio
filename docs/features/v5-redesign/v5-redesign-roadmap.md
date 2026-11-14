# v5 Redesign — Roadmap

One PR per screen, in order. Each PR is spec'd, built test-first, run for real, reviewed against its spec with `/review-pr`, and merged before the next starts. Design: canvas rows "v5" (https://claude.ai/artifact/3T4Bs69qQWvxy9xKiND79T). Gate and must-not-break items are the same as `docs/features/redesign-v2/redesign-v2-roadmap.md`.

Decisions: v5 wins over the v3 size rules (40px buttons, v5 type scale). A weekly goal setting is added with the Dashboard.

- [ ] **PR-1 — Foundation** `feat/v5-foundation` — `feat(ui): add v5 tokens, Plus Jakarta Sans and restyled shared components`. Why: every screen inherits the look from one place. Spec: `docs/features/v5-foundation/`.
- [ ] **PR-2 — Shell** `feat/v5-shell` — `feat(ui): add collapsible rail, new logo, activity block and side panel`. Why: lists open details in a side panel, so the primitive lands before screens. Replaces the top activity bar. Canvas: Logo and sidebar.
- [ ] **PR-3 — Dashboard** `feat/v5-dashboard` — `feat(ui): add dashboard home with needs-you, weekly goal, budget and pipeline`. Adds the weekly goal setting. Canvas: 1 Dashboard.
- [ ] **PR-4 — Inbox** `feat/v5-inbox` — list full width, decision in the side panel. Canvas: 2.
- [ ] **PR-5 — Applications** `feat/v5-applications` — list plus side panel. Canvas: 3.
- [ ] **PR-6 — Matches** `feat/v5-matches` — sort, then draft. Canvas: 4.
- [ ] **PR-7 — Get jobs** `feat/v5-get-jobs` — scan or paste. Canvas: 5.
- [ ] **PR-8 — Hand-off** `feat/v5-handoff` — you apply. Canvas: 6.
- [ ] **PR-9 — Profile** `feat/v5-profile` — fact bank. Canvas: 7.
- [ ] **PR-10 — Settings** `feat/v5-settings` — Canvas: 8.
- [ ] **PR-11 — Usage and limits** `feat/v5-usage` — Canvas: 9.
- [ ] **PR-12 — States kit pass** `feat/v5-states` — every wait follows the loading rules. Canvas: States kit.
