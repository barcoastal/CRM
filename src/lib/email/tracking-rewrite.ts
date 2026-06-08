/**
 * HTML tracking helpers — used by the mass-email sender to instrument
 * each outbound message with an open pixel + click-tracked links.
 *
 * Intentionally NO html parser dep. We use targeted regex:
 *   - <a [..]href="..."> gets the href rewritten to /api/emails/track/<id>/click?u=<base64>
 *   - mailto:/tel: hrefs are skipped (re-emitting unchanged)
 *   - <img> tags are NOT touched (so existing inline images keep working)
 *   - a 1x1 transparent pixel <img> is appended before </body> (or at the end)
 *
 * baseUrl resolution is left to the caller so the same module works in
 * production (NEXTAUTH_URL) and local dev. The caller passes it in.
 */

/** Base64-url encode without padding (URL-safe). */
function b64url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/**
 * Append a tracking pixel right before </body> if present, else at the very end.
 * The pixel is hidden visually but still loaded by most email clients that
 * render remote images.
 */
export function injectTrackingPixel(html: string, trackingId: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const pixelSrc = `${base}/api/emails/track/${encodeURIComponent(trackingId)}/pixel.gif`;
  const pixelTag = `<img src="${pixelSrc}" alt="" width="1" height="1" style="display:block;width:1px;height:1px;border:0;outline:none;text-decoration:none;" />`;
  if (!html) return pixelTag;
  // Case-insensitive match, replace the FIRST </body> close.
  const bodyClose = /<\/body\s*>/i;
  if (bodyClose.test(html)) {
    return html.replace(bodyClose, `${pixelTag}</body>`);
  }
  return `${html}${pixelTag}`;
}

/**
 * Rewrite every <a href="..."> so that clicks first hit our tracking
 * endpoint, which 302s to the original URL. Skips mailto:, tel:, and
 * anchor-only (#...) hrefs.
 */
export function rewriteLinksForTracking(html: string, trackingId: string, baseUrl: string): string {
  if (!html) return html;
  const base = baseUrl.replace(/\/+$/, "");
  const clickBase = `${base}/api/emails/track/${encodeURIComponent(trackingId)}/click`;

  // Match <a ...href="..."> or <a ...href='...'>. Non-greedy on the tag body.
  const anchorRe = /<a\b([^>]*?)href\s*=\s*(["'])([^"']+)\2([^>]*)>/gi;
  return html.replace(anchorRe, (full, pre: string, quote: string, href: string, post: string) => {
    const lower = href.trim().toLowerCase();
    if (
      lower.startsWith("mailto:") ||
      lower.startsWith("tel:") ||
      lower.startsWith("#") ||
      lower.startsWith("{{") // unrendered merge token — leave alone
    ) {
      return full;
    }
    // Only allow http(s) targets through tracking. Other schemes pass through unchanged.
    if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
      return full;
    }
    const tracked = `${clickBase}?u=${b64url(href)}`;
    return `<a${pre}href=${quote}${tracked}${quote}${post}>`;
  });
}

/**
 * Decode a base64-url string previously produced by b64url. Returns null if
 * the decoded value is not a safe http(s) URL.
 */
export function decodeTrackedUrl(token: string): string | null {
  if (!token) return null;
  try {
    const padded = token.replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4;
    const full = pad ? padded + "=".repeat(4 - pad) : padded;
    const decoded = Buffer.from(full, "base64").toString("utf8");
    const lower = decoded.trim().toLowerCase();
    if (!lower.startsWith("http://") && !lower.startsWith("https://")) return null;
    // basic URL parse — throws if malformed
    const u = new URL(decoded);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function getTrackingBaseUrl(): string {
  return process.env.NEXTAUTH_URL ?? "https://crm.coastaldebt-tools.com";
}
