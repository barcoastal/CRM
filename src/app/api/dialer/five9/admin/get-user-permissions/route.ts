/**
 * Reads a Five9 user's full info + permissions via the admin SOAP API.
 *
 *   POST /api/dialer/five9/admin/get-user-permissions
 *     body: { userName: "bar@coastaldebt.com" }
 *
 * Returns raw XML so we can see every permission flag (boolean + role).
 * Tells us exactly which permission is missing for REST click-to-dial.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";

const SOAP_NS = "http://schemas.xmlsoap.org/soap/envelope/";
const SER_NS = "http://service.admin.ws.five9.com/";

function endpoint(): string {
  const base = process.env.FIVE9_API_BASE_URL ?? "https://api.five9.com";
  return `${base.replace(/\/$/, "")}/wsadmin/v13/AdminWebService`;
}

function authHeader(): string {
  const u = process.env.FIVE9_USERNAME!;
  const p = process.env.FIVE9_PASSWORD!;
  return `Basic ${Buffer.from(`${u}:${p}`).toString("base64")}`;
}

function buildSecurityHeader(): string {
  const answers = [
    process.env.FIVE9_SECURITY_ANSWER_1,
    process.env.FIVE9_SECURITY_ANSWER_2,
    process.env.FIVE9_SECURITY_ANSWER_3,
  ].filter((a): a is string => typeof a === "string" && a.length > 0);
  if (answers.length === 0) return "";
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const els = answers.map((a) => `<answer>${esc(a)}</answer>`).join("");
  return `<soapenv:Header><ser:headerSecurityAnswers>${els}</ser:headerSecurityAnswers></soapenv:Header>`;
}

async function soapGetUserInfo(userName: string): Promise<string> {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${SOAP_NS}" xmlns:ser="${SER_NS}">
  ${buildSecurityHeader()}
  <soapenv:Body>
    <ser:getUserInfo><userName>${userName}</userName></ser:getUserInfo>
  </soapenv:Body>
</soapenv:Envelope>`;
  const res = await fetch(endpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "text/xml;charset=UTF-8",
      Authorization: authHeader(),
      SOAPAction: `"getUserInfo"`,
    },
    body,
  });
  return res.text();
}

export async function POST(request: NextRequest) {
  const r = await requireAuthOrRespond("Lead.Read");
  if ("response" in r) return r.response;

  const body = (await request.json().catch(() => ({}))) as { userName?: string };
  const userName = body.userName ?? "bar@coastaldebt.com";

  try {
    const xml = await soapGetUserInfo(userName);
    return new NextResponse(xml, { headers: { "content-type": "application/xml" } });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "fail" }, { status: 502 });
  }
}
