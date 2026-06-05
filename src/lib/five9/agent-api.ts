/**
 * Five9 AgentREST API client.
 *
 * Different from the SOAP AdminWebService (admin-api.ts) — AgentREST is
 * authenticated per-agent and operates against the agent's own session.
 *
 * Each agent has Five9 credentials (User.five9Username / .five9PasswordEnc).
 * We log them in on demand, cache the session token in process memory + a
 * Cookie-style header, and use it for click-to-dial / state changes.
 *
 * Reference: Five9 Agent REST API
 *   POST /appsvcs/rs/svc/auth/login         — login
 *   POST /appsvcs/rs/svc/agents/{userId}/session_start — start session
 *   PUT  /appsvcs/rs/svc/agents/{userId}/state — change ready state
 *   POST /appsvcs/rs/svc/agents/{userId}/interactions/make_call — click-to-dial
 *   POST /appsvcs/rs/svc/auth/logout
 *
 * The actual endpoint host is returned in the login response (
 * `metadata.dataCenters[0].apiUrls[0]`) so we discover it dynamically.
 */

import { prisma } from "@/lib/prisma";
import crypto from "node:crypto";

/** Build the session_start body for a station type. PSTN/STATION carry the
 * stationId (PSTN = the agent's phone number); EMPTY/SOFTPHONE/unknown send
 * an empty station. Confirmed against the live Five9 client (Task 1 spike). */
export function buildSessionStartBody(
  stationType: "EMPTY" | "SOFTPHONE" | "STATION" | "PSTN",
  stationId: string,
): { stationId: string; stationType: string } {
  switch (stationType) {
    case "PSTN":
      return { stationId, stationType: "PSTN" };
    case "STATION":
      return { stationId, stationType: "STATION" };
    default:
      return { stationId: "", stationType: "EMPTY" };
  }
}

interface Five9Url {
  host: string;
  port: number | string;
  version: string;
  routeKey: string;
}
interface Five9LoginResponse {
  tokenId: string;
  userId: string;
  orgId: string;
  context?: { farmId?: string };
  metadata: {
    dataCenters: Array<{
      name: string;
      active?: boolean;
      apiUrls: Five9Url[];
      loginUrls?: Five9Url[];
    }>;
  };
}

/**
 * One stored cookie with enough scope info to act like a browser cookie jar.
 * `domain` is the Domain attribute (leading dot stripped) or null for a
 * host-only cookie; `host` is the host that set it. This lets us avoid
 * replaying app.five9.com host-only cookies (BIGipServer/TS…) to the data
 * center, which Five9 rejects with 401 "User is not logged in".
 */
interface StoredCookie {
  name: string;
  value: string;
  domain: string | null;
  host: string;
}

interface AgentSession {
  tokenId: string;
  apiHost: string;
  farmId: string | null; // numeric farm id from context (e.g. "252")
  userId: string;
  orgId: string;
  cookies: StoredCookie[]; // jar of login + data-center cookies, scoped by host/domain
  cachedAt: number;
}

const sessionCache = new Map<string, AgentSession>();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min

/** Persist the session to the DB so other Railway instances see it. */
async function persistSession(userId: string, s: AgentSession): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      five9SessionJson: JSON.stringify(s),
      five9SessionAt: new Date(s.cachedAt),
    },
  });
}

/** Load a previously-persisted session from the DB (if still fresh). */
async function loadPersistedSession(userId: string): Promise<AgentSession | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { five9SessionJson: true, five9SessionAt: true },
  });
  if (!u?.five9SessionJson || !u.five9SessionAt) return null;
  const age = Date.now() - u.five9SessionAt.getTime();
  if (age > SESSION_TTL_MS) return null;
  try {
    return JSON.parse(u.five9SessionJson) as AgentSession;
  } catch {
    return null;
  }
}

async function clearPersistedSession(userId: string): Promise<void> {
  await prisma.user
    .update({
      where: { id: userId },
      data: { five9SessionJson: null, five9SessionAt: null },
    })
    .catch(() => undefined);
}

