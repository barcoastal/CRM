# Platform Icon Redesign — Playful Illustrated Identity

**Date:** 2026-06-08
**Status:** Approved (direction), implementing in one pass

## Goal
Replace the platform's Salesforce-derived icon system with a single, coherent,
**playful hand-illustrated** icon identity so the CRM looks unique and on-brand
(Coastal Debt: #3052FF blue, Aeonik), not like a Salesforce clone.

## Scope (4 icon families, one shared style)
1. **Object / app-tile icons** (~24 entities + 9 app bundles) — the colored
   square badge icons. Centralized in `src/lib/slds/object-icons.ts`
   (`ENTITY_ICONS` + `iconUrl()`).
2. **UI glyphs** — 61 distinct `lucide-react` icons used across 53 files.
3. **User avatars** — default profile imagery.
4. **Logo + favicon** — `src/app/favicon.ico` + app icons.

## Approach
In-repo Gemini generation pipeline (`scripts/icons/`). API key in `.env.local`
(`GEMINI_API_KEY`, gitignored, CRM-only). Two render targets matched to use:

- **Hero icons** (object tiles, avatars, logo): illustrated PNG via
  `gemini-2.5-flash-image`, generated at 512px transparent background, downscaled
  for retina. Output to `public/icons/custom/`. Swapped centrally via
  `object-icons.ts` (add optional `customSrc`; `iconUrl()` prefers it).
- **UI glyphs** (61): generated as **simplified playful SVG** (Gemini text model)
  so they stay vector, themeable (`currentColor`), and legible at 16px. Output to
  `src/components/icons/glyphs/`. Exposed via one `<Icon name="search" />` wrapper
  that replaces scattered lucide imports through a codemod.

## Consistency strategy
Image generation drifts between calls, so: one locked detailed style prompt + a
style-anchor reference image fed into every hero-icon call; batch generate; then a
normalize pass (uniform padding, transparent bg, brand-color sanity check) and a
contact-sheet review grid at `public/icons/custom/_contact-sheet.html`.

## Style brief (playful illustrated)
Rounded, friendly, slightly chunky line-and-fill illustrations; warm but
professional; Coastal blue #3052FF as the lead accent with soft secondary tints;
soft shadows allowed on hero tiles, none on glyphs; consistent stroke weight;
transparent background; centered with even padding. No text in icons.

## Phases (single pass, no sample gate per user)
- **P1** — all 24 object/app tiles
- **P2** — 61 UI glyphs (SVG) + `<Icon>` wrapper + codemod swap of lucide imports
- **P3** — avatar set (~12 illustrated defaults + initials fallback)
- **P4** — logo + favicon + app-icons
- **P5** — wire-in, full-app visual QA, deploy to `main`

## Risks / notes
- Raster glyphs at 16px look muddy → glyphs generated as SVG, not PNG.
- Cross-icon style drift → anchor image + locked prompt + normalize/review.
- `lucide-react` stays a dependency until P2 codemod fully removes usages.
- Cost: ~85 image calls + 61 text calls on the CRM-only key.
