## Feature goal
Give every screen the v5 look in one place, before any screen is rebuilt: v5 colour, Plus Jakarta Sans, pill buttons with an ink primary, pastel cards, pill tabs and state chips. Pages keep their layout and behaviour; they pick up the new look through tokens and shared components. Roadmap: `docs/features/v5-redesign/v5-redesign-roadmap.md` PR-1. Design: canvas board "v5 · Style guide" (https://claude.ai/artifact/3T4Bs69qQWvxy9xKiND79T).

Decision (requester, 2026-11-14): where v5 and the v3 foundation spec (`ui-v3-foundation-spec.md` AC-1, AC-2, AC-3) disagree, v5 wins. This spec supersedes those three criteria and `styles.test.ts` is amended to match.

## Acceptance criteria
- [ ] AC-1: The app loads Plus Jakarta Sans 400, 500, 600 and 700 from the installed package, with no network request, and every text element uses it (code and numbers in tables keep tabular figures).
- [ ] AC-2: Colour tokens match the v5 style guide: ink `#141519`, muted `#5E626B`, line `#E7E7E3`, ground `#F5F5F2`, surface `#FFFFFF`, lavender tint/block/mark/ink, pink, ice, and the four status grounds with their ink and dot colours. The page ground shows the 22px dot grid.
- [ ] AC-3: Text sizes come only from 12, 13, 14, 17, 22, 28, 34 and 44px, and none is below 12px, in tokens and hard-coded CSS.
- [ ] AC-4: Buttons are pills: primary (ink fill, white text), secondary (ink outline), small (36px, border `#D9D9D4`), text (underlined), icon (36px circle). Normal buttons are 40px tall. Disabled buttons are grey with `#5E626B` text. `.btn-strong` uses the same ink fill as primary.
- [ ] AC-5: Cards use a 20px radius, 20px padding and a `#E7E7E3` border; tab and filter pills are at least 40px tall pills, ink when selected. (The count bubble arrives with the first screen that shows counts, PR-4.)
- [ ] AC-6: Status chips (`badge-*`) show the v5 status grounds and ink colours; each still carries a word, never colour alone.
- [ ] AC-7: Text on every token pair used for chips, buttons and muted text meets 4.5:1 contrast.
- [ ] AC-8: Focus is visible on every interactive element with a 2px ring in `#5B62D6` offset by 2px; reduced motion still removes transitions and the spinner animation.
- [ ] AC-9: Light shadows stay under 8% opacity.

## Must not break
- MNB-1: No page changes its layout or behaviour; only colours, type, radius and control sizes change.
- MNB-2: Busy buttons still show their delayed spinner, and reduced motion still stops it.
- MNB-3: Every existing page and component test passes unchanged, except the three `styles.test.ts` tests this spec amends.
- MNB-4: The app works offline: no font or style is fetched from the network (SPEC non-negotiable 3, local-first).
- MNB-5: Banners keep readable white-on-fill primary buttons (`chopped UI fixes` tests).

## Known risks
- Pages hard-code sizes (e.g. 16px, 20px, 24px) that the new scale lacks; the test lists each offender and the build maps it to the nearest v5 size. Heights of 40px may make dense tables look looser or tighter; checked by running each page.
- One new dependency, `@fontsource/plus-jakarta-sans`, replaces `@fontsource/ibm-plex-sans`. Offline use needs a bundled font, so a CDN link is not an option.
- Pages that use `--accent` blue for links and selection will turn lavender/ink; any that relied on blue to mean "link" must still look clickable (underline).

## Test plan
- AC-1: `styles.test.ts` › "loads Plus Jakarta Sans 400-700 from the package and sets it as the font"; manual: the built app renders it with the network off.
- AC-2: `styles.test.ts` › "defines the v5 colour tokens" (each hex above) and "paints the dot grid on the page ground".
- AC-3: `styles.test.ts` › "never sets text below 12px" and "keeps text on the v5 scale" (amended from the v3 versions).
- AC-4: `styles.test.ts` › "makes normal buttons 40px and small ones 36px", "gives strong buttons the ink fill of primary ones" (amended), "makes buttons pills"; `components.test.tsx` renders each variant.
- AC-5: `styles.test.ts` › "gives cards a 20px radius and 20px padding", "makes tabs 40px pills".
- AC-6: `job-state.test.tsx` › existing "says the state in words, never by color alone" still passes; `styles.test.ts` › "colours each badge with its v5 ground and ink".
- AC-7: `styles.test.ts` › "keeps chip, button and muted text at 4.5:1" computes the ratio from the tokens.
- AC-8: `styles.test.ts` › "draws a 2px lavender focus ring" and "stops motion under reduced motion".
- AC-9: `styles.test.ts` › "keeps light shadows under 8% opacity" (unchanged).
- MNB-1, MNB-3: the full page and component suites pass; a screenshot of each page before and after is attached to the PR.
- MNB-2: `components.test.tsx` busy-button tests unchanged.
- MNB-4: manual: build, run with the network off; `grep -r "fonts.googleapis" src` is empty.
- MNB-5: the existing `chopped UI fixes` tests, with the token names they check kept.

## Out of scope
- The sidebar rail, logo, activity block and side panel (PR-2).
- Every screen's new layout, including the Dashboard (PR-3 onward).
- The weekly goal setting (Dashboard PR).
- Dark mode.