function getEncryptionKey(): Buffer {
  const raw = process.env.FIVE9_AGENT_KEY;
  if (!raw) throw new Error("FIVE9_AGENT_KEY env var not set");
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptPassword(plain: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptPassword(stored: string): string {
  const [ivB64, tagB64, encB64] = stored.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const enc = Buffer.from(encB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

function loginBase(): string {
  return process.env.FIVE9_AGENT_LOGIN_URL ?? "https://app.five9.com/appsvcs/rs/svc";
}

/** Get the raw Set-Cookie strings from a Response across runtimes. */
function getSetCookieList(res: Response): string[] {
  const getter = (res.headers as { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getter === "function") return getter.call(res.headers);
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

/** Parse a response's Set-Cookie headers into scoped StoredCookies. */
export function parseSetCookies(res: Response, requestHost: string): StoredCookie[] {
  const host = requestHost.toLowerCase();
  const out: StoredCookie[] = [];
  for (const raw of getSetCookieList(res)) {
    const parts = raw.split(";");
    const first = parts[0]?.trim();
    if (!first) continue;
    const eq = first.indexOf("=");
    if (eq < 0) continue;
    const name = first.slice(0, eq).trim();
    if (!name) continue;
    const value = first.slice(eq + 1).trim();
    let domain: string | null = null;
    for (const attr of parts.slice(1)) {
      const eqi = attr.indexOf("=");
      if (eqi < 0) continue;
      if (attr.slice(0, eqi).trim().toLowerCase() === "domain") {
        domain = attr.slice(eqi + 1).trim().replace(/^\./, "").toLowerCase() || null;
      }
    }
    out.push({ name, value, domain, host });
  }
  return out;
}

/** Merge new cookies into a jar, upserting by name + scope (newer wins). */
export function mergeCookies(existing: StoredCookie[], incoming: StoredCookie[]): StoredCookie[] {
  const map = new Map<string, StoredCookie>();
  for (const c of [...existing, ...incoming]) map.set(`${c.name}|${c.domain ?? c.host}`, c);
  return [...map.values()];
}

/**
 * Build a `Cookie:` header containing only the cookies a browser jar would
 * send to `targetHost` — Domain cookies whose domain matches, plus host-only
 * cookies set by that exact host. This is what keeps the app.five9.com
 * BIGipServer/TS cookies out of data-center requests.
 */
export function cookieHeaderFor(cookies: StoredCookie[], targetHost: string): string {
  const host = targetHost.toLowerCase();
  const seen = new Set<string>();
  const pairs: string[] = [];
  for (const c of cookies) {
    const matches = c.domain
      ? host === c.domain || host.endsWith(`.${c.domain}`)
      : host === c.host;
    if (!matches || seen.has(c.name)) continue;
    seen.add(c.name);
    pairs.push(`${c.name}=${c.value}`);
  }
  return pairs.join("; ");
}

/** Hostname (no port) for a base URL like https://app-atl.five9.com:443/... */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

async function doLogin(base: string, username: string, password: string): Promise<{ res: Response; json: Five9LoginResponse }> {
  const res = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/plain" },
    body: JSON.stringify({ passwordCredentials: { username, password }, policy: "ForceIn" }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Five9 login ${res.status}: ${text.slice(0, 500)}`);
  }
  const json = (await res.json()) as Five9LoginResponse;
  return { res, json };
}

async function loginAgent(username: string, password: string): Promise<AgentSession> {
  // Single login on app.five9.com. Its cookies (apiRouteKey routes to the DC's
  // API pool, plus the session cookies) work directly against the data-center
  // host — verified end-to-end (login_state → session_start → WORKING). Do NOT
  // re-login on the DC host: that produces a session login_state rejects.
  const { res, json } = await doLogin(loginBase(), username, password);
  const dc =
    json.metadata?.dataCenters?.find((d) => d.active) ??
    json.metadata?.dataCenters?.[0];
  const apiUrl = dc?.apiUrls?.[0];
  if (!apiUrl) throw new Error("Five9 login returned no data center URL");
  const apiHost = `https://${apiUrl.host}:${apiUrl.port}/appsvcs/rs/svc`;

  return {
    tokenId: json.tokenId,
    apiHost,
    farmId: json.context?.farmId ?? null,
    userId: json.userId,
    orgId: json.orgId,
    cookies: parseSetCookies(res, hostOf(loginBase())),
    cachedAt: Date.now(),
  };
}

/** Test if the stored credentials work — does a login then immediate logout. */
export async function testCredentials(username: string, password: string): Promise<{ ok: boolean; error?: string; apiHost?: string }> {
  try {
    const session = await loginAgent(username, password);
    await fetch(`${session.apiHost}/auth/logout`, {
      method: "POST",
      headers: { Cookie: cookieHeaderFor(session.cookies, hostOf(session.apiHost)) },
    }).catch(() => undefined);
    return { ok: true, apiHost: session.apiHost };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "login failed" };
  }
}

/** Sentinel thrown when a read-only call finds no live session and must NOT log in. */
export const NO_SESSION = "NO_FIVE9_SESSION";

/**
 * @param createIfMissing when false (background polls), NEVER log in — just
 * return the existing session or throw NO_SESSION. Logging in on every poll
 * causes ForceIn logins to invalidate each other every few seconds → endless
 * "User is not logged in". Only explicit actions (Start Session, click-to-dial)
 * may create a session.
 */
async function getSession(userId: string, createIfMissing = true): Promise<AgentSession> {
  // 1. Process-local cache (fastest path on the same Railway pod)
  const cached = sessionCache.get(userId);
  if (cached && Date.now() - cached.cachedAt < SESSION_TTL_MS) return cached;

  // 2. DB-backed cache (shared across Railway pods so a session_start on
  //    one pod is visible to a click_to_dial on another pod)
  const persisted = await loadPersistedSession(userId);
  if (persisted) {
    sessionCache.set(userId, persisted);
    return persisted;
  }

  if (!createIfMissing) throw new Error(NO_SESSION);

  // 3. Fresh login
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { five9Username: true, five9PasswordEnc: true },
  });
  if (!user?.five9Username || !user.five9PasswordEnc) {
    throw new Error("Agent has no Five9 credentials configured");
  }
  const password = decryptPassword(user.five9PasswordEnc);
  const session = await loginAgent(user.five9Username, password);
  sessionCache.set(userId, session);
  await persistSession(userId, session).catch(() => undefined);
  return session;
}

async function agentFetch(
  userId: string,
  path: string,
  init: RequestInit = {},
  ensureLogin = true,
): Promise<Response> {
  return agentFetchInternal(userId, path, init, /* allowMigrationRetry */ true, ensureLogin);
}

async function agentFetchInternal(
  userId: string,
  path: string,
  init: RequestInit,
  allowMigrationRetry: boolean,
  ensureLogin = true,
): Promise<Response> {
  const session = await getSession(userId, ensureLogin);
  const host = hostOf(session.apiHost);
  const url = `${session.apiHost}/agents/${session.userId}${path}`;
  // Match the official Five9 Agent Desktop EXACTLY (captured from its live,
  // working requests via Playwright): authenticate by session COOKIES only.
  // The official client sends NO Authorization header — sending
  // `Authorization: Bearer-<token>` is what triggers 401 "User is not logged
  // in". It includes a lowercase `farmid` header + `x-requested-with`, and
  // only sets Content-Type when there's a body.
  const headers: Record<string, string> = {
    Accept: "application/json, text/javascript, */*; q=0.01",
    "X-Requested-With": "XMLHttpRequest",
  };
  const cookieHeader = cookieHeaderFor(session.cookies, host);
  if (cookieHeader) headers.Cookie = cookieHeader;
  if (session.farmId) headers.farmid = session.farmId;
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(url, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });

  // Accumulate any cookies the data center set (e.g. its own affinity cookie)
  // so the next call in the login state machine carries them.
  const fresh = parseSetCookies(res, host);
  if (fresh.length) {
    session.cookies = mergeCookies(session.cookies, fresh);
    sessionCache.set(userId, session);
  }

  if (res.ok || !allowMigrationRetry) return res;

  const text = await res.clone().text();

  // Stale / invalidated session: the cached or DB-persisted session token is
  // dead (e.g. a later ForceIn login elsewhere kicked it out, or it expired
  // server-side). Five9 answers 401 "User is not logged in". Clear it and
  // retry ONCE with a guaranteed-fresh login — but ONLY for explicit actions.
  // Background polls (ensureLogin=false) must never trigger a login, or they
  // re-create the ForceIn churn this whole change exists to prevent.
  if (ensureLogin && res.status === 401 && (text.includes("not logged in") || text.includes('"errorCode":401'))) {
    sessionCache.delete(userId);
    await clearPersistedSession(userId);
    return agentFetchInternal(userId, path, init, false);
  }

  // 5001 "service migrated" — retry against the farmId Five9 returned.
  try {
    const parsed = JSON.parse(text) as {
      five9ExceptionDetail?: { errorCode?: number; context?: { farmId?: string } };
    };
    const errorCode = parsed.five9ExceptionDetail?.errorCode;
    const newFarmId = parsed.five9ExceptionDetail?.context?.farmId;
    if (errorCode === 5001 && newFarmId) {
      sessionCache.set(userId, { ...session, farmId: newFarmId });
      return agentFetchInternal(userId, path, init, false);
    }
  } catch {
    // not JSON, ignore
  }
  return res;
}

/** Get the session start configuration — tells us which stationTypes the agent can use. */
export async function getSessionStartConfig(userId: string): Promise<{
  stationTypes: string[];
  defaultStationId?: string;
}> {
  const res = await agentFetch(userId, `/session_start/config`);
  if (!res.ok) {
    // Different Five9 versions use different paths; try alternates
    const alt1 = await agentFetch(userId, `/session_start_config`);
    if (alt1.ok) return (await alt1.json()) as { stationTypes: string[]; defaultStationId?: string };
    const alt2 = await agentFetch(userId, `/sessionStartConfig`);
    if (alt2.ok) return (await alt2.json()) as { stationTypes: string[]; defaultStationId?: string };
    // Fall back to the static list
    return { stationTypes: ["EMPTY", "SOFTPHONE", "STATION"] };
  }
  return (await res.json()) as { stationTypes: string[]; defaultStationId?: string };
}

/**
 * Read the agent's current login state on the data-center host.
 * Five9 returns a bare quoted JSON string, e.g. "SELECT_STATION" / "WORKING".
 * This is ALSO the call that binds the freshly-issued login token to the
 * data-center node — skipping it makes session_start 401 "User is not logged
 * in", because /auth/login happens on app.five9.com but agent calls go to the
 * data center (e.g. app-atl.five9.com).
 */
async function getLoginState(userId: string): Promise<string> {
  const res = await agentFetch(userId, `/login_state`);
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`login_state ${res.status}: ${t.slice(0, 300)}`);
  }
  const text = await res.text();
  return text.trim().replace(/^"|"$/g, "");
}

/** Accept all pending Five9 maintenance notices (blocks reaching WORKING). */
async function acceptMaintenanceNotices(userId: string): Promise<void> {
  const res = await agentFetch(userId, `/maintenance_notices`);
  if (!res.ok) return;
  const notices = (await res.json().catch(() => [])) as Array<{ id?: string | number }>;
  if (!Array.isArray(notices)) return;
  for (const n of notices) {
    if (n.id == null) continue;
    await agentFetch(userId, `/maintenance_notices/${n.id}/accept`, { method: "PUT" }).catch(
      () => undefined,
    );
  }
}

/**
 * Start the agent's session inside Five9 — required before placing calls.
 *
 * Five9 agent login is a STATE MACHINE, not a single call. After /auth/login
 * we poll /login_state on the data-center host and drive it to WORKING:
 *   SELECT_STATION -> PUT /session_start?force=true  (select the station)
 *   ACCEPT_NOTICE  -> accept each maintenance notice
 *   WORKING        -> done
 * Reference: github.com/a1comms/go-five9-api/blob/master/login.go
 */
export async function startAgentSession(
  userId: string,
  stationId: string,
  stationType: "EMPTY" | "SOFTPHONE" | "STATION" | "PSTN" = "EMPTY",
): Promise<{ ok: boolean; state?: string }> {
  // stationType=EMPTY: REST-driven click-to-dial (audio goes nowhere)
  // stationType=SOFTPHONE: Five9's softphone — requires WebRTC bridge (TBD)
  // stationType=STATION: agent's physical desk phone (needs stationId)
  // stationType=PSTN: Five9 calls the agent's phone number (stationId)
  const body = buildSessionStartBody(stationType as "EMPTY" | "SOFTPHONE" | "STATION" | "PSTN", stationId);

  // Start Session is an explicit "begin" action — never reuse a cached or
  // persisted session that a later ForceIn login may have invalidated. Force
  // a fresh login so the state machine starts from a live token.
  sessionCache.delete(userId);
  await clearPersistedSession(userId);

  let lastState = "";
  for (let i = 0; i < 6; i++) {
    const state = await getLoginState(userId);
    lastState = state;

    if (state === "WORKING") {
      // Persist the session so click_to_dial on a different Railway pod sees
      // this exact token + cookies.
      const session = sessionCache.get(userId);
      if (session) await persistSession(userId, session).catch(() => undefined);
      return { ok: true, state };
    }

    if (state === "SELECT_STATION") {
      const res = await agentFetch(userId, `/session_start?force=true`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`session_start ${res.status}: ${t.slice(0, 500)}`);
      }
      continue;
    }

    if (state === "ACCEPT_NOTICE") {
      await acceptMaintenanceNotices(userId);
      continue;
    }

    // SELECT_SKILLS and any other state are not handled yet — surface the raw
    // state so we know exactly what to add next instead of silently hanging.
    throw new Error(`Unexpected Five9 login state: ${state}`);
  }
  throw new Error(`Five9 did not reach WORKING state (last: ${lastState})`);
}

