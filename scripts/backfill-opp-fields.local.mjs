// Backfill 60+ newly synced SF Opportunity fields into prod sfDataJson.
// Strategy: page through SF REST query results, then per page merge the new
// keys into the existing sfDataJson via a temp table + single UPDATE join
// (chunked SQL, not per-row Prisma, per the proxy performance rule).
import pg from "pg";
import fs from "fs";

const TOK = JSON.parse(fs.readFileSync("/tmp/sf-tok.json", "utf8"));
const DB = process.env.DATABASE_URL;
if (!DB) { console.error("Set DATABASE_URL"); process.exit(1); }

const FIELDS = [
  "DS_Buyout_Total_Program_Cost__c","DS_Buyout_Settlement_to_Creditors__c","DS_Buyout_Fee__c","DS_Buyout_Savings__c",
  "Lead_Vendor_ID_Text__c","Addendum_Required_Reason__c","UTM_Term__c","Commission_Payment_Date__c",
  "Commission_Payment_Date_Override__c","Commission_Payment_Override_Reason__c","Processor_Contract_Formula__c",
  "Processor__c","Hopper_priority_c__c","Outbound_ANI_Date__c","Outbound_ANI_From__c","Outbound_ANI_Identifier__c",
  "Re_shuffle_Opportunity__c","Re_shuffle_count__c","Number_Of_Days_From_First_ContractSigned__c",
  "Opportunity_Amended_DateTime__c","Opportunity_Reinstated_DateTime__c","Opportunity_Reactivated_DateTime__c",
  "Opportunity_Reshuffled_DateTime__c","Reactivate_Reason__c","Opportunity_Assignment_Date__c","Account_Status__c",
  "Ad_Click_Id__c","Eli_Ad_click__c","Has_Closer_Notes__c","Latest_Closer_Notes__c","FronterLookup__c","CloserLookup__c",
  "Call_Transferred_By__c","Call_Received_By__c","Call_Transferred_By_Lookup__c","Call_Received_By_Lookup__c",
  "Call_Tranferred_DateTime__c","Call_Received_Date__c","Call_Transfer_Status__c","Transfer_Qualification__c",
  "Last_Sub_Disposition__c","Last_Call__c","Last_Email__c","Last_SMS__c","Week_Days_Between_Last_Contacted_Date__c",
  "High_Lien_Risk__c","Receivables_Collection_Method__c","What_was_explained_to_client__c","Bank_Change__c",
  "Lender_Agreements_Collected__c","Status_with_Lender_s__c","COJ_or_TRO__c","First_Payment_to_Legal__c",
  "Summons_or_Judgment__c","Add_to_f9list_Id__c","Delete_from_f9list_id__c","Five9_List_Id__c","Lead_Created_Date__c",
  "CreatedById","LastModifiedById",
];


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

let client;
async function connectDb() {
  client = new pg.Client({ connectionString: DB });
  client.on("error", () => {});
  await client.connect();
  await client.query(`CREATE TEMP TABLE sf_patch (sfid text PRIMARY KEY, patch jsonb)`);
}
async function dbQuery(sql, params) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await client.query(sql, params);
    } catch (e) {
      if (attempt >= 4) throw e;
      console.log(`db reconnect after: ${e.message}`);
      try { await client.end(); } catch { /* already dead */ }
      await new Promise((r) => setTimeout(r, 3000));
      await connectDb();
    }
  }
}
await connectDb();

// Resume checkpoint: last SF Id fully processed.
const CKPT = "/tmp/opp-backfill-checkpoint.txt";
const lastId = fs.existsSync(CKPT) ? fs.readFileSync(CKPT, "utf8").trim() : "";

const soql = `SELECT Id, ${FIELDS.join(", ")} FROM Opportunity${lastId ? ` WHERE Id > '${lastId}'` : ""} ORDER BY Id`;
let url = `${TOK.url}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`;
let total = 0, updated = 0, page = 0;

while (url) {
  let res;
  for (let attempt = 1; ; attempt++) {
    try {
      res = await fetch(url, { headers: { Authorization: `Bearer ${TOK.at}` }, signal: AbortSignal.timeout(90000) });
      if (res.status === 401) { await refreshToken(); continue; }
      break;
    } catch (e) {
      if (attempt >= 3) throw e;
      console.log(`fetch retry ${attempt} after error: ${e.message}`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  if (!res.ok) { console.error("SF error", res.status, (await res.text()).slice(0, 300)); process.exit(1); }
  const data = await res.json();
  const rows = [];
  for (const rec of data.records) {
    const patch = {};
    for (const f of FIELDS) {
      const v = rec[f];
      if (v !== null && v !== undefined && v !== "") patch[f] = String(v);
    }
    if (Object.keys(patch).length > 0) rows.push([rec.Id, JSON.stringify(patch)]);
  }
  if (rows.length) {
    const values = [];
    const params = [];
    rows.forEach((r, i) => { values.push(`($${i * 2 + 1}, $${i * 2 + 2}::jsonb)`); params.push(r[0], r[1]); });
    await dbQuery(`INSERT INTO sf_patch (sfid, patch) VALUES ${values.join(",")} ON CONFLICT (sfid) DO UPDATE SET patch = EXCLUDED.patch`, params);
    const upd = await dbQuery(`
      UPDATE "Opportunity" o
      SET "sfDataJson" = (COALESCE(NULLIF(o."sfDataJson", '')::jsonb, '{}'::jsonb) || p.patch)::text
      FROM sf_patch p WHERE o."sfId" = p.sfid`);
    updated += upd.rowCount;
    await dbQuery(`TRUNCATE sf_patch`);
  }
  total += data.records.length;
  if (data.records.length) fs.writeFileSync(CKPT, data.records[data.records.length - 1].Id);
  page++;
  if (page % 10 === 0) console.log(`[${new Date().toISOString()}] pages=${page} fetched=${total} updated=${updated}`);
  url = data.nextRecordsUrl ? `${TOK.url}${data.nextRecordsUrl}` : null;
}
console.log(`DONE fetched=${total} updated=${updated}`);
await client.end();
