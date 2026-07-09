/**
 * Salesforce Bulk API 2.0 query export - no sf CLI required, so the nightly
 * sync can run inside the Railway container.
 *
 * Auth comes from the SF_AUTH_URL env var in sfdx-auth-url format:
 *   force://<clientId>:<clientSecret>:<refreshToken>@<instanceHost>
 * (the same string `sf org display --verbose` shows). The refresh token is
 * exchanged for an access token per run.
 */
import fs from "node:fs";

const API_VERSION = "v61.0";

interface SfAuth {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  instanceUrl: string;
}

function parseAuthUrl(raw: string): SfAuth {
  const m = /^force:\/\/([^:]*):([^:]*):([^@]+)@(.+)$/.exec(raw.trim());
  if (!m) throw new Error("SF_AUTH_URL is not in force://clientId:clientSecret:refreshToken@host format");
  const host = m[4].replace(/^https?:\/\//, "").replace(/\/$/, "");
  return { clientId: m[1] || "PlatformCLI", clientSecret: m[2], refreshToken: m[3], instanceUrl: `https://${host}` };
}

async function getAccessToken(auth: SfAuth): Promise<{ token: string; instanceUrl: string }> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: auth.clientId,
    refresh_token: auth.refreshToken,
  });
  if (auth.clientSecret) body.set("client_secret", auth.clientSecret);
  const res = await fetch(`${auth.instanceUrl}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`SF token refresh failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { access_token: string; instance_url: string };
  return { token: j.access_token, instanceUrl: j.instance_url };
}

/** Run a Bulk API 2.0 query and write the full CSV to outPath. Returns row count estimate. */
export async function bulkQueryToCsv(soql: string, outPath: string): Promise<void> {
  const raw = process.env.SF_AUTH_URL;
  if (!raw) throw new Error("SF_AUTH_URL env var not set");
  const { token, instanceUrl } = await getAccessToken(parseAuthUrl(raw));
  const base = `${instanceUrl}/services/data/${API_VERSION}/jobs/query`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // 1. Create the query job.
  const createRes = await fetch(base, {
    method: "POST",
    headers,
    body: JSON.stringify({ operation: "query", query: soql }),
  });
  if (!createRes.ok) throw new Error(`Bulk job create failed (${createRes.status}): ${(await createRes.text()).slice(0, 300)}`);
  const { id: jobId } = (await createRes.json()) as { id: string };

  // 2. Poll until complete (Bulk exports of ~600K rows take a couple minutes).
  const started = Date.now();
  for (;;) {
    await new Promise((r) => setTimeout(r, 5000));
    const st = await fetch(`${base}/${jobId}`, { headers });
    const j = (await st.json()) as { state: string; errorMessage?: string };
    if (j.state === "JobComplete") break;
    if (j.state === "Failed" || j.state === "Aborted") {
      throw new Error(`Bulk job ${j.state}: ${j.errorMessage ?? "no message"}`);
    }
    if (Date.now() - started > 30 * 60 * 1000) throw new Error("Bulk job timed out after 30 minutes");
  }

  // 3. Download results, paginated via the Sforce-Locator header.
  fs.writeFileSync(outPath, "");
  let locator: string | null = null;
  let first = true;
  for (;;) {
    const url = new URL(`${base}/${jobId}/results`);
    url.searchParams.set("maxRecords", "20000");
    if (locator) url.searchParams.set("locator", locator);
    const page = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "text/csv" } });
    if (!page.ok) throw new Error(`Bulk results fetch failed (${page.status})`);
    let text = await page.text();
    if (!first) {
      // Drop the repeated header row on subsequent pages.
      const nl = text.indexOf("\n");
      text = nl >= 0 ? text.slice(nl + 1) : "";
    }
    fs.appendFileSync(outPath, text);
    first = false;
    const next = page.headers.get("Sforce-Locator");
    if (!next || next === "null") break;
    locator = next;
  }
}