/** Change the agent's ready state — values: READY, NOT_READY, ON_CALL, WORK */
export async function setAgentState(userId: string, state: string, reasonCodeId?: string): Promise<{ ok: boolean }> {
  const body: Record<string, unknown> = { state };
  if (reasonCodeId) body.reasonCodeId = reasonCodeId;
  const res = await agentFetch(userId, `/state`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`set_state ${res.status}: ${t.slice(0, 300)}`);
  }
  return { ok: true };
}

/** Click-to-dial — Five9 will ring the agent's station, then dial the destination. */
export async function makeCall(userId: string, args: {
  number: string;
  campaignId?: string;
  skillId?: string;
  contactId?: string;
  stationId?: string;
}): Promise<{ ok: boolean; callId?: string }> {
  const body = JSON.stringify({
    number: args.number,
    campaignId: args.campaignId ?? undefined,
    skillId: args.skillId ?? undefined,
    contactId: args.contactId ?? undefined,
  });

  let res = await agentFetch(userId, `/interactions/click_to_dial`, {
    method: "PUT",
    body,
  });

  // If 401, the agent session may have lapsed. Clear caches and re-login + start.
  if (res.status === 401 || res.status === 435) {
    const text = await res.clone().text();
    if (text.includes("not logged in") || text.includes("\"401\"")) {
      sessionCache.delete(userId);
      await clearPersistedSession(userId);
      const stationId = args.stationId ?? "";
      await startAgentSession(userId, stationId).catch(() => undefined);
      res = await agentFetch(userId, `/interactions/click_to_dial`, { method: "PUT", body });
    }
  }

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`click_to_dial ${res.status}: ${t.slice(0, 500)}`);
  }
  const json = await res.json().catch(() => ({}));
  return { ok: true, callId: (json as { callId?: string }).callId };
}

