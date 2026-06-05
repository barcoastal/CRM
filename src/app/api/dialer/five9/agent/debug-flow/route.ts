/**
 * DIAGNOSTIC: run GET /login_state several ways and dump the real request +
 * response for each, so we can see exactly what Five9 accepts instead of
 * guessing. Remove once the dialer login works.
 *
 * POST /api/dialer/five9/agent/debug-flow  (uses saved creds)
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptPassword, parseSetCookies, cookieHeaderFor } from "@/lib/five9/agent-api";

const LOGIN_BASE = process.env.FIVE9_AGENT_LOGIN_URL ?? "https://app.five9.com/appsvcs/rs/svc";
const hostOf = (u: string) => { try { return new URL(u).hostname; } catch { return u; } };

async function login(username: string, password: string) {
  const res = await fetch(`${LOGIN_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/plain" },
    body: JSON.stringify({ passwordCredentials: { username, password }, policy: "ForceIn" }),
  });
  const cookies = parseSetCookies(res, hostOf(LOGIN_BASE));
  const json = (await res.json()) as Record<string, unknown>;
  return { status: res.status, json, cookies };
}

async function probe(label: string, url: string, headers: Record<string, string>) {
  let status = 0;
  let body = "";
  let setCookie: string[] = [];
  try {
    const res = await fetch(url, { method: "GET", headers });
    status = res.status;
    body = (await res.text()).slice(0, 300);
    const getter = (res.headers as { getSetCookie?: () => string[] }).getSetCookie;
    setCookie = typeof getter === "function" ? getter.call(res.headers).map((c) => c.split("=")[0]) : [];
  } catch (e) {
    body = `THREW: ${e instanceof Error ? e.message : String(e)}`;
  }
  return {
    label,
    url,
    sentHeaderKeys: Object.keys(headers),
    sentCookieNames: (headers.Cookie ?? "").split(";").map((c) => c.split("=")[0].trim()).filter(Boolean),
    authHeader: headers.Authorization ? `${headers.Authorization.slice(0, 8)}…(len ${headers.Authorization.length})` : null,
    status,
    respSetCookieNames: setCookie,
    body,
  };
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { five9Username: true, five9PasswordEnc: true },
  });
  if (!user?.five9Username || !user.five9PasswordEnc) {
    return NextResponse.json({ error: "no creds" }, { status: 400 });
  }
  const password = decryptPassword(user.five9PasswordEnc);

  const lg = await login(user.five9Username, password);
  const tokenId = lg.json.tokenId as string | undefined;
  const userId = lg.json.userId as string | undefined;
  const farmId = (lg.json.context as { farmId?: string } | undefined)?.farmId;
  const meta = lg.json.metadata as { dataCenters?: Array<Record<string, unknown>> } | undefined;
  const dcs = meta?.dataCenters ?? [];
  const dc = (dcs.find((d) => (d as { active?: boolean }).active) ?? dcs[0]) as
    | { apiUrls?: Array<{ host: string; port: string }>; loginUrls?: Array<{ host: string; port: string }> }
    | undefined;
  const api = dc?.apiUrls?.[0];
  if (!tokenId || !userId || !api) {
    return NextResponse.json({ error: "login missing token/userId/dc", login: lg }, { status: 500 });
  }
  const apiHost = `https://${api.host}:${api.port}/appsvcs/rs/svc`;
  const dcHostname = hostOf(apiHost);
  const stateUrl = `${apiHost}/agents/${userId}/login_state`;

  const jarCookies = cookieHeaderFor(lg.cookies, dcHostname);
  const allCookies = lg.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const authCookie = lg.cookies.find((c) => c.name === "Authorization")?.value;

  const base = { Accept: "application/json, text/plain" };
  const probes = [];

  // A: current behavior — Bearer-token header + jar cookies + farmId header
  probes.push(await probe("A bearer+jar+farmId", stateUrl, {
    ...base, Authorization: `Bearer-${tokenId}`, Cookie: jarCookies, ...(farmId ? { farmId } : {}),
  }));
  // B: Bearer + ALL cookies (incl host-only)
  probes.push(await probe("B bearer+allCookies+farmId", stateUrl, {
    ...base, Authorization: `Bearer-${tokenId}`, Cookie: allCookies, ...(farmId ? { farmId } : {}),
  }));
  // C: cookies only, NO Authorization header
  probes.push(await probe("C jarCookies only (no auth header)", stateUrl, {
    ...base, Cookie: jarCookies, ...(farmId ? { farmId } : {}),
  }));
  // D: Authorization header = the Authorization cookie value, Bearer- prefixed
  if (authCookie) probes.push(await probe("D bearer(authCookie)+jar", stateUrl, {
    ...base, Authorization: `Bearer-${authCookie}`, Cookie: jarCookies, ...(farmId ? { farmId } : {}),
  }));
  // E: Authorization header = raw token, no Bearer- prefix
  probes.push(await probe("E rawToken+jar", stateUrl, {
    ...base, Authorization: tokenId, Cookie: jarCookies, ...(farmId ? { farmId } : {}),
  }));
  // F: Bearer + jar, NO farmId header
  probes.push(await probe("F bearer+jar (no farmId)", stateUrl, {
    ...base, Authorization: `Bearer-${tokenId}`, Cookie: jarCookies,
  }));

  // G: re-login directly on the DC loginUrl host, then login_state with those cookies
  const loginUrl = dc?.loginUrls?.[0];
  let gResult: unknown = "no loginUrl in metadata";
  if (loginUrl) {
    const dcLoginBase = `https://${loginUrl.host}:${loginUrl.port}/appsvcs/rs/svc`;
    const res = await fetch(`${dcLoginBase}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/plain" },
      body: JSON.stringify({ passwordCredentials: { username: user.five9Username, password }, policy: "ForceIn" }),
    }).catch((e) => ({ status: 0, _err: String(e) } as unknown as Response));
    const dcCookies = "headers" in res ? parseSetCookies(res as Response, hostOf(dcLoginBase)) : [];
    const dcJson = "json" in res ? await (res as Response).json().catch(() => ({})) : {};
    const dcToken = (dcJson as { tokenId?: string }).tokenId ?? tokenId;
    gResult = await probe("G reLoginOnDC+jar", stateUrl, {
      ...base, Authorization: `Bearer-${dcToken}`, Cookie: cookieHeaderFor(dcCookies, dcHostname), ...(farmId ? { farmId } : {}),
    });
  }

  return NextResponse.json({
    loginStatus: lg.status,
    apiHost,
    userId,
    farmId,
    loginCookieNames: lg.cookies.map((c) => `${c.name}${c.domain ? `(.${c.domain})` : "(host-only)"}`),
    probes,
    G: gResult,
  });
}
