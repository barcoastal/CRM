// One-time mirror of SF Docusign envelope statuses (dfsle__EnvelopeStatus__c)
// into our Envelope table (externalSource DOCUSIGN, idempotent on externalId),
// plus Opportunity.primaryContactId from OpportunityContactRole.
import pg from "pg";
import fs from "fs";
import crypto from "crypto";

const TOK = JSON.parse(fs.readFileSync("/tmp/sf-tok.json", "utf8"));
const DB = process.env.DATABASE_URL;
if (!DB) { console.error("Set DATABASE_URL"); process.exit(1); }

async function refreshToken() {
  const authUrl = fs.readFileSync("/tmp/sf-auth-url.txt", "utf8").trim();
  const m = authUrl.match(/^force:\/\/([^:]*)::([^@]+)@(.+)$/);
  const [, cid2, rt, host] = m;
  const res = await fetch(`https://${host}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: cid2 || "PlatformCLI", refresh_token: rt }),
  });
  const tok = await res.json();
  if (!tok.access_token) throw new Error("token refresh failed: " + JSON.stringify(tok).slice(0, 200));
  TOK.at = tok.access_token;
  fs.writeFileSync("/tmp/sf-tok.json", JSON.stringify({ url: TOK.url, at: TOK.at }));
  console.log("SF token refreshed");
}

const client = new pg.Client({ connectionString: DB });
await client.connect();

const sfFetch = async (url) => {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${TOK.at}` }, signal: AbortSignal.timeout(90000) });
      if (res.status === 401) { await refreshToken(); throw new Error("401, token refreshed"); }
      if (!res.ok) throw new Error(`SF ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return await res.json();
    } catch (e) {
      if (attempt >= 3) throw e;
      console.log(`retry ${attempt}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
};

console.log("loading id maps...");
const oppMap = new Map();
for (const r of (await client.query(`SELECT id, "sfId" FROM "Opportunity" WHERE "sfId" IS NOT NULL`)).rows) oppMap.set(r.sfId, r.id);
const acctMap = new Map();
for (const r of (await client.query(`SELECT id, "sfId" FROM "Account" WHERE "sfId" IS NOT NULL`)).rows) acctMap.set(r.sfId, r.id);
const leadMap = new Map();
for (const r of (await client.query(`SELECT id, "sfId" FROM "Lead" WHERE "sfId" IS NOT NULL`)).rows) leadMap.set(r.sfId, r.id);
const contactMap = new Map();
for (const r of (await client.query(`SELECT id, "sfId" FROM "Contact" WHERE "sfId" IS NOT NULL`)).rows) contactMap.set(r.sfId, r.id);
console.log(`maps: opp=${oppMap.size} acct=${acctMap.size} lead=${leadMap.size} contact=${contactMap.size}`);

const STATUS = { completed: "COMPLETED", sent: "SENT", delivered: "VIEWED", declined: "DECLINED", voided: "VOIDED", created: "DRAFT", signed: "SIGNED", correct: "SENT" };
const cid = () => "sfdx" + crypto.randomBytes(12).toString("hex");

