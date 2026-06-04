/**
 * Auto-match Five9 dispositions to our CRM Lead / Opp / Account
 * sub-disposition vocab.
 *
 *   GET /api/dialer/five9/disposition-map
 *
 * Pulls all dispositions from Five9, normalizes them, fuzzy-matches each one
 * against the canonical CRM vocab, and returns:
 *   {
 *     matched:    [{ five9, crm, confidence }],
 *     ambiguous:  [{ five9, candidates: [{crm, score}] }],
 *     unmatched:  [string]
 *   }
 *
 * Used once for discovery — the result becomes the seed for the persistent
 * Five9DispositionMap table once Bar reviews it.
 *
 * Auth: requires Lead.Read.
 */

import { NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import {
  LEAD_SUB_DISPOSITIONS,
  OPP_STAGE_TO_SUB_DISPOSITIONS,
  ACCOUNT_STAGE_TO_SUB_DISPOSITIONS,
} from "@/lib/sf-canonical";

const SOAP_NS = "http://schemas.xmlsoap.org/soap/envelope/";
const SER_NS = "http://service.admin.ws.five9.com/";

function authHeader(): string {
  const u = process.env.FIVE9_USERNAME!;
  const p = process.env.FIVE9_PASSWORD!;
  return `Basic ${Buffer.from(`${u}:${p}`).toString("base64")}`;
}

function endpoint(): string {
  const base = process.env.FIVE9_API_BASE_URL ?? "https://api.five9.com";
  return `${base.replace(/\/$/, "")}/wsadmin/v13/AdminWebService`;
}

function buildSecurityHeader(): string {
  const answers = [
    process.env.FIVE9_SECURITY_ANSWER_1,
    process.env.FIVE9_SECURITY_ANSWER_2,
    process.env.FIVE9_SECURITY_ANSWER_3,
  ].filter((a): a is string => typeof a === "string" && a.length > 0);
  if (answers.length === 0) return "";
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const answerEls = answers.map((a) => `<answer>${escape(a)}</answer>`).join("");
  return `<soapenv:Header><ser:headerSecurityAnswers>${answerEls}</ser:headerSecurityAnswers></soapenv:Header>`;
}

async function fetchAllDispositionNames(): Promise<string[]> {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${SOAP_NS}" xmlns:ser="${SER_NS}">
  ${buildSecurityHeader()}
  <soapenv:Body>
    <ser:getDispositions><dispositionNamePattern>.*</dispositionNamePattern></ser:getDispositions>
  </soapenv:Body>
</soapenv:Envelope>`;
  const res = await fetch(endpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "text/xml;charset=UTF-8",
      Authorization: authHeader(),
      SOAPAction: `"getDispositions"`,
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Five9 getDispositions ${res.status}: ${text.slice(0, 200)}`);

  const nameRe = /<(?:[a-zA-Z0-9]+:)?name\b[^>]*>([^<]+)<\/(?:[a-zA-Z0-9]+:)?name>/gi;
  const names: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = nameRe.exec(text))) names.push(m[1].trim());
  return Array.from(new Set(names));
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let curr = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const next = Math.min(prev[j] + 1, curr + 1, prev[j - 1] + cost);
      prev[j - 1] = curr;
      curr = next;
    }
    prev[b.length] = curr;
  }
  return prev[b.length];
}

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (!na.length || !nb.length) return 0;

  const tokensA = new Set(na.split(" ").filter(Boolean));
  const tokensB = new Set(nb.split(" ").filter(Boolean));
  const intersection = new Set([...tokensA].filter((t) => tokensB.has(t)));
  const union = new Set([...tokensA, ...tokensB]);
  const jaccard = union.size === 0 ? 0 : intersection.size / union.size;

  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  const lev = 1 - dist / maxLen;

  return Math.max(jaccard, lev);
}

function buildCrmVocab(): string[] {
  const set = new Set<string>();
  for (const d of LEAD_SUB_DISPOSITIONS) set.add(d.value);
  for (const arr of Object.values(OPP_STAGE_TO_SUB_DISPOSITIONS)) for (const v of arr) set.add(v);
  for (const arr of Object.values(ACCOUNT_STAGE_TO_SUB_DISPOSITIONS)) for (const v of arr) set.add(v);
  return Array.from(set);
}

const MATCH_THRESHOLD = 0.85;
const CANDIDATE_THRESHOLD = 0.55;

export async function GET() {
  const r = await requireAuthOrRespond("Lead.Read");
  if ("response" in r) return r.response;

  let five9: string[];
  try {
    five9 = await fetchAllDispositionNames();
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fetch failed" },
      { status: 502 },
    );
  }

  const crm = buildCrmVocab();
  const matched: { five9: string; crm: string; confidence: number }[] = [];
  const ambiguous: { five9: string; candidates: { crm: string; score: number }[] }[] = [];
  const unmatched: string[] = [];

  for (const f of five9) {
    const scored = crm
      .map((c) => ({ crm: c, score: similarity(f, c) }))
      .sort((a, b) => b.score - a.score);
    const top = scored[0];

    if (top && top.score >= MATCH_THRESHOLD) {
      matched.push({ five9: f, crm: top.crm, confidence: Number(top.score.toFixed(3)) });
    } else if (top && top.score >= CANDIDATE_THRESHOLD) {
      ambiguous.push({
        five9: f,
        candidates: scored.slice(0, 3).map((s) => ({ crm: s.crm, score: Number(s.score.toFixed(3)) })),
      });
    } else {
      unmatched.push(f);
    }
  }

  return NextResponse.json({
    ok: true,
    totals: {
      five9Total: five9.length,
      crmVocab: crm.length,
      matched: matched.length,
      ambiguous: ambiguous.length,
      unmatched: unmatched.length,
    },
    matched,
    ambiguous,
    unmatched,
  });
}
