## Feature goal
Use the brand mark (`docs/brand/applio-icon-1024.png`) as the app icon and as the sidebar logo, replacing the drawn placeholder.

## Acceptance criteria
- [ ] AC-1: The sidebar brand shows the brand logo image at 34px, hidden from screen readers (the link keeps its "Applio, home" name).
- [ ] AC-2: The packaged app uses `build/icon.icns`, generated from the brand icon.

## Must not break
- MNB-1: The sidebar link, its collapse behaviour and the CSP (`img-src 'self' data:`) are unchanged.

## Known risks
- The tray icon is still the placeholder (needs a monochrome template image).

## Test plan
- AC-1: `sidebar.test.tsx` › "renders the brand logo image at 34px".
- AC-2: manual: `npm run package`, check `Applio.app/Contents/Resources/icon.icns` and the Dock icon.
- MNB-1: the other `sidebar.test.tsx` tests.

## Out of scope
- Tray icon, dev-mode Dock icon.
