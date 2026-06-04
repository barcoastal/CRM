/**
 * Verifies the Five9 admin API credentials by listing campaigns + lists.
 * Lets us see what's available without exposing data, and gives Bar a
 * single endpoint to hit after setting the env vars.
 *
 *   GET /api/dialer/five9/test-connection
 *
 * Auth: requires Lead.Read (so only logged-in users can probe).
 * Returns: { ok, env: { configured }, campaigns?: [...], lists?: [...], error? }
 */

import { NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";

const SOAP_NS = "http://schemas.xmlsoap.org/soap/envelope/";
const SER_NS = "http://service.admin.ws.five9.com/";

interface EnvStatus {
  NEXT_PUBLIC_FIVE9_DOMAIN: boolean;
  FIVE9_USERNAME: boolean;
  FIVE9_PASSWORD: boolean;
  FIVE9_API_BASE_URL: string;
  FIVE9_DEFAULT_LIST: boolean;
}

function envStatus(): EnvStatus {
  return {
    NEXT_PUBLIC_FIVE9_DOMAIN: !!process.env.NEXT_PUBLIC_FIVE9_DOMAIN,
    FIVE9_USERNAME: !!process.env.FIVE9_USERNAME,
    FIVE9_PASSWORD: !!process.env.FIVE9_PASSWORD,
    FIVE9_API_BASE_URL: process.env.FIVE9_API_BASE_URL ?? "https://api.five9.com (default)",
    FIVE9_DEFAULT_LIST: !!process.env.FIVE9_DEFAULT_LIST,
  };
}

function authHeader(): string {
  const u = process.env.FIVE9_USERNAME!;
  const p = process.env.FIVE9_PASSWORD!;
  return `Basic ${Buffer.from(`${u}:${p}`).toString("base64")}`;
}

function endpoint(): string {
  const base = process.env.FIVE9_API_BASE_URL ?? "https://api.five9.com";
  return `${base.replace(/\/$/, "")}/wsadmin/v13/AdminWebService`;
}

async function soapCall(method: string, innerBody: string): Promise<string> {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${SOAP_NS}" xmlns:ser="${SER_NS}">
  <soapenv:Body>
    <ser:${method}>${innerBody}</ser:${method}>
  </soapenv:Body>
</soapenv:Envelope>`;
  const res = await fetch(endpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "text/xml;charset=UTF-8",
      Authorization: authHeader(),
      SOAPAction: `"${method}"`,
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`);
  return text;
}

function extractAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[a-zA-Z0-9]+:)?${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

function extractNames(xml: string, container: string): string[] {
  const blocks = extractAll(xml, container);
  const names = new Set<string>();
  for (const b of blocks) {
    for (const n of extractAll(b, "name")) names.add(n.trim());
  }
  return Array.from(names);
}

export async function GET() {
  const r = await requireAuthOrRespond("Lead.Read");
  if ("response" in r) return r.response;

  const env = envStatus();
  if (!env.NEXT_PUBLIC_FIVE9_DOMAIN || !env.FIVE9_USERNAME || !env.FIVE9_PASSWORD) {
    return NextResponse.json({
      ok: false,
      env,
      error: "Set NEXT_PUBLIC_FIVE9_DOMAIN, FIVE9_USERNAME, FIVE9_PASSWORD on Railway first.",
    });
  }

  const checks: Record<string, unknown> = { env };

  // 1) getCampaigns
  try {
    const xml = await soapCall("getCampaigns", "<namePattern>.*</namePattern>");
    const names = extractNames(xml, "campaigns");
    checks.campaigns = { ok: true, count: names.length, sample: names.slice(0, 10) };
  } catch (e: unknown) {
    checks.campaigns = { ok: false, error: e instanceof Error ? e.message : "fail" };
  }

  // 2) getListsInfo
  try {
    const xml = await soapCall("getListsInfo", "<namePattern>.*</namePattern>");
    const names = extractNames(xml, "lists");
    checks.lists = {
      ok: true,
      count: names.length,
      sample: names.slice(0, 10),
      defaultListConfigured: process.env.FIVE9_DEFAULT_LIST ?? null,
      defaultListExists: process.env.FIVE9_DEFAULT_LIST
        ? names.includes(process.env.FIVE9_DEFAULT_LIST)
        : null,
    };
  } catch (e: unknown) {
    checks.lists = { ok: false, error: e instanceof Error ? e.message : "fail" };
  }

  // 3) getDispositions
  try {
    const xml = await soapCall("getDispositions", "<namePattern>.*</namePattern>");
    const names = extractNames(xml, "dispositions");
    checks.dispositions = { ok: true, count: names.length, sample: names.slice(0, 20) };
  } catch (e: unknown) {
    checks.dispositions = { ok: false, error: e instanceof Error ? e.message : "fail" };
  }

  const allOk =
    (checks.campaigns as { ok: boolean })?.ok &&
    (checks.lists as { ok: boolean })?.ok;

  return NextResponse.json({ ok: !!allOk, ...checks });
}
