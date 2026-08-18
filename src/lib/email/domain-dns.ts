// src/lib/email/domain-dns.ts
/**
 * DNS-based deliverability checks. Pure classifiers are unit-tested; the async
 * lookups wrap node:dns/promises and return UNKNOWN on any resolver error so a
 * flaky network never reports a false PASS/FAIL.
 */
import { resolveTxt, resolve4, resolve as dnsResolve } from "node:dns/promises";

/** Race a lookup against a timer so a dead resolver returns the fallback fast. */
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export type AuthStatus = "PASS" | "FAIL" | "UNKNOWN";
export interface AuthResult { status: AuthStatus; record?: string | null }

function flattenTxt(records: string[][] | null): string[] | null {
  if (!records) return null;
  return records.map((chunks) => chunks.join(""));
}

export function classifySpf(txt: string[] | null): AuthResult {
  if (!txt) return { status: "UNKNOWN" };
  const spf = txt.find((r) => r.toLowerCase().startsWith("v=spf1"));
  return spf ? { status: "PASS", record: spf } : { status: "FAIL", record: null };
}

export function classifyDmarc(txt: string[] | null): AuthResult {
  if (!txt) return { status: "UNKNOWN" };
  const dmarc = txt.find((r) => r.toLowerCase().startsWith("v=dmarc1"));
  if (!dmarc) return { status: "FAIL", record: null };
  const policy = /(?:^|[;\s])p=\s*(none|quarantine|reject)/i.exec(dmarc)?.[1]?.toLowerCase();
  return { status: policy === "quarantine" || policy === "reject" ? "PASS" : "FAIL", record: dmarc };
}

export function reverseIpForDnsbl(ip: string, zone: string): string | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip.trim());
  if (!m) return null;
  return `${m[4]}.${m[3]}.${m[2]}.${m[1]}.${zone}`;
}

async function txtOrNull(host: string): Promise<string[] | null> {
  const records = await withTimeout(
    resolveTxt(host).then((r) => r as unknown as string[][]).catch(() => null),
    5000,
    null,
  );
  return flattenTxt(records);
}

export async function checkSpf(domain: string): Promise<AuthResult> {
  return classifySpf(await txtOrNull(domain));
}

export async function checkDmarc(domain: string): Promise<AuthResult> {
  return classifyDmarc(await txtOrNull(`_dmarc.${domain}`));
}

/**
 * DKIM: we cannot enumerate selectors generically, so we probe the given
 * selectors (Resend uses "resend"). PASS if any selector has a TXT/CNAME.
 */
export async function checkDkim(domain: string, selectors: string[] = ["resend"]): Promise<AuthResult> {
  for (const sel of selectors) {
    const host = `${sel}._domainkey.${domain}`;
    const txt = await txtOrNull(host);
    if (txt && txt.length > 0) return { status: "PASS", record: `${sel}._domainkey` };
    try {
      const cname = await withTimeout(dnsResolve(host, "CNAME").catch(() => [] as string[]), 5000, [] as string[]);
      if (cname && cname.length > 0) return { status: "PASS", record: `${sel}._domainkey (CNAME)` };
    } catch {
      // try next selector
    }
  }
  return { status: "FAIL", record: null };
}

export interface BlacklistResult { zone: string; listed: boolean }

const DEFAULT_ZONES = ["zen.spamhaus.org", "b.barracudacentral.org", "bl.spamcop.net"];

/** Resolve the sending IP against each DNSBL zone. An A answer means listed. */
export async function checkBlacklists(ip: string | null, zones: string[] = DEFAULT_ZONES): Promise<BlacklistResult[]> {
  if (!ip) return zones.map((zone) => ({ zone, listed: false }));
  const out: BlacklistResult[] = [];
  for (const zone of zones) {
    const query = reverseIpForDnsbl(ip, zone);
    if (!query) { out.push({ zone, listed: false }); continue; }
    try {
      const a = await withTimeout(resolve4(query).catch(() => [] as string[]), 5000, [] as string[]);
      out.push({ zone, listed: a.length > 0 });
    } catch {
      // NXDOMAIN (not listed) or resolver error -> treat as not listed
      out.push({ zone, listed: false });
    }
  }
  return out;
}