// ---- Docusign envelope statuses ----
let url = `${TOK.url}/services/data/v59.0/query?q=${encodeURIComponent(
  "SELECT Id, Name, dfsle__Status__c, dfsle__EmailSubject__c, dfsle__Sent__c, dfsle__Completed__c, dfsle__SourceId__c, CreatedDate, LastModifiedDate FROM dfsle__EnvelopeStatus__c"
)}`;
let fetched = 0, inserted = 0, unmatched = 0;
while (url) {
  const data = await sfFetch(url);
  const rows = [];
  for (const rec of data.records) {
    const src = rec.dfsle__SourceId__c || "";
    const oppId = src.startsWith("006") ? oppMap.get(src) ?? null : null;
    const aId = src.startsWith("001") ? acctMap.get(src) ?? null : null;
    const lId = src.startsWith("00Q") ? leadMap.get(src) ?? null : null;
    if (!oppId && !aId && !lId) { unmatched++; continue; }
    const status = STATUS[(rec.dfsle__Status__c || "").toLowerCase()] ?? "SENT";
    rows.push([
      cid(), rec.Id, oppId, aId, lId, status,
      rec.dfsle__EmailSubject__c || rec.Name || "Docusign Envelope",
      rec.dfsle__Sent__c, rec.dfsle__Completed__c,
      status === "COMPLETED" ? rec.dfsle__Completed__c : null,
      rec.CreatedDate, rec.LastModifiedDate, cid() + cid(),
    ]);
  }
  if (rows.length) {
    const values = [];
    const params = [];
    rows.forEach((r, i) => {
      const b = i * 13;
      values.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, '', '', $${b + 7}, $${b + 8}::timestamptz, $${b + 9}::timestamptz, $${b + 10}::timestamptz, $${b + 11}::timestamptz, $${b + 12}::timestamptz, 'DOCUSIGN', $${b + 13})`);
      params.push(...r);
    });
    const res = await client.query(
      `INSERT INTO "Envelope" (id, "externalId", "opportunityId", "accountId", "leadId", status, "signerName", "signerEmail", "documentName", "sentAt", "completedAt", "signedAt", "createdAt", "updatedAt", "externalSource", "signingToken")
       VALUES ${values.join(",")}
       ON CONFLICT ("externalId") DO UPDATE SET status = EXCLUDED.status, "completedAt" = EXCLUDED."completedAt", "signedAt" = EXCLUDED."signedAt", "updatedAt" = EXCLUDED."updatedAt"`,
      params,
    );
    inserted += res.rowCount;
  }
  fetched += data.records.length;
  url = data.nextRecordsUrl ? `${TOK.url}${data.nextRecordsUrl}` : null;
  if (fetched % 2000 === 0) console.log(`docusign: fetched=${fetched} upserted=${inserted} unmatched=${unmatched}`);
}
console.log(`DOCUSIGN DONE fetched=${fetched} upserted=${inserted} unmatched=${unmatched}`);

// ---- Opportunity primary contacts from OpportunityContactRole ----
url = `${TOK.url}/services/data/v59.0/query?q=${encodeURIComponent(
  "SELECT OpportunityId, ContactId, IsPrimary FROM OpportunityContactRole WHERE ContactId != null"
)}`;
const primary = new Map(); // oppSfId -> contactSfId (prefer IsPrimary)
let ocrFetched = 0;
while (url) {
  const data = await sfFetch(url);
  for (const rec of data.records) {
    if (rec.IsPrimary || !primary.has(rec.OpportunityId)) primary.set(rec.OpportunityId, rec.ContactId);
  }
  ocrFetched += data.records.length;
  url = data.nextRecordsUrl ? `${TOK.url}${data.nextRecordsUrl}` : null;
}
console.log(`ocr: fetched=${ocrFetched} unique opps=${primary.size}`);

await client.query(`CREATE TEMP TABLE ocr_patch (oppid text PRIMARY KEY, contactid text)`);
const entries = [...primary.entries()]
  .map(([o, c]) => [oppMap.get(o), contactMap.get(c)])
  .filter(([o, c]) => o && c);
console.log(`ocr: resolvable pairs=${entries.length}`);
for (let i = 0; i < entries.length; i += 2000) {
  const chunk = entries.slice(i, i + 2000);
  const values = [];
  const params = [];
  chunk.forEach((r, j) => { values.push(`($${j * 2 + 1}, $${j * 2 + 2})`); params.push(r[0], r[1]); });
  await client.query(`INSERT INTO ocr_patch (oppid, contactid) VALUES ${values.join(",")} ON CONFLICT (oppid) DO NOTHING`, params);
}
const upd = await client.query(`
  UPDATE "Opportunity" o SET "primaryContactId" = p.contactid
  FROM ocr_patch p WHERE o.id = p.oppid AND (o."primaryContactId" IS NULL OR o."primaryContactId" <> p.contactid)`);
console.log(`OCR DONE updated=${upd.rowCount}`);
await client.end();
