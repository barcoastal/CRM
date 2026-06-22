# Coastal CRM — Wave Logo & Favicon Redesign

Date: 2026-06-22
Status: Approved

## Goal

Replace the existing forward-chevron brand mark with a "coastal wave" motif,
apply the real logo consistently across the app (it currently uses a 🌊 emoji
in the navbar), and regenerate the favicon / app-icon set from a single source.

## Mark

Three stacked ripple lines (a stylized wave / tide), rounded stroke caps,
colored top to bottom in the established brand blues:

- top:    `#7FB2FF` (light)
- middle: `#5C8DFF` (mid)
- bottom: `#3052FF` (brand blue)

The brand blue stays `#3052FF` so the app theme is unaffected.

## Wordmark

Mark + wordmark lockup, mark to the left of the text:

- "Coastal" in ink `#0D121C`
- " CRM" in brand blue `#3052FF`
- Helvetica Neue / Arial, weight 800, tight letter-spacing

Dark-background variant: "Coastal" white, "CRM" light blue `#7FB2FF`, used in
the navbar (navy `#283044`) and login page.

## App icon

White-tinted 3-line ripples on a blue `#3052FF` rounded square (radius ~22%).

## Favicon legibility

At 16px the 3 thin ripples blur together. Mitigation: a bolder **2-line**
variant of the mark is used only for the 16px favicon entry. All other sizes
(32, 48, 180 apple, 192, 512 PWA) use the standard 3-line mark.

## Files

Create / replace:

- `public/brand/mark.svg`, `public/brand/mark-white.svg`
- `public/brand/coastal-crm.svg` (wordmark, replace), `public/brand/wordmark-white.svg`
- `public/brand/icon-192.png`, `public/brand/icon-512.png` (regenerate)
- `src/app/icon.png`, `src/app/apple-icon.png` (regenerate)
- `src/app/favicon.ico` (multi-size 16/32/48; 16px uses 2-line variant)
- `scripts/gen-brand-assets.mjs` (repeatable generator, replaces the scratch
  `scripts/gen-logo-concepts.mjs`)

UI wiring:

- The live app chrome is `SldsShell` → `src/components/slds/header.tsx`, NOT
  `navbar.tsx`/`dashboard-shell.tsx` (those are dead legacy code, imported
  nowhere). The brand slot is the top-left `.sf-app-badge`.
- `src/components/slds/header.tsx` — replace the placeholder `.sf-app-badge-icon`
  pentagon span with `<img src="/brand/mark-white.svg">`.
- `src/app/globals.css` — `.sf-app-badge` background `#16325c` → brand blue
  `#3052ff` with `border-radius: 8px` so the in-app badge matches the favicon /
  PWA icon; `.sf-app-badge-icon` now just sizes the img.
- `src/app/(auth)/login/page.tsx` — swap `chevron-white.svg` for `mark-white.svg`.
- `src/app/manifest.ts` — unchanged (already points at regenerated icons; theme
  colors `background_color #283044`, `theme_color #3052FF` stay).

Left in place but unused (safe to delete later): `public/brand/chevron.svg`,
`public/brand/chevron-white.svg`, and the dead `navbar.tsx` / `dashboard-shell.tsx`.

Out of scope (separate decision): the `.sf-app-name` text defaults to "Sales
Operations" (an SLDS app-name, not the logo). Left unchanged.

## Out of scope

- Changing the app color theme or brand blue.
- The SLDS chevron utility icons (UI affordances, unrelated to branding).
