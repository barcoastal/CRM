/**
 * Deterministic per-user color picker for the shared calendar overlay.
 *
 * Same userId always returns the same palette slot, so colors are stable
 * across page reloads and across users viewing the same shared calendar.
 *
 * Collisions are possible (palette has 15 entries) but acceptable for a
 * small team. Each color comes with bg/border/text variants tuned for
 * the SLDS-ish surface used by the calendar chips.
 */

const PALETTE = [
  "#3052ff",
  "#1a7d37",
  "#b48c00",
  "#942b00",
  "#5c5c8a",
  "#0070d2",
  "#04844b",
  "#d1a000",
  "#c23934",
  "#7474a8",
  "#16325c",
  "#2db84d",
  "#8a6d00",
  "#a23b66",
  "#5e3a8a",
] as const;

const UNASSIGNED = "#706e6b";

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Pick a stable hex color for a user id. */
export function colorForUser(userId: string | null | undefined): string {
  if (!userId) return UNASSIGNED;
  return PALETTE[hash(userId) % PALETTE.length];
}

export interface OwnerChipColors {
  bg: string;
  border: string;
  text: string;
  dot: string;
}

/**
 * Return chip colors (light tint + stronger border + dark text) derived
 * from the user's stable color. Falls back to a neutral set when no owner.
 */
export function chipColorsForUser(userId: string | null | undefined): OwnerChipColors {
  const base = colorForUser(userId);
  if (!userId) {
    return { bg: "#f3f3f2", border: "#706e6b", text: "#3e3e3c", dot: "#706e6b" };
  }
  return {
    bg: tintHex(base, 0.88),
    border: base,
    text: shadeHex(base, 0.35),
    dot: base,
  };
}

/** Initial letter for the small owner dot. Defaults to "?" when missing. */
export function initialFor(name: string | null | undefined): string {
  if (!name) return "?";
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}

/** Mix hex toward white by `amount` in [0, 1]. */
function tintHex(hex: string, amount: number): string {
  const { r, g, b } = parseHex(hex);
  const nr = Math.round(r + (255 - r) * amount);
  const ng = Math.round(g + (255 - g) * amount);
  const nb = Math.round(b + (255 - b) * amount);
  return toHex(nr, ng, nb);
}

/** Mix hex toward black by `amount` in [0, 1]. */
function shadeHex(hex: string, amount: number): string {
  const { r, g, b } = parseHex(hex);
  const nr = Math.round(r * (1 - amount));
  const ng = Math.round(g * (1 - amount));
  const nb = Math.round(b * (1 - amount));
  return toHex(nr, ng, nb);
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { r, g, b };
}

function toHex(r: number, g: number, b: number): string {
  const pad = (n: number) => n.toString(16).padStart(2, "0");
  return `#${pad(r)}${pad(g)}${pad(b)}`;
}