/** Get the agent's currently active calls — used to surface inbound calls. */
export async function getActiveCalls(userId: string): Promise<Array<{
  callId: string;
  direction: "INBOUND" | "OUTBOUND";
  phone: string;
  state: string;
  startedAt: string;
}>> {
  // Read-only poll: never log in (ensureLogin=false). No session → no calls.
  let res: Response;
  try {
    res = await agentFetch(userId, `/interactions/calls`, {}, false);
  } catch {
    return [];
  }
  if (!res.ok) return [];
  const json = (await res.json()) as Array<Record<string, unknown>>;
  if (!Array.isArray(json)) return [];
  return json.map((c) => ({
    callId: (c.id as string) ?? (c.callId as string) ?? "",
    direction: ((c.type as string)?.toLowerCase().includes("inbound") ? "INBOUND" : "OUTBOUND") as "INBOUND" | "OUTBOUND",
    phone: (c.ani as string) ?? (c.dnis as string) ?? (c.number as string) ?? "",
    state: (c.state as string) ?? "UNKNOWN",
    startedAt: (c.startTime as string) ?? new Date().toISOString(),
  }));
}

/**
 * Read the agent's current session state — used by the dialer UI to poll.
 * Read-only: NEVER logs in (ensureLogin=false). If there's no live session,
 * report DISCONNECTED instead of throwing/502ing or kicking off a login.
 */
