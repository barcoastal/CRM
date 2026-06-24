/**
 * Minimal DocuSign client for the one-time historical import.
 *
 * JWT Grant auth (server-to-server) using Node crypto — no SDK dependency.
 * Requires env: DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, DOCUSIGN_ACCOUNT_ID,
 * DOCUSIGN_BASE_URI (e.g. https://na4.docusign.net), DOCUSIGN_PRIVATE_KEY.
 * The impersonated user must have granted consent once (signature impersonation).
 */
import crypto from "node:crypto";

const OAUTH_BASE = process.env.DOCUSIGN_OAUTH_BASE ?? "account.docusign.com"; // prod

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function privateKeyPem(): string {
  const raw = process.env.DOCUSIGN_PRIVATE_KEY ?? "";
  if (!raw) throw new Error("DOCUSIGN_PRIVATE_KEY not set");
  // Accept raw PEM (possibly with escaped newlines) or a base64-wrapped PEM.
  const pem = raw.includes("BEGIN")
    ? raw.replace(/\\n/g, "\n")
    : Buffer.from(raw, "base64").toString("utf8");
  return pem.trim();
}

let cached: { token: string; exp: number } | null = null;

export async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp - 60 > now) return cached.token;

  const ik = process.env.DOCUSIGN_INTEGRATION_KEY;
  const userId = process.env.DOCUSIGN_USER_ID;
  if (!ik || !userId) throw new Error("DOCUSIGN_INTEGRATION_KEY / DOCUSIGN_USER_ID not set");

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: ik,
      sub: userId,
      aud: OAUTH_BASE,
      iat: now,
      exp: now + 3600,
      scope: "signature impersonation",
    }),
  );
  const signingInput = `${header}.${payload}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  const signature = b64url(signer.sign(privateKeyPem()));
  const assertion = `${signingInput}.${signature}`;

  const res = await fetch(`https://${OAUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    // consent_required → the impersonated user hasn't granted consent yet.
    throw new Error(
      `DocuSign token error (${res.status}): ${data.error ?? ""} ${data.error_description ?? JSON.stringify(data)}`,
    );
  }
  cached = { token: data.access_token, exp: now + (data.expires_in ?? 3600) };
  return data.access_token;
}

export function restBase(): string {
  const base = (process.env.DOCUSIGN_BASE_URI ?? "https://na4.docusign.net").replace(/\/$/, "");
  const acct = process.env.DOCUSIGN_ACCOUNT_ID;
  if (!acct) throw new Error("DOCUSIGN_ACCOUNT_ID not set");
  return `${base}/restapi/v2.1/accounts/${acct}`;
}

export async function dsGet<T>(pathAndQuery: string): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${restBase()}${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`DocuSign GET ${pathAndQuery} → ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

/** Download the combined (flattened) signed PDF for an envelope. */
export async function dsGetCombinedPdf(envelopeId: string): Promise<Buffer> {
  const token = await getAccessToken();
  const res = await fetch(`${restBase()}/envelopes/${envelopeId}/documents/combined`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/pdf" },
  });
  if (!res.ok) throw new Error(`DocuSign combined PDF ${envelopeId} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
