/**
 * @mention parsing for Chatter posts.
 *
 * Token format (produced by the frontend picker): @[<userId>:<display name>]
 *
 * Why a token (and not raw "@Name")? Multiple users can share the same display
 * name, so we attach the userId at insert time. The textarea visually renders
 * each token as a soft blue chip, but the underlying string stored in the
 * database keeps the unambiguous @[id:name] form.
 *
 * Example body stored in DB:
 *   "Heads up @[u_abc:Bar Elezra], please look at this lead."
 *
 * Functions:
 *  - extractMentions(body)  -> structured matches (used to compute mention IDs)
 *  - renderPlain(body)      -> "Heads up @Bar Elezra, please look at this lead."
 *  - renderHtml(body)       -> "Heads up <a href='/settings/users/u_abc' class='chatter-mention'>@Bar Elezra</a>, please look at this lead."
 *    (all non-mention text is HTML-escaped, line breaks become <br/>)
 */

export type MentionMatch = {
  userId: string;
  name: string;
  start: number;
  end: number;
  raw: string;
};

// Match @[id:name] where id can be cuids (alphanumeric) and name can contain
// anything except a closing bracket. Bracket may contain spaces/dots/commas.
const MENTION_RE = /@\[([a-zA-Z0-9_-]+):([^\]]+)\]/g;

export function extractMentions(body: string): MentionMatch[] {
  if (!body) return [];
  const out: MentionMatch[] = [];
  // reset lastIndex because regex has the /g flag and is module-scoped
  MENTION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MENTION_RE.exec(body)) !== null) {
    out.push({
      userId: m[1],
      name: m[2],
      start: m.index,
      end: m.index + m[0].length,
      raw: m[0],
    });
  }
  return out;
}

export function renderPlain(body: string): string {
  if (!body) return "";
  return body.replace(MENTION_RE, (_full, _id, name) => `@${name}`);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Render to HTML. All non-mention text is escaped; line breaks become <br/>.
 * Mentions become anchors to /settings/users/<id>.
 */
export function renderHtml(body: string): string {
  if (!body) return "";
  const matches = extractMentions(body);
  if (matches.length === 0) {
    return escapeHtml(body).replace(/\n/g, "<br/>");
  }

  let out = "";
  let cursor = 0;
  for (const m of matches) {
    if (m.start > cursor) {
      out += escapeHtml(body.slice(cursor, m.start)).replace(/\n/g, "<br/>");
    }
    const safeId = escapeHtml(m.userId);
    const safeName = escapeHtml(m.name);
    out += `<a href="/settings/users/${safeId}" class="chatter-mention">@${safeName}</a>`;
    cursor = m.end;
  }
  if (cursor < body.length) {
    out += escapeHtml(body.slice(cursor)).replace(/\n/g, "<br/>");
  }
  return out;
}

/** Unique list of user IDs from mentions in body. */
export function extractMentionIds(body: string): string[] {
  const ids = new Set<string>();
  for (const m of extractMentions(body)) ids.add(m.userId);
  return Array.from(ids);
}
