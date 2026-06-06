/**
 * Full SF -> CRM migration that pulls EVERY field via describe + bulk export,
 * stores the lossless row JSON in sfDataJson, and also writes a curated set
 * of typed columns.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/migrate-sf-full.ts <entity>
 *
 * <entity>: contact | account | opportunity | lead
 *
 * Strategy:
 *   1. sf sobject describe → list of fields
 *   2. Chunk fields (200 max per SOQL) — pull bulk CSV for each chunk
 *   3. Merge CSVs by Id into a single JSON-per-row stream
 *   4. Postgres COPY-style raw SQL: INSERT ... ON CONFLICT (sfId) DO UPDATE
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import readline from "node:readline";
import crypto from "node:crypto";
import { Client } from "pg";

function cuid(): string {
  // Compact, sortable, ~25 char id (close to Prisma's default cuid)
  return "c" + Date.now().toString(36) + crypto.randomBytes(10).toString("hex");
}

const ENTITY = process.argv[2];
const WHERE_CLAUSE = process.argv[3] ?? ""; // e.g. "WHERE CreatedDate >= 2025-01-01T00:00:00Z AND CreatedDate < 2026-01-01T00:00:00Z"
if (!ENTITY || !["contact", "account", "opportunity", "lead"].includes(ENTITY)) {
  console.error("Usage: tsx scripts/migrate-sf-full.ts <contact|account|opportunity|lead> [WHERE_CLAUSE]");
  process.exit(1);
}

const TABLE_MAP: Record<string, string> = {
  contact: "Contact",
  account: "Account",
  opportunity: "Opportunity",
  lead: "Lead",
};

const SF_OBJECT_MAP: Record<string, string> = {
  contact: "Contact",
  account: "Account",
  opportunity: "Opportunity",
  lead: "Lead",
};

const CHUNK_SUFFIX = WHERE_CLAUSE ? "-" + crypto.createHash("sha1").update(WHERE_CLAUSE).digest("hex").slice(0, 12) : "";
const CSV_DIR = `/tmp/sf-${ENTITY}-full${CHUNK_SUFFIX}`;
const TABLE = TABLE_MAP[ENTITY];
const SF_OBJECT = SF_OBJECT_MAP[ENTITY];

function listFields(): string[] {
  const res = spawnSync("sf", ["sobject", "describe", "--target-org", "coastal", "-s", SF_OBJECT, "--json"], {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
  if (res.status !== 0) {
    console.error("describe failed");
    process.exit(1);
  }
  const data = JSON.parse(res.stdout);
  // Drop the compound parent fields (address/location/Name) but KEEP their parts (FirstName, LastName, BillingStreet, etc.)
  return data.result.fields
    .filter((f: { name: string; type: string; nameField?: boolean }) =>
      f.type !== "address" && f.type !== "location" && f.name !== "Name",
    )
    .map((f: { name: string }) => f.name);
}

function exportChunk(fields: string[], chunkIdx: number): string {
  const outFile = `${CSV_DIR}/chunk-${chunkIdx}.csv`;
  if (fs.existsSync(outFile) && fs.statSync(outFile).size > 100) {
    console.log(`  [reuse] chunk ${chunkIdx}: ${(fs.statSync(outFile).size / 1024 / 1024).toFixed(1)} MB`);
    return outFile;
  }
  const soql = `SELECT ${fields.join(",")} FROM ${SF_OBJECT} ${WHERE_CLAUSE}`;
  console.log(`  [export] chunk ${chunkIdx} (${fields.length} fields)…`);
  const r = spawnSync(
    "sf",
    ["data", "export", "bulk", "--target-org", "coastal", "--query", soql, "--result-format", "csv", "--output-file", outFile, "--wait", "240"],
    { stdio: "inherit" },
  );
  if (r.status !== 0) {
    console.error(`Export failed for chunk ${chunkIdx}`);
    process.exit(1);
  }
  console.log(`  [done] chunk ${chunkIdx}: ${(fs.statSync(outFile).size / 1024 / 1024).toFixed(1)} MB`);
  return outFile;
}

function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else if (c === ",") { out.push(cur); cur = ""; }
    else if (c === '"') inQuotes = true;
    else cur += c;
  }
  out.push(cur);
  return out;
}

async function mergeChunksToJson(chunkFiles: string[]): Promise<Map<string, Record<string, string>>> {
  const result = new Map<string, Record<string, string>>();
  for (const file of chunkFiles) {
    const stream = fs.createReadStream(file);
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let headers: string[] | null = null;
    for await (const line of rl) {
      if (!line.trim()) continue;
      const cells = parseLine(line);
      if (!headers) { headers = cells; continue; }
      const id = cells[headers.indexOf("Id")];
      if (!id) continue;
      const row = result.get(id) ?? {};
      for (let i = 0; i < headers.length; i++) {
        if (cells[i] !== undefined && cells[i] !== "") row[headers[i]] = cells[i];
      }
      result.set(id, row);
    }
  }
  return result;
}

/** Map an SF row's JSON onto our typed columns. */
function mapTypedColumns(sf: Record<string, string>): Record<string, unknown> {
  const num = (v: string | undefined) => (v && !Number.isNaN(Number(v)) ? Number(v) : null);
  const date = (v: string | undefined) => (v ? new Date(v) : null);
  const bool = (v: string | undefined) => (v === "true" ? true : v === "false" ? false : null);
  const now = new Date();
  const baseTimestamps = { createdAt: now, updatedAt: now };

  if (ENTITY === "contact") {
    return {
      firstName: sf.FirstName || "",
      lastName: sf.LastName || "Unknown",
      fullName: `${sf.FirstName || ""} ${sf.LastName || ""}`.trim() || "Unknown",
      email: sf.Email || null,
      phone: sf.Phone || null,
      mobilePhone: sf.MobilePhone || null,
      title: sf.Title || null,
      birthdate: date(sf.Birthdate),
      isActive: true,
      ...baseTimestamps,
    };
  }
  if (ENTITY === "account") {
    return {
      name: sf.Name || "Unnamed Account",
      phone: sf.Phone || null,
      website: sf.Website || null,
      industry: sf.Industry || null,
      annualRevenue: num(sf.AnnualRevenue),
      numberOfEmployees: num(sf.NumberOfEmployees),
      billingStreet: sf.BillingStreet || null,
      billingCity: sf.BillingCity || null,
      billingState: sf.BillingState || null,
      billingZip: sf.BillingPostalCode || null,
      billingCountry: sf.BillingCountry || "US",
      ...baseTimestamps,
    };
  }
  if (ENTITY === "opportunity") {
    return {
      name: sf.Name || "Unnamed Opp",
      stage: sf.StageName || "Working Opportunity",
      totalDebt: num(sf.Total_Debt__c),
      currentTotalDebt: num(sf.Current_Total_Debt__c),
      estimatedTotalDebt: num(sf.Estimated_Total_Debt__c),
      currentWeeklyPayment: num(sf.Current_Weekly_Payment__c),
      currentMonthlyPayment: num(sf.Current_Monthly_Payment__c),
      weeklyPaymentToDebtRatio: num(sf.Weekly_Payment_To_Debt_Ratio__c),
      expectedCloseDate: date(sf.CloseDate),
      closeDate: date(sf.CloseDate),
      firstDraftDate: date(sf.First_Draft_Date__c),
      firstContractSignedDateOpp: date(sf.First_Contract_Signed_Date__c),
      lastContactedAt: date(sf.Last_Contacted_DateTime__c),
      lastCallAt: date(sf.Last_Call__c),
      lastEmailAt: date(sf.Last_Email__c),
      lastSmsAt: date(sf.Last_SMS__c),
      probability: num(sf.Probability),
      oppPhone: sf.Phone__c || null,
      oppEmail: sf.Email__c || null,
      subDisposition: sf.Sub_Disposition__c || null,
      fronter: sf.Fronter__c || null,
      closer: sf.Closer__c || null,
      callTransferStatus: sf.Call_Transfer_Status__c || null,
      transferQualification: sf.Transfer_Qualification__c || null,
      sfLeadIdText: sf.Lead_Id__c || null,
      leadSource: sf.LeadSource || null,
      leadSourceCategory: sf.Lead_Source_Category__c || null,
      legalPlanRequired: bool(sf.Legal_Plan_Required__c),
      addendumRequired: bool(sf.Addendum_Required__c),
      securedParty: sf.Secured_Party__c || null,
      highUccRisk: bool(sf.HIGH_UCC_RISK__c),
      timezone: sf.Timezone__c || null,
      preferredLanguage: sf.Preferred_Language__c || null,
      preferredMethodOfContact: sf.Preferred_method_of_Contact__c || null,
      dialerGroup: sf.Dialer_Group__c || null,
      businessStartDate: date(sf.Business_Start_Date__c),
      processorInfo: sf.Processor_Info__c || null,
      lenderAgreementsCollected: sf.Lender_Agreements_Collected__c || null,
      statusWithLenders: sf.Status_with_Lender_s__c || null,
      firstPaymentToLegal: bool(sf.First_Payment_to_Legal__c),
      welcomeCallScheduled: date(sf.Welcome_Call_Scheduled__c),
      whatWasExplainedToClient: sf.What_was_explained_to_client__c || null,
      mainCompetitors: sf.MainCompetitors__c || null,
      deliveryInstallationStatus: sf.DeliveryInstallationStatus__c || null,
      cojOrTro: sf.COJ_or_TRO__c || null,
      summonsOrJudgment: sf.Summons_or_Judgment__c || null,
      orderNumber: sf.OrderNumber__c || null,
      currentGenerators: sf.CurrentGenerators__c || null,
      trackingNumber: sf.TrackingNumber__c || null,
      lossReason: sf.Loss_Reason__c || null,
      nextStep: sf.NextStep || null,
      isClosed: bool(sf.IsClosed),
      isWon: bool(sf.IsWon),
      amount: num(sf.Amount),
      notes: sf.Description || null,
      ...baseTimestamps,
    };
  }
  if (ENTITY === "lead") {
    const fn = sf.FirstName || "";
    const ln = sf.LastName || "Unknown";
    return {
      businessName: sf.Company || `${fn} ${ln}`.trim() || "Unknown",
      contactName: `${fn} ${ln}`.trim() || "Unknown",
      email: sf.Email || null,
      phone: sf.Phone || "0000000000",
      status: sf.Status || "New",
      source: sf.LeadSource || "OTHER",
      industry: sf.Industry || null,
      annualRevenue: num(sf.AnnualRevenue),
      ...baseTimestamps,
    };
  }
  return {};
}

