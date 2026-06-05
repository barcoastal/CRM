/**
 * Probe POST /agents/{userId}/interactions with different body shapes to
 * find the one Five9 accepts.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptPassword } from "@/lib/five9/agent-api";

const BODIES: Array<{ name: string; body: unknown }> = [
  { name: "number-only", body: { number: "+19048810033" } },
  { name: "destination", body: { destination: "+19048810033" } },
  { name: "type+number", body: { type: "CLICK_TO_DIAL", number: "+19048810033" } },
  { name: "type+destination", body: { type: "CLICK_TO_DIAL", destination: "+19048810033" } },
  { name: "interactionType+number", body: { interactionType: "CALL", number: "+19048810033" } },
  { name: "phoneNumber", body: { phoneNumber: "+19048810033" } },
  { name: "to", body: { to: "+19048810033" } },
  { name: "outbound-call", body: { type: "OUTBOUND_CALL", number: "+19048810033" } },
];

export async function POST(_request: NextRequest) {
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

  const results: Array<{ name: string; status: number; snippet: string }> = [];
  for (const b of BODIES) {
    const r = await fetch(`${apiHost}/agents/${userId}/interactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer-${tokenId}`,
        Cookie: cookieHeader,
        farmId: farmId ?? "",
      },
      body: JSON.stringify(b.body),
    });
    const text = await r.text().catch(() => "");
    results.push({ name: b.name, status: r.status, snippet: text.slice(0, 250) });
  }

  return NextResponse.json({ apiHost, userId, results });
}
