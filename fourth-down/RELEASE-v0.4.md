# Fourth Down v0.4

Light-first appearance: warm off-white page, white cards, stadium navy hero and methodology, championship gold accents. Light/Dark buttons expose pressed state and persist independently from the existing colorway preference. Without storage, light remains the default and controls still work.

All three colorways have separate readable text and fill colors for both appearances. Mobile controls wrap, source availability messages remain visible, cards share consistent styling, and desktop score filters stay visible during long scoreboards.

Data integrity:
- AP, Coaches and CFP retain independent editions. Missing sources never borrow another poll; outlook input remains independent from the ranking selector.
- Future-dated/invalid publication dates are rejected, and date-only publication strings retain their calendar date across timezones.
- Fetch labels include calendar date and timezone; fetch time is distinguished from provider update time. The API still uses 60-second upstream caching and a maximum 120-second stale-while-revalidate window.
- Malformed feed envelopes degrade like upstream failures. Partial ranking outages are explicit, complete outages return a clean 503, and failed refreshes retain the last successful snapshot with a warning.
- Request cancellation now recovers correctly on remount, including React development strict mode.
- Bracket and poll-position tiers remain unofficial illustrations. No invented scores, odds, or probabilities.

Validation commands (Node 22.6+):

```sh
npm ci
npm test
npm run lint
npm run build
npm run typecheck
npx playwright install chromium
npm start -- --port 3001
# In another terminal:
TEST_URL=http://localhost:3001 npm run test:browser
```

Browser regression checks cover six appearance/colorway combinations with axe WCAG AA scans, persisted appearance and colorway, independent ranking selection, comparison, bracket labels, 320/390px overflow, and total-outage/refresh recovery. Requires the live provider to return AP rankings and no CFP edition for the missing-source check (pre-November 2026).

The official 2026 selection rules and first-ranking release date were checked against the linked CFP pages on October 18, 2026. ESPN public feeds can lag or revise results; this app cannot guarantee provider freshness or availability.

## Branded Home Screen icons

Gold/navy 4TH favicon (16/32/48px ICO plus SVG and PNG), opaque Apple touch icons (152/167/180px), and Android manifest icons (192/512px plus a maskable 512px icon). Manifest name and Apple Home Screen title are Fourth Down. Standalone launch stays scoped to the existing production origin. Theme chrome is stadium navy and the launch background is warm off-white. No offline cache or service worker is introduced for live data.

Edit `public/icons/fourth-down.svg` and run `node scripts/generate-icons.mjs` to regenerate the raster assets. `npm test` verifies icon dimensions, favicon frames, manifest identity and icon references. On devices that already saved the previous generic shortcut, remove and add it again if the OS retains its cached icon.