async function main() {
  fs.mkdirSync(CSV_DIR, { recursive: true });

  console.log(`[${new Date().toISOString()}] Discovering ${SF_OBJECT} fields…`);
  const fields = listFields();
  console.log(`  ${fields.length} fields found.`);

  // SOQL has a ~10K char limit and Bulk has a ~200 field limit per query — chunk
  const idIndex = fields.indexOf("Id");
  if (idIndex >= 0) fields.splice(idIndex, 1);
  const CHUNK_SIZE = 100;
  const chunks: string[][] = [];
  for (let i = 0; i < fields.length; i += CHUNK_SIZE) {
    chunks.push(["Id", ...fields.slice(i, i + CHUNK_SIZE)]);
  }
  console.log(`  ${chunks.length} chunks × ~${CHUNK_SIZE} fields each`);

  const chunkFiles: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    chunkFiles.push(exportChunk(chunks[i], i));
  }

  console.log(`[${new Date().toISOString()}] Merging chunks → in-memory row map…`);
  const rows = await mergeChunksToJson(chunkFiles);
  console.log(`  ${rows.size} unique records`);

  console.log(`[${new Date().toISOString()}] Writing to Postgres…`);
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  let written = 0;
  let failed = 0;
  const ids = Array.from(rows.keys());
  const BATCH = 500;

  for (let i = 0; i < ids.length; i += BATCH) {
    const batchIds = ids.slice(i, i + BATCH);
    const values: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    for (const sfId of batchIds) {
      const sf = rows.get(sfId)!;
      const typed = mapTypedColumns(sf);
      const jsonStr = JSON.stringify(sf);
      params.push(cuid(), sfId, jsonStr, ...Object.values(typed));
      const cols = Object.keys(typed);
      const placeholders = [`$${p++}`, `$${p++}`, `$${p++}`, ...cols.map(() => `$${p++}`)];
      values.push(`(${placeholders.join(",")})`);
    }

    const colList = ['"id"', '"sfId"', '"sfDataJson"', ...Object.keys(mapTypedColumns(rows.get(batchIds[0])!)).map((c) => `"${c}"`)];
    const updateList = colList.filter((c) => c !== '"sfId"' && c !== '"id"').map((c) => `${c} = EXCLUDED.${c}`).join(", ");

    const sql = `INSERT INTO "${TABLE}" (${colList.join(",")}) VALUES ${values.join(",")} ON CONFLICT ("sfId") DO UPDATE SET ${updateList}`;
    try {
      await pg.query(sql, params);
      written += batchIds.length;
      if (written % 5000 < BATCH) console.log(`  ${written}/${rows.size} written`);
    } catch (e: unknown) {
      failed += batchIds.length;
      console.error(`  batch fail at ${i}:`, e instanceof Error ? e.message : "fail");
    }
  }

  console.log(`[${new Date().toISOString()}] DONE: ${written} written, ${failed} failed`);
  await pg.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
