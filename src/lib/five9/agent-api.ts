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

interface Five9LoginResponse {
  tokenId: string;
  userId: string;
  orgId: string;
  context?: { farmId?: string };
  metadata: {
    dataCenters: Array<{
      name: string;
      apiUrls: Array<{ host: string; port: number | string; version: string; routeKey: string }>;
    }>;
  };
}

interface AgentSession {
  tokenId: string;
  apiHost: string;
  farmId: string | null; // numeric farm id from context (e.g. "252")
  userId: string;
  orgId: string;
  cookies: string; // serialized Cookie header from login (BIGipServer + others)
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

/** Extract a `Cookie:` header value from a fetch Response's Set-Cookie headers. */
function extractCookies(res: Response): string {
  // Node fetch exposes getSetCookie() in newer runtimes
  const set: string[] | undefined =
    typeof (res.headers as { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (res.headers as { getSetCookie: () => string[] }).getSetCookie()
      : undefined;
  const cookies = set ?? [];
  if (cookies.length === 0) {
    const single = res.headers.get("set-cookie");
    if (single) cookies.push(single);
  }
  return cookies
    .map((c) => c.split(";")[0]?.trim())
    .filter((c): c is string => !!c)
    .join("; ");
}

async function loginAgent(username: string, password: string): Promise<AgentSession> {
  const res = await fetch(`${loginBase()}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/plain",
    },
    body: JSON.stringify({
      passwordCredentials: { username, password },
      policy: "ForceIn",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Five9 login ${res.status}: ${text.slice(0, 500)}`);
  }
  const cookies = extractCookies(res);
  const json = (await res.json()) as Five9LoginResponse;
  const dc = json.metadata?.dataCenters?.[0];
  const url = dc?.apiUrls?.[0];
  if (!url) throw new Error("Five9 login returned no data center URL");
  // Cookies are Domain=five9.com, so they apply to the discovered data-center
  // subdomain. The farmId header is the numeric value from context, NOT the
  // string routeKey.
  const apiHost = `https://${url.host}:${url.port}/appsvcs/rs/svc`;
  const farmId = json.context?.farmId ?? null;
  return {
    tokenId: json.tokenId,
    apiHost,
    farmId,
    userId: json.userId,
    orgId: json.orgId,
    cookies,
    cachedAt: Date.now(),
  };
}

/** Test if the stored credentials work — does a login then immediate logout. */
export async function testCredentials(username: string, password: string): Promise<{ ok: boolean; error?: string; apiHost?: string }> {
  try {
    const session = await loginAgent(username, password);
    await fetch(`${session.apiHost}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer-${session.tokenId}`, Cookie: session.cookies },
    }).catch(() => undefined);
    return { ok: true, apiHost: session.apiHost };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "login failed" };
  }
}

async function getSession(userId: string): Promise<AgentSession> {
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

async function agentFetch(userId: string, path: string, init: RequestInit = {}): Promise<Response> {
  return agentFetchInternal(userId, path, init, /* allowMigrationRetry */ true);
}

async function agentFetchInternal(
  userId: string,
  path: string,
  init: RequestInit,
  allowMigrationRetry: boolean,
): Promise<Response> {
  const session = await getSession(userId);
  const url = `${session.apiHost}/agents/${session.userId}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/plain",
    Authorization: `Bearer-${session.tokenId}`,
    Cookie: session.cookies,
  };
  if (session.farmId) headers.farmId = session.farmId;
  const res = await fetch(url, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });
  if (res.ok || !allowMigrationRetry) return res;

  // 5001 retry path is no longer needed once we use the right host + farmId,
  // but keep it as a defensive fallback.
  const text = await res.clone().text();
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

/** Start the agent's session inside Five9 — required before placing calls. */
export async function startAgentSession(
  userId: string,
  stationId: string,
  stationType: "EMPTY" | "SOFTPHONE" | "STATION" = "EMPTY",
): Promise<{ ok: boolean }> {
  // stationType=EMPTY: REST-driven click-to-dial (audio goes nowhere)
  // stationType=SOFTPHONE: Five9's softphone — requires WebRTC bridge (TBD)
  // stationType=STATION: agent's physical desk phone (needs stationId)
  const body = stationType === "STATION"
    ? { stationId, stationType }
    : { stationId: "", stationType };
  const res = await agentFetch(userId, `/session_start`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`session_start ${res.status}: ${t.slice(0, 500)}`);
  }
  // Persist the session post-session_start so click_to_dial on a different
  // Railway pod sees this exact token + cookies.
  const session = sessionCache.get(userId);
  if (session) await persistSession(userId, session).catch(() => undefined);
  return { ok: true };
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
  const res = await agentFetch(userId, `/interactions/calls`);
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

/** Read the agent's current session state — used by the dialer UI to refresh. */
export async function getAgentSessionState(userId: string): Promise<{
  state: string;
  stationId?: string;
  activeCalls?: number;
}> {
  const res = await agentFetch(userId, `/session_metadata`);
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`session_metadata ${res.status}: ${t.slice(0, 300)}`);
  }
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
      headers: {
        Authorization: `Bearer-${session.tokenId}`,
        Cookie: session.cookies,
      },
    }).catch(() => undefined);
  }
  sessionCache.delete(userId);
  await clearPersistedSession(userId);
  return { ok: true };
}