export async function getAgentSessionState(userId: string): Promise<{
  state: string;
  stationId?: string;
  activeCalls?: number;
}> {
  let res: Response;
  try {
    res = await agentFetch(userId, `/session_metadata`, {}, false);
  } catch {
    return { state: "DISCONNECTED" };
  }
  if (!res.ok) return { state: "DISCONNECTED" };
  const json = await res.json().catch(() => ({}));
  return json as { state: string; stationId?: string; activeCalls?: number };
}

/** Hang up the active call on the agent's session. */
export async function hangupCall(userId: string, callId: string): Promise<{ ok: boolean }> {
  const res = await agentFetch(userId, `/interactions/calls/${callId}/disconnect`, {
    method: "PUT",
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`disconnect ${res.status}: ${t.slice(0, 300)}`);
  }
  return { ok: true };
}

/** Put a call on hold (or unhold). Action: "hold" | "unhold". */
export async function holdCall(userId: string, callId: string, action: "hold" | "unhold"): Promise<{ ok: boolean }> {
  const res = await agentFetch(userId, `/interactions/calls/${callId}/${action}`, { method: "PUT" });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`${action} ${res.status}: ${t.slice(0, 300)}`);
  }
  return { ok: true };
}

/** Mute or unmute the agent's mic on a call. */
export async function muteCall(userId: string, callId: string, action: "mute" | "unmute"): Promise<{ ok: boolean }> {
  const res = await agentFetch(userId, `/interactions/calls/${callId}/${action}`, { method: "PUT" });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`${action} ${res.status}: ${t.slice(0, 300)}`);
  }
  return { ok: true };
}

