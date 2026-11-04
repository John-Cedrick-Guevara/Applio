## Feature goal
Run the same gate on GitHub that every commit must pass locally (CLAUDE.md §5), so each PR shows pass/fail. Also make the PR template match the layout reviewers use.

## Acceptance criteria
- [ ] AC-1: Every pull request, and every push to `main`, runs `npm ci`, `npm run check` and `npm run build`.
- [ ] AC-2: The PR template has these sections: the stack note, Spec, Checklist (each AC/MNB → its test), Manual checks, What changed, and Left for later.
- [ ] AC-3: The roadmap marks Stage 1 done and says where we are.

## Must not break
- MNB-1: No source, test or config file changes. `npm run check` and `npm run build` still pass locally.

## Known risks
- CI installs on Linux; the Electron binary download is skipped, since CI never launches it.

## Test plan
- AC-1: the CI run on this PR shows the `check` job passing.
- AC-2: manual — open a new PR and see the template.
- AC-3: manual — read the roadmap diff.
- MNB-1: `git diff --stat` touches only `.github/`, `docs/`; local `npm run check && npm run build`.

## Out of scope
- Branch protection rules (a GitHub setting for the owner).
