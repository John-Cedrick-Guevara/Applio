## Feature goal
Give every page the same frame and look from the prototype, so page PRs only add content: sidebar navigation, the engine status card, and consistent loading and error states.

## Acceptance criteria
- [ ] AC-1: The app uses the prototype's design: IBM Plex Sans/Mono loaded from the app bundle (works offline), its colors, 40px controls, 12px card radii, light theme.
- [ ] AC-2: The sidebar shows the logo, an Add job button and nav items with icons; the current page's item is highlighted; nested paths (e.g. `/review/j1`) keep their parent highlighted. It lists only pages that exist, so this PR ships it empty and each page PR adds its item.
- [ ] AC-3: The sidebar engine card shows engine name and state (Ready / Paused / Needs a key), next run time, and tokens used today against the budget with a meter.
- [ ] AC-4: Routes use the URL hash; back/forward work; an unknown path redirects to the default page; pages load lazily.
- [ ] AC-5: While data loads, a skeleton is shown; on failure, an error state with a working Retry appears; during a refresh, existing data stays on screen.
- [ ] AC-6: At 375px width the sidebar collapses to a top bar and the page has no horizontal scroll.
- [ ] AC-7: Interactive controls are keyboard reachable with a visible focus ring.

## Must not break
- MNB-1: Content-Security-Policy allows only same-origin scripts, styles, fonts and images.

## Known risks
- The engine card refreshes on navigation only until main can push status (PR-13).
- Light theme only, per the prototype; dark mode is a later decision.

## Test plan
- AC-1: Manual visual comparison with the prototype; offline check with network disabled.
- AC-2: Manual in this PR: logo, Add job and engine card render with no nav items; each page PR verifies its own item and highlighting.
- AC-3: Manual against mock status; pause automation and see Paused.
- AC-4: `router.test.ts` (static, params, decoding, trailing slash, mismatch); manual back/forward and an unknown hash.
- AC-5: `components.test.tsx` AsyncView cases (loading, error + retry, data during refresh).
- AC-6: Manual at 375px: `document.documentElement.scrollWidth <= innerWidth`.
- AC-7: Manual Tab-through of the sidebar and an error state's Retry button; focus ring visible on each.
- MNB-1: Review the CSP meta in `index.html`; the built app loads with no CSP console errors.

## Out of scope
- Page content (PR-4a onward), and components or styles first used by a page (they land with that page).
- Routing, data hooks and toasts (PR-3a).
- Dark mode.
