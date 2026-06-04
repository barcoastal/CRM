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
  metadata: {
    dataCenters: Array<{
      name: string;
      apiUrls: Array<{ host: string; port: number; version: string; routeKey: string }>;
    }>;
  };
}

interface AgentSession {
  tokenId: string;
  apiHost: string;
  routeKey: string | null;
  userId: string;
  cookies: string; // serialized Cookie header value from login response
  cachedAt: number;
}

const sessionCache = new Map<string, AgentSession>();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min

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
      policy: "AttachExisting",
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
  // Stay on the SAME host the cookies came from (the login base) — Five9
  // uses farmId routing instead of host switching. Otherwise the
  // JSESSIONID cookie is domain-scoped to the login host and won't apply
  // to the data-center host.
  const apiHost = loginBase();
  const routeKey = url.routeKey ?? null;
  return { tokenId: json.tokenId, apiHost, routeKey, userId: json.userId, cookies, cachedAt: Date.now() };
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
  const cached = sessionCache.get(userId);
  if (cached && Date.now() - cached.cachedAt < SESSION_TTL_MS) return cached;

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
  return session;
}

async function agentFetch(userId: string, path: string, init: RequestInit = {}): Promise<Response> {
  const session = await getSession(userId);
  const url = `${session.apiHost}/agents/${session.userId}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/plain",
    Authorization: `Bearer-${session.tokenId}`,
    Cookie: session.cookies,
  };
  if (session.routeKey) headers.farmId = session.routeKey;
  return fetch(url, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });
}

/** Start the agent's session inside Five9 — required before placing calls. */
export async function startAgentSession(userId: string, stationId: string): Promise<{ ok: boolean }> {
  const res = await agentFetch(userId, `/session_start`, {
    method: "POST",
    body: JSON.stringify({ stationId, stationType: "softphone", forceLogoutAgent: true }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`session_start ${res.status}: ${t.slice(0, 300)}`);
  }
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
}): Promise<{ ok: boolean; callId?: string }> {
  const res = await agentFetch(userId, `/interactions/make_call`, {
    method: "POST",
    body: JSON.stringify({
      number: args.number,
      campaignId: args.campaignId ?? undefined,
      skillId: args.skillId ?? undefined,
      contactId: args.contactId ?? undefined,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`make_call ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = await res.json().catch(() => ({}));
  return { ok: true, callId: (json as { callId?: string }).callId };
}

/** Read the agent's current session state — used by the dialer UI to refresh. */
export async function getAgentSessionState(userId: string): Promise<{
  state: string;
  stationId?: string;
  activeCalls?: number;
}> {
  const res = await agentFetch(userId, `/session_state`);
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`session_state ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = await res.json().catch(() => ({}));
  return json as { state: string; stationId?: string; activeCalls?: number };
}

/** Hang up the active call on the agent's session. */
export async function hangupCall(userId: string, callId: string): Promise<{ ok: boolean }> {
  const res = await agentFetch(userId, `/interactions/calls/${callId}/disconnect`, {
    method: "POST",
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`disconnect ${res.status}: ${t.slice(0, 300)}`);
  }
  return { ok: true };
}

/** Logout the agent. Clears the session cache. */
export async function logoutAgent(userId: string): Promise<{ ok: boolean }> {
  const session = sessionCache.get(userId);
  if (!session) return { ok: true };
  await fetch(`${session.apiHost}/auth/logout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer-${session.tokenId}`,
      Cookie: session.cookies,
    },
  }).catch(() => undefined);
  sessionCache.delete(userId);
  return { ok: true };
}
