/**
 * Mask secret-looking string values in an IntegrationCredential `config` JSON so
 * API responses never return raw tokens/keys/passwords. Values whose KEY matches
 * /token|secret|key|password/i are shown as a short prefix…suffix (or ••• when
 * short). Used by both the list and detail integration routes.
 */
export function maskConfig(cfg: unknown): Record<string, unknown> {
  if (!cfg || typeof cfg !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cfg as Record<string, unknown>)) {
    if (typeof v === "string" && /token|secret|key|password/i.test(k)) {
      out[k] = v.length > 8 ? `${v.slice(0, 4)}…${v.slice(-4)}` : "•••";
    } else {
      out[k] = v;
    }
  }
  return out;
}
