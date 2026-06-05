/**
 * Probe multiple Five9 click-to-dial path/method combinations to find
 * which one Five9 accepts (not 404/405).
 *
 *   POST /api/dialer/five9/agent/probe-paths  { number: "+19048810033" }
 *
 * Returns the response of each candidate so we can pick the winner.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptPassword } from "@/lib/five9/agent-api";

const CANDIDATES: Array<{ method: "POST" | "PUT"; path: string }> = [
  { method: "POST", path: "/interactions/click_to_dial" },
  { method: "PUT", path: "/interactions/click_to_dial" },
  { method: "POST", path: "/click_to_dial" },
  { method: "PUT", path: "/click_to_dial" },
  { method: "POST", path: "/interactions/calls" },
  { method: "PUT", path: "/interactions/calls" },
  { method: "POST", path: "/interactions" },
  { method: "PUT", path: "/interactions" },
  { method: "POST", path: "/calls" },
  { method: "PUT", path: "/calls" },
  { method: "POST", path: "/interactions/make_call" },
  { method: "PUT", path: "/interactions/make_call" },
];

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { number?: string };
  const number = body.number ?? "+19048810033";

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { five9Username: true, five9PasswordEnc: true },
  });
  if (!user?.five9Username || !user.five9PasswordEnc) {
    return NextResponse.json({ error: "no creds" }, { status: 400 });
  }
  const password = decryptPassword(user.five9PasswordEnc);

  // Fresh login
  const loginRes = await fetch("https://app.five9.com/appsvcs/rs/svc/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      passwordCredentials: { username: user.five9Username, password },
      policy: "ForceIn",
    }),
  });
  const loginJson = await loginRes.json();
  const setCookies =
    typeof (loginRes.headers as { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (loginRes.headers as { getSetCookie: () => string[] }).getSetCookie()
      : [loginRes.headers.get("set-cookie") ?? ""];
  const cookieHeader = setCookies
    .map((c) => c.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
  const apiUrl = loginJson.metadata?.dataCenters?.[0]?.apiUrls?.[0];
  const apiHost = `https://${apiUrl.host}:${apiUrl.port}/appsvcs/rs/svc`;
  const userId = loginJson.userId;
  const tokenId = loginJson.tokenId;
  const farmId = loginJson.context?.farmId;

  // Start a session first (we know this works as PUT)
  await fetch(`${apiHost}/agents/${userId}/session_start`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer-${tokenId}`,
      Cookie: cookieHeader,
      farmId: farmId ?? "",
    },
    body: JSON.stringify({ stationId: "", stationType: "EMPTY" }),
  });

  const results: Array<{ method: string; path: string; status: number; snippet: string }> = [];
  for (const c of CANDIDATES) {
    const r = await fetch(`${apiHost}/agents/${userId}${c.path}`, {
      method: c.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer-${tokenId}`,
        Cookie: cookieHeader,
        farmId: farmId ?? "",
      },
      body: JSON.stringify({ number }),
    });
    const text = await r.text().catch(() => "");
    results.push({ method: c.method, path: c.path, status: r.status, snippet: text.slice(0, 250) });
  }

  return NextResponse.json({ apiHost, userId, results });
}
