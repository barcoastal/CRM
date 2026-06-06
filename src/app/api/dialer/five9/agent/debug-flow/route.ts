/**
 * DIAGNOSTIC: run the COMPLETE agent login flow (fresh login → login_state →
 * session_start → loop to WORKING) with the proven config (Bearer-token,
 * jar-scoped cookies, NO farmId header) and report every step, so we can
 * confirm the flow reaches WORKING before trusting the UI. Remove once the
 * dialer login works.
 *
 * POST /api/dialer/five9/agent/debug-flow  (uses saved creds)
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  decryptPassword,
  parseSetCookies,
  cookieHeaderFor,
  mergeCookies,
} from "@/lib/five9/agent-api";

const LOGIN_BASE = process.env.FIVE9_AGENT_LOGIN_URL ?? "https://app.five9.com/appsvcs/rs/svc";
const hostOf = (u: string) => { try { return new URL(u).hostname; } catch { return u; } };

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

  // Two-phase login with tracing.
  const logins: Array<Record<string, unknown>> = [];
  async function loginOn(base: string) {
    const r = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/plain" },
      body: JSON.stringify({ passwordCredentials: { username: user!.five9Username, password }, policy: "ForceIn" }),
    });
    const ck = parseSetCookies(r, hostOf(base));
    const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    logins.push({ host: hostOf(base), status: r.status, cookies: ck.map((c) => `${c.name}${c.domain ? "" : "(host-only)"}`) });
    return { r, ck, j };
  }

  // Phase 1: discover the active data center on app.five9.com.
  const p1 = await loginOn(LOGIN_BASE);
  const lg = p1.j as {
    metadata?: { dataCenters?: Array<{ active?: boolean; apiUrls?: Array<{ host: string; port: string }>; loginUrls?: Array<{ host: string; port: string }> }> };
  };
  const dc = (lg.metadata?.dataCenters ?? []).find((d) => d.active) ?? (lg.metadata?.dataCenters ?? [])[0];
  const api = dc?.apiUrls?.[0];
  const loginUrl = dc?.loginUrls?.[0];
  if (p1.r.status !== 200 || !api) {
    return NextResponse.json({ ok: false, step: "phase1-login", logins, lg }, { status: 500 });
  }
  const apiHost = `https://${api.host}:${api.port}/appsvcs/rs/svc`;
  const host = hostOf(apiHost);

  // Phase 2: re-login on the data center's own login host (if different).
  let active = p1;
  let jar = parseSetCookies(p1.r, hostOf(LOGIN_BASE));
  if (loginUrl && loginUrl.host !== hostOf(LOGIN_BASE)) {
    const dcLoginBase = `https://${loginUrl.host}:${loginUrl.port}/appsvcs/rs/svc`;
    active = await loginOn(dcLoginBase);
    jar = parseSetCookies(active.r, hostOf(dcLoginBase));
  }
  const aj = active.j as { userId?: string; context?: { farmId?: string } };
  const userId = aj.userId;
  const farmId = aj.context?.farmId;
  if (!userId) return NextResponse.json({ ok: false, step: "no-userId", logins }, { status: 500 });

  // Match the official Five9 client: cookies-only auth (NO Authorization
  // header), lowercase farmid + x-requested-with headers.
  async function call(method: string, path: string, body?: unknown) {
    const headers: Record<string, string> = {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      farmid: farmId ?? "",
      Cookie: cookieHeaderFor(jar, host),
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(`${apiHost}/agents/${userId}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const fresh = parseSetCookies(res, host);
    if (fresh.length) jar = mergeCookies(jar, fresh);
    const text = await res.text().catch(() => "");
    return { status: res.status, text };
  }

  // 2. Drive the state machine to WORKING.
  const trace: Array<Record<string, unknown>> = [];
  let reached = "";
  for (let i = 0; i < 8; i++) {
    const st = await call("GET", "/login_state");
    const state = st.text.trim().replace(/^"|"$/g, "");
    trace.push({ step: `login_state#${i}`, status: st.status, state: st.status === 200 ? state : st.text.slice(0, 160) });
    if (st.status !== 200) continue; // retry — each call accumulates DC cookies (affinity test)
    if (state === "WORKING") { reached = "WORKING"; break; }
    if (state === "SELECT_STATION") {
      const ss = await call("PUT", "/session_start?force=true", { stationId: "", stationType: "EMPTY" });
      trace.push({ step: "session_start?force=true", status: ss.status, body: ss.text.slice(0, 200) });
      continue;
    }
    if (state === "ACCEPT_NOTICE") {
      const gn = await call("GET", "/maintenance_notices");
      trace.push({ step: "GET maintenance_notices", status: gn.status, body: gn.text.slice(0, 300) });
      try {
        const notices = JSON.parse(gn.text) as Array<{ id?: string | number }>;
        for (const n of Array.isArray(notices) ? notices : []) {
          if (n.id == null) continue;
          const ac = await call("PUT", `/maintenance_notices/${n.id}/accept`);
          trace.push({ step: `accept notice ${n.id}`, status: ac.status });
        }
      } catch { /* ignore */ }
      continue;
    }
    reached = `UNHANDLED:${state}`;
    break;
  }

  // 3. If WORKING, probe the correct click-to-dial method/path. Sending an
  // empty body means a right-method request fails validation (400) BEFORE
  // placing a call; a wrong method returns 405 with an Allow header. No real
  // number is sent, so no call is placed.
  const ctd: Array<Record<string, unknown>> = [];
  if (reached === "WORKING") {
    const candidates: Array<[string, string]> = [
      ["OPTIONS", "/interactions/click_to_dial"],
      ["OPTIONS", "/interactions/make_call"],
      ["PUT", "/interactions/click_to_dial"],
      ["POST", "/interactions/click_to_dial"],
      ["POST", "/interactions/make_call"],
    ];
    for (const [m, p] of candidates) {
      const res = await fetch(`${apiHost}/agents/${userId}${p}`, {
        method: m,
        headers: {
          Accept: "application/json, text/javascript, */*; q=0.01",
          "X-Requested-With": "XMLHttpRequest",
          farmid: farmId ?? "",
          Cookie: cookieHeaderFor(jar, host),
          ...(m === "PUT" || m === "POST" ? { "Content-Type": "application/json" } : {}),
        },
        body: m === "PUT" || m === "POST" ? JSON.stringify({}) : undefined,
      });
      ctd.push({ method: m, path: p, status: res.status, allow: res.headers.get("allow"), body: (await res.text()).slice(0, 160) });
    }
  }

  return NextResponse.json({ ok: reached === "WORKING", reached, apiHost, logins, trace, ctd });
}