/** Send DTMF tones during a call (1, 2, *, #, etc). */
export async function sendDTMF(userId: string, callId: string, digits: string): Promise<{ ok: boolean }> {
  const res = await agentFetch(userId, `/interactions/calls/${callId}/dtmf`, {
    method: "PUT",
    body: JSON.stringify({ digits }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`dtmf ${res.status}: ${t.slice(0, 300)}`);
  }
  return { ok: true };
}

/** Set the disposition on the agent's active call. Five9 stores it in their reporting. */
export async function setCallDisposition(userId: string, callId: string, dispositionName: string, notes?: string): Promise<{ ok: boolean }> {
  const res = await agentFetch(userId, `/interactions/calls/${callId}/disposition`, {
    method: "PUT",
    body: JSON.stringify({ dispositionName, notes: notes ?? "" }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`set_disposition ${res.status}: ${t.slice(0, 300)}`);
  }
  return { ok: true };
}

/** Transfer a call to a number / queue / agent. */
export async function transferCall(userId: string, callId: string, args: {
  destination: string;
  type?: "AGENT" | "SKILL" | "EXTERNAL";
}): Promise<{ ok: boolean }> {
  const res = await agentFetch(userId, `/interactions/calls/${callId}/transfer`, {
    method: "PUT",
    body: JSON.stringify({ destination: args.destination, type: args.type ?? "EXTERNAL" }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`transfer ${res.status}: ${t.slice(0, 300)}`);
  }
  return { ok: true };
}

/** Logout the agent. Clears the session cache (memory + DB). */
export async function logoutAgent(userId: string): Promise<{ ok: boolean }> {
  const session = sessionCache.get(userId) ?? (await loadPersistedSession(userId));
  if (session) {
    await fetch(`${session.apiHost}/auth/logout`, {
      method: "POST",
      headers: { Cookie: cookieHeaderFor(session.cookies, hostOf(session.apiHost)) },
    }).catch(() => undefined);
  }
  sessionCache.delete(userId);
  await clearPersistedSession(userId);
  return { ok: true };
}
