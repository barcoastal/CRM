/**
 * Returns the FULL login metadata response from Five9 so we can stop
 * guessing and see exactly what hosts, ports, routeKeys, orgId, etc. are
 * available for this tenant.
 *
 * POST /api/dialer/five9/agent/debug-login
 *   Auth: signed-in user
 *   Uses the saved credentials.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptPassword } from "@/lib/five9/agent-api";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { five9Username: true, five9PasswordEnc: true },
  });
  if (!user?.five9Username || !user.five9PasswordEnc) {
    return NextResponse.json({ ok: false, error: "no saved creds" }, { status: 400 });
  }

  const password = decryptPassword(user.five9PasswordEnc);
  const res = await fetch("https://app.five9.com/appsvcs/rs/svc/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/plain" },
    body: JSON.stringify({
      passwordCredentials: { username: user.five9Username, password },
      policy: "ForceIn",
    }),
  });
  const setCookie =
    typeof (res.headers as { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (res.headers as { getSetCookie: () => string[] }).getSetCookie()
      : [res.headers.get("set-cookie") ?? ""];
  const text = await res.text();
  let parsed: unknown = text;
  try { parsed = JSON.parse(text); } catch { /* keep raw */ }
  return NextResponse.json({
    status: res.status,
    setCookie,
    body: parsed,
  });
}
