/**
 * Streaming Salesforce → CRM migration.
 *
 * Usage:
 *   DATABASE_URL=postgres://... npx tsx scripts/migrate-sf-objects.ts <entity>
 *
 * Entity: contact | account | opportunity | lead
 *
 * Strategy:
 *   1. Use SF Bulk API via `sf data query` to export the entity to /tmp CSV
 *   2. Stream-read the CSV row-by-row
 *   3. Batch upsert via Prisma (chunks of 500) keyed on sfId
 *   4. Print progress every 1000 rows
 *   5. Resume-safe: re-running picks up where it left off (upsert by sfId)
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import readline from "node:readline";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 20 });
const prisma = new PrismaClient({ adapter, log: ["warn", "error"] });

const ENTITY = process.argv[2];
if (!ENTITY || !["contact", "account", "opportunity", "lead"].includes(ENTITY)) {
  console.error("Usage: tsx scripts/migrate-sf-objects.ts <contact|account|opportunity|lead>");
  process.exit(1);
}

const SOQL: Record<string, string> = {
  contact: `SELECT Id, FirstName, LastName, Email, Phone, MobilePhone, Title, Birthdate, AccountId, OwnerId FROM Contact`,
  // Account: identity fields + the OPERATIONAL fields the record page + contracts
  // read (client status, program dates, processor ids, bank, escrow snapshot,
  // first payment). The full row is also stored as the sfDataJson snapshot so
  // every acctSf() fallback on the account page stays fresh.
  account: `SELECT Id, Name, Phone, Website, Industry, AnnualRevenue, NumberOfEmployees, BillingStreet, BillingCity, BillingState, BillingPostalCode, BillingCountry, BillingCounty__c, OwnerId, ParentId, Primary_Contact__c, Client_Status__c, Legal_Status__c, Legal_Network__c, Sync_Status__c, Synced_DateTime__c, Bank_Account_Sync_Status__c, Bank_Name__c, Bank_Routing_Number__c, Bank_Account_Number__c, Bank_Account_Type__c, IsChecking__c, Fee_Paid_In_Full__c, Escrow_Balance__c, Escrow_Balance_Pulled_Date_Time__c, Total_Debt__c, Program_Start_Date__c, Program_End_Date__c, Program_Completion_Stage__c, External_RAM_Id__c, External_SAS_Id__c, External_Citadel_Id__c, Client_Number__c, Lead_Number__c, First_Contract_Signed_Date__c, First_Draft_Date__c, First_Payment_Completed_Date__c, Completed_Draft_Count__c, EIN_Number_Tax_Id__c, SSN__c, Closer__c, Closer_FIrst_Name__c, Collection_Agency__c, Qualified_Financial__c, HIGH_UCC_RISK__c, Status__c, Sub_Disposition__c, Owner_Full_Name__c, Primary_Contact_Name__c, Last_Call__c, Last_Email__c, Last_SMS__c, Last_Contacted_DateTime__c, AccountSource, RecordTypeId, CreatedDate, LastModifiedDate FROM Account`,
  // Opportunity: identity + the operational fields the record page reads via
  // oppSf() - the full row is snapshotted into sfDataJson. NOTE: SF "Amount"
  // is NOT the debt; Total_Debt__c is (mapping Amount->totalDebt once showed
  // $290 instead of $408K).
  opportunity: `SELECT Id, Name, StageName, Amount, CloseDate, AccountId, OwnerId, Description, LeadSource, Probability, ExpectedRevenue, IsPrivate, NextStep, CampaignId, RecordTypeId, Total_Debt__c, Current_Total_Debt__c, Lead_Id__c, Phone_Formula__c, Formatted_Phone__c, Phone__c, Email_Formula__c, Email__c, Last_Disposition__c, Last_Disposition_DateTime__c, Lead_Source_Category__c, Preferred_method_of_Contact__c, Timezone__c, Legal_Plan_Required__c, Secured_Party__c, Current_Weekly_Payment__c, Current_Monthly_Payment__c, Weekly_Payment_To_Debt_Ratio__c, Preferred_Language__c, Dialer_Group__c, First_Draft_Date__c, First_Contract_Signed_Date__c, Version_Status__c, Fronter__c, Closer__c, Sub_Disposition__c, Business_Start_Date__c, HIGH_UCC_RISK__c, Call_ASAP__c, Addendum_Required__c, Welcome_Call_Scheduled__c, Type_of_Business__c, Processor_Info__c, Active_Opportunity__c, Verified_Phone_Number__c, Qualified_Financial_Formula__c, First_Payment_Completed__c, First_Payment_Completed_Date__c, Legal_Network__c, Affiliate__c, Last_Contacted_DateTime__c, CreatedDate, LastModifiedDate FROM Opportunity`,
  // Lead: identity + operational fields (dispositions, debt calc, five9, IPQS)
  // verified against the org describe; full row snapshotted into sfDataJson.
  lead: `SELECT Id, FirstName, LastName, Company, Email, Phone, Status, LeadSource, Industry, AnnualRevenue, OwnerId, IsConverted, ConvertedDate, SSN__c,Title,Street,City,State,PostalCode,Country,Timezone__c,IP_Address__c,Keyword__c,Secured_Party__c,Call_ASAP__c,Hopper_Priority__c,Outbound_ANI_Date__c,Outbound_ANI_Identifier__c,Outbound_ANI_From__c,Hubspot_Id__c,Append_Leads_Counter__c,Call_counter__c,Has_Calendly_Event__c,Is_Archived__c,Archived_Date__c,IPQS_IsActive__c,IPQS_Active_Status__c,IPQS_Carrier__c,IPQS_Email__c,IPQS_Fraud_Score__c,IPQS_Is_Prepaid__c,IPQS_Line_Type__c,IPQS_Is_Risky__c,IPQS_Is_VOIP__c,IPQS_Is_Valid__c,Lead_Score__c,Ad_Click_Id__c,Sync_To_Account_Engagement__c,Facebook_Lead_Id__c,Total_Dial_Attempts__c,Eli_Ad_click__c,Business_Start_Date__c,EIN_Number_Tax_Id__c,Monthly_Revenue__c,UCC_filing_Date__c,MCA_Amount__c,Estimated_Total_Debt__c,Current_Total_Monthly_Payment_Formula__c,Current_Total_Daily_Payment__c,Current_Total_Weekly_Payment__c,Total_Debt_Amount__c,Payment_Amount__c,Setup_Fee__c,Retainer_Percentage__c,Payment_Term__c,Frequency__c,Monthly_Bank_Fee__c,Program_Fee_Percentage__c,Settlement_Percentage__c,Down_Payment__c,FronterLookup__c,CloserLookup__c,Call_Transferred_By_Lookup__c,Call_Received_By_Lookup__c,Call_Tranferred_DateTime__c,Call_Received_Date__c,Call_Transfer_Status__c,Transfer_Qualification__c,Outbound_Call_Priority__c,Agent_Location__c,Reason_for_Disqualification__c,Dialer_Group__c,five9_Disposition__c,five9_Last_Disposition__c,Five9_Time_To_Call__c,Add_to_f9list_Id__c,Delete_from_f9list_id__c,Five9_List_Id__c,Five9_List_Updated_by_Convoso_Batch__c,Five9_Final_Stage__c,Lead_Assignment_Date__c,Verified_Phone_Number__c,MCA_Lender_External_Id__c,MobilePhone,Work_Phone__c,Fax,Alternate_Email__c,Preferred_method_of_Contact__c,Legal_Plan_Required__c,External_ID_15_digit__c,Preferred_Language__c,Gender__c,Lenders__c,Description,Sub_Disposition__c,Last_Disposition__c FROM Lead`,
};

const CSV_PATH = `/tmp/sf-${ENTITY}.csv`;

function exportFromSF(): void {
  console.log(`[${new Date().toISOString()}] Exporting ${ENTITY} from Salesforce (bulk API)…`);
  const result = spawnSync(
    "sf",
    [
      "data", "export", "bulk",
      "--target-org", "coastal",
      "--query", SOQL[ENTITY],
      "--result-format", "csv",
      "--output-file", CSV_PATH,
      "--wait", "120",
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    console.error("SF export failed");
    process.exit(1);
  }
  const size = fs.statSync(CSV_PATH).size;
  console.log(`[${new Date().toISOString()}] CSV written: ${(size / 1024 / 1024).toFixed(1)} MB`);
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

/** SF user 18-char Id -> CRM user.id (User.sfId populated by backfill-user-sfid.ts). */
async function loadUserMap(): Promise<Map<string, string>> {
  const users = await prisma.user.findMany({
    where: { sfId: { not: null } },
    select: { id: true, sfId: true },
  });
  const m = new Map<string, string>();
  for (const u of users) if (u.sfId) m.set(u.sfId, u.id);
  console.log(`[${new Date().toISOString()}] ${m.size} users mapped (sfId -> id)`);
  return m;
}

/** SF account Id -> CRM account.id (for parent/primary-account links). */
async function loadAccountMap(): Promise<Map<string, string>> {
  const rows = await prisma.account.findMany({ where: { sfId: { not: null } }, select: { id: true, sfId: true } });
  const m = new Map<string, string>();
  for (const r of rows) if (r.sfId) m.set(r.sfId, r.id);
  return m;
}

/** SF contact Id -> CRM contact.id (for account primary-contact links). */
async function loadContactMap(): Promise<Map<string, string>> {
  const rows = await prisma.contact.findMany({ where: { sfId: { not: null } }, select: { id: true, sfId: true } });
  const m = new Map<string, string>();
  for (const r of rows) if (r.sfId) m.set(r.sfId, r.id);
  return m;
}

async function migrateContacts(headers: string[], rl: readline.Interface): Promise<void> {
  const idx = (h: string) => headers.indexOf(h);
  const I = {
    Id: idx("Id"), FirstName: idx("FirstName"), LastName: idx("LastName"),
    Email: idx("Email"), Phone: idx("Phone"), MobilePhone: idx("MobilePhone"),
    Title: idx("Title"), Birthdate: idx("Birthdate"),
    AccountId: idx("AccountId"), OwnerId: idx("OwnerId"),
  };
  const users = await loadUserMap();
  const accounts = await loadAccountMap();
  let batch: Array<Record<string, unknown>> = [];
  let count = 0;

  async function flush() {
    if (batch.length === 0) return;
    const results = await Promise.allSettled(
      batch.map((c) =>
        prisma.contact.upsert({
          where: { sfId: c.sfId as string },
          update: c,
          create: c as never,
        }),
      ),
    );
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      console.error(`[${new Date().toISOString()}] ${failures.length}/${batch.length} contact upserts failed`);
      console.error((failures[0] as PromiseRejectedResult).reason?.message);
    }
    count += batch.length;
    batch = [];
    if (count % 5000 === 0) console.log(`[${new Date().toISOString()}] Contact: ${count} imported`);
  }

  for await (const line of rl) {
    if (!line.trim()) continue;
    const cells = parseLine(line);
    const sfId = cells[I.Id];
    if (!sfId) continue;
    const firstName = cells[I.FirstName] || "";
    const lastName = cells[I.LastName] || "Unknown";
    batch.push({
      sfId,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      email: cells[I.Email] || null,
      phone: cells[I.Phone] || null,
      mobilePhone: cells[I.MobilePhone] || null,
      title: cells[I.Title] || null,
      birthdate: cells[I.Birthdate] ? new Date(cells[I.Birthdate]) : null,
      isActive: true,
      ownerId: users.get(cells[I.OwnerId]) ?? null,
      primaryAccountId: accounts.get(cells[I.AccountId]) ?? null,
    });
    if (batch.length >= 50) await flush();
  }
  await flush();
  console.log(`[${new Date().toISOString()}] DONE Contact: ${count} total`);
}

async function migrateAccounts(headers: string[], rl: readline.Interface): Promise<void> {
  const idx = (h: string) => headers.indexOf(h);
  // Guard: if the CSV lacks the operational columns (stale/partial export),
  // ABORT - importing would overwrite good data with nulls.
  const required = ["Client_Status__c", "External_RAM_Id__c", "Program_Start_Date__c", "Escrow_Balance__c", "Bank_Name__c"];
  const missing = required.filter((h) => idx(h) === -1);
  if (missing.length) {
    throw new Error(`Account CSV missing operational columns (${missing.join(", ")}) - refusing to import. Delete ${CSV_PATH} and re-export.`);
  }
  const I = {
    Id: idx("Id"), Name: idx("Name"), Phone: idx("Phone"), Website: idx("Website"),
    Industry: idx("Industry"), AnnualRevenue: idx("AnnualRevenue"), NumberOfEmployees: idx("NumberOfEmployees"),
    BillingStreet: idx("BillingStreet"), BillingCity: idx("BillingCity"),
    BillingState: idx("BillingState"), BillingPostalCode: idx("BillingPostalCode"),
    BillingCountry: idx("BillingCountry"),
  };
  let batch: Array<Record<string, unknown>> = [];
  let count = 0;

  async function flush() {
    if (batch.length === 0) return;
    const aResults = await Promise.allSettled(
      batch.map((a) =>
        prisma.account.upsert({
          where: { sfId: a.sfId as string },
          update: a,
          create: a as never,
        }),
      ),
    );
    const aFail = aResults.filter((r) => r.status === "rejected");
    if (aFail.length > 0) console.error(`[${new Date().toISOString()}] ${aFail.length} account fails:`, (aFail[0] as PromiseRejectedResult).reason?.message);
    count += batch.length;
    batch = [];
    if (count % 5000 === 0) console.log(`[${new Date().toISOString()}] Account: ${count} imported`);
  }

  // Column index for every selected field so the full row can be snapshotted
  // into sfDataJson (keeps acctSf() reads on the account page fresh).
  const col = (h: string, cells: string[]): string => {
    const i = idx(h);
    return i >= 0 ? cells[i] ?? "" : "";
  };
  const d = (v: string): Date | null => (v ? new Date(v) : null);
  const n = (v: string): number | null => (v !== "" && !Number.isNaN(Number(v)) ? Number(v) : null);
  const b = (v: string): boolean => v.toLowerCase() === "true";

  // Relationship maps: SF ids -> CRM ids for owner / parent / primary contact.
  const users = await loadUserMap();
  const accounts = await loadAccountMap();
  const contacts = await loadContactMap();

  for await (const line of rl) {
    if (!line.trim()) continue;
    const cells = parseLine(line);
    const sfId = cells[I.Id];
    if (!sfId) continue;

    // Lossless snapshot of the whole selected row.
    const sfData: Record<string, string> = {};
    headers.forEach((h, i) => {
      const v = cells[i];
      if (v !== undefined && v !== "") sfData[h] = v;
    });

    batch.push({
      sfId,
      name: cells[I.Name] || "Unnamed Account",
      phone: cells[I.Phone] || null,
      website: cells[I.Website] || null,
      industry: cells[I.Industry] || null,
      annualRevenue: cells[I.AnnualRevenue] ? Number(cells[I.AnnualRevenue]) : null,
      numberOfEmployees: cells[I.NumberOfEmployees] ? Number(cells[I.NumberOfEmployees]) : null,
      billingStreet: cells[I.BillingStreet] || null,
      billingCity: cells[I.BillingCity] || null,
      billingState: cells[I.BillingState] || null,
      billingZip: cells[I.BillingPostalCode] || null,
      billingCountry: cells[I.BillingCountry] || "US",
      // Operational fields (SF is source of truth while both systems run).
      clientStatus: col("Client_Status__c", cells) || "Active",
      legalStatus: col("Legal_Status__c", cells) || null,
      bankAccountSyncStatus: col("Bank_Account_Sync_Status__c", cells) || null,
      bankName: col("Bank_Name__c", cells) || null,
      bankRoutingNumber: col("Bank_Routing_Number__c", cells) || null,
      bankAccountNumber: col("Bank_Account_Number__c", cells) || null,
      bankAccountType: col("Bank_Account_Type__c", cells) || null,
      feePaidInFull: b(col("Fee_Paid_In_Full__c", cells)),
      // escrowBalance column is non-nullable (default 0) - fall back to 0.
      escrowBalance: n(col("Escrow_Balance__c", cells)) ?? 0,
      escrowPulledAt: d(col("Escrow_Balance_Pulled_Date_Time__c", cells)),
      currentTotalDebt: n(col("Total_Debt__c", cells)),
      programStartDate: d(col("Program_Start_Date__c", cells)),
      programEndDate: d(col("Program_End_Date__c", cells)),
      externalRamId: col("External_RAM_Id__c", cells) || null,
      externalSasId: col("External_SAS_Id__c", cells) || null,
      ein: col("EIN_Number_Tax_Id__c", cells) || null,
      collectionAgency: col("Collection_Agency__c", cells) || null,
      highUccRisk: b(col("HIGH_UCC_RISK__c", cells)),
      // SF Health Check "First Payment Received" = this date being set.
      firstPaymentReceived: !!col("First_Payment_Completed_Date__c", cells),
      // Relationships (SF ids resolved to CRM ids; unresolved stay null and
      // converge on the next nightly run).
      ownerId: users.get(col("OwnerId", cells)) ?? null,
      parentAccountId: accounts.get(col("ParentId", cells)) ?? null,
      primaryContactId: contacts.get(col("Primary_Contact__c", cells)) ?? null,
      sfDataJson: JSON.stringify(sfData),
    });
    if (batch.length >= 50) await flush();
  }
  await flush();
  console.log(`[${new Date().toISOString()}] DONE Account: ${count} total`);
}

async function migrateOpportunities(headers: string[], rl: readline.Interface): Promise<void> {
  const idx = (h: string) => headers.indexOf(h);
  const I = {
    Id: idx("Id"), Name: idx("Name"), StageName: idx("StageName"), Amount: idx("Amount"),
    CloseDate: idx("CloseDate"), AccountId: idx("AccountId"), Description: idx("Description"),
    OwnerId: idx("OwnerId"),
  };
  console.log(`[${new Date().toISOString()}] Loading account map…`);
  const accountMap = new Map<string, string>();
  const accounts = await prisma.account.findMany({ where: { sfId: { not: null } }, select: { id: true, sfId: true } });
  for (const a of accounts) if (a.sfId) accountMap.set(a.sfId, a.id);
  console.log(`[${new Date().toISOString()}] ${accountMap.size} accounts loaded.`);

  // Guard: refuse a stale/partial export (would null-overwrite good data).
  const requiredOpp = ["Total_Debt__c", "Current_Weekly_Payment__c", "Last_Disposition__c", "Version_Status__c"];
  const missingOpp = requiredOpp.filter((h) => idx(h) === -1);
  if (missingOpp.length) {
    throw new Error(`Opportunity CSV missing operational columns (${missingOpp.join(", ")}) - refusing to import. Delete the CSV and re-export.`);
  }
  const col = (h: string): number => idx(h);
  const users = await loadUserMap();
  let batch: Array<Record<string, unknown>> = [];
  let count = 0;
  let skipped = 0;

  async function flush() {
    if (batch.length === 0) return;
    // UPSERT (not createMany/skipDuplicates) so stage/amount/owner changes in
    // SF refresh existing CRM deals nightly, not just brand-new ones.
    const results = await Promise.allSettled(
      batch.map((o) =>
        prisma.opportunity.upsert({
          where: { sfId: o.sfId as string },
          update: o,
          create: o as never,
        }),
      ),
    );
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      console.error(`[${new Date().toISOString()}] ${failures.length}/${batch.length} opp upserts failed:`, (failures[0] as PromiseRejectedResult).reason?.message);
    }
    count += batch.length;
    batch = [];
    if (count % 5000 === 0) console.log(`[${new Date().toISOString()}] Opportunity: ${count} imported, ${skipped} skipped`);
  }

  for await (const line of rl) {
    if (!line.trim()) continue;
    const cells = parseLine(line);
    const sfId = cells[I.Id];
    if (!sfId) continue;
    const sfAccountId = cells[I.AccountId];
    const accountId = sfAccountId ? accountMap.get(sfAccountId) : null;
    if (!accountId) { skipped++; continue; }
    // Lossless snapshot for oppSf() reads on the record page.
    const sfData: Record<string, string> = {};
    headers.forEach((h, i) => {
      const v = cells[i];
      if (v !== undefined && v !== "") sfData[h] = v;
    });
    const g = (h: string): string => { const i = col(h); return i >= 0 ? cells[i] ?? "" : ""; };
    const num = (v: string): number | null => (v !== "" && !Number.isNaN(Number(v)) ? Number(v) : null);

    batch.push({
      sfId,
      accountId,
      name: cells[I.Name] || "Unnamed Opp",
      stage: cells[I.StageName] || "Working Opportunity",
      // SF Amount is a separate money field; the DEBT lives in Total_Debt__c.
      amount: cells[I.Amount] ? Number(cells[I.Amount]) : null,
      totalDebt: num(g("Total_Debt__c")),
      currentTotalDebt: num(g("Current_Total_Debt__c")) ?? num(g("Total_Debt__c")),
      probability: num(g("Probability")),
      currentWeeklyPayment: num(g("Current_Weekly_Payment__c")),
      currentMonthlyPayment: num(g("Current_Monthly_Payment__c")),
      weeklyPaymentToDebtRatio: num(g("Weekly_Payment_To_Debt_Ratio__c")),
      sfLeadIdText: g("Lead_Id__c") || null,
      expectedCloseDate: cells[I.CloseDate] ? new Date(cells[I.CloseDate]) : null,
      firstDraftDate: g("First_Draft_Date__c") ? new Date(g("First_Draft_Date__c")) : null,
      firstContractSignedDateOpp: g("First_Contract_Signed_Date__c") ? new Date(g("First_Contract_Signed_Date__c")) : null,
      lastContactedAt: g("Last_Contacted_DateTime__c") ? new Date(g("Last_Contacted_DateTime__c")) : null,
      notes: cells[I.Description] || null,
      assignedToId: users.get(cells[I.OwnerId]) ?? null,
      sfDataJson: JSON.stringify(sfData),
    });
    if (batch.length >= 50) await flush();
  }
  await flush();
  console.log(`[${new Date().toISOString()}] DONE Opportunity: ${count} total, ${skipped} skipped (no matching Account)`);
}

async function migrateLeads(headers: string[], rl: readline.Interface): Promise<void> {
  const idx = (h: string) => headers.indexOf(h);
  const I = {
    Id: idx("Id"), FirstName: idx("FirstName"), LastName: idx("LastName"), Company: idx("Company"),
    Email: idx("Email"), Phone: idx("Phone"), Status: idx("Status"), LeadSource: idx("LeadSource"),
    Industry: idx("Industry"), AnnualRevenue: idx("AnnualRevenue"), IsConverted: idx("IsConverted"),
    ConvertedDate: idx("ConvertedDate"), OwnerId: idx("OwnerId"),
  };
  // Guard: refuse a stale/partial export (would null-overwrite good data).
  const requiredLead = ["Last_Disposition__c", "Estimated_Total_Debt__c", "five9_Disposition__c"];
  const missingLead = requiredLead.filter((h) => idx(h) === -1);
  if (missingLead.length) {
    throw new Error(`Lead CSV missing operational columns (${missingLead.join(", ")}) - refusing to import.`);
  }
  const users = await loadUserMap();
  let batch: Array<Record<string, unknown>> = [];
  let count = 0;

  async function flush() {
    if (batch.length === 0) return;
    // Upsert so status/owner changes in SF refresh existing leads (slow on the
    // full 600K table - runs on the mini overnight).
    const results = await Promise.allSettled(
      batch.map((l) =>
        prisma.lead.upsert({
          where: { sfId: l.sfId as string },
          update: l,
          create: l as never,
        }),
      ),
    );
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      console.error(`[${new Date().toISOString()}] ${failures.length}/${batch.length} lead upserts failed:`, (failures[0] as PromiseRejectedResult).reason?.message);
    }
    count += batch.length;
    batch = [];
    if (count % 50000 < 100) console.log(`[${new Date().toISOString()}] Lead: ${count} imported`);
  }

  for await (const line of rl) {
    if (!line.trim()) continue;
    const cells = parseLine(line);
    const sfId = cells[I.Id];
    if (!sfId) continue;
    const firstName = cells[I.FirstName] || "";
    const lastName = cells[I.LastName] || "Unknown";
    batch.push({
      sfId,
      businessName: cells[I.Company] || `${firstName} ${lastName}`.trim() || "Unknown",
      contactName: `${firstName} ${lastName}`.trim() || "Unknown",
      email: cells[I.Email] || null,
      phone: cells[I.Phone] || "0000000000",
      status: cells[I.Status] || "New",
      source: cells[I.LeadSource] || null,
      industry: cells[I.Industry] || null,
      annualRevenue: cells[I.AnnualRevenue] ? Number(cells[I.AnnualRevenue]) : null,
      assignedToId: users.get(cells[I.OwnerId]) ?? null,
      sfDataJson: JSON.stringify(Object.fromEntries(headers.map((h, i) => [h, cells[i]]).filter(([, v]) => v !== undefined && v !== ""))),
    });
    if (batch.length >= 50) await flush();
  }
  await flush();
  console.log(`[${new Date().toISOString()}] DONE Lead: ${count} total`);
}

async function main() {
  // ALWAYS re-export. Reusing a stale CSV once caused a mass null-overwrite:
  // the import mapped columns missing from an old export to null and wiped
  // operational fields across all accounts. Fresh export or nothing.
  if (fs.existsSync(CSV_PATH)) fs.unlinkSync(CSV_PATH);
  exportFromSF();

  const stream = fs.createReadStream(CSV_PATH);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const iter = rl[Symbol.asyncIterator]();
  const first = await iter.next();
  if (first.done) {
    console.error("Empty CSV");
    process.exit(1);
  }
  const headers = parseLine(first.value as string);
  console.log(`Headers: ${headers.join(", ")}`);

  // wrap remainder as async iterable
  const rest: AsyncIterable<string> = { [Symbol.asyncIterator]: () => iter };

  if (ENTITY === "contact") await migrateContacts(headers, rest as readline.Interface);
  if (ENTITY === "account") await migrateAccounts(headers, rest as readline.Interface);
  if (ENTITY === "opportunity") await migrateOpportunities(headers, rest as readline.Interface);
  if (ENTITY === "lead") await migrateLeads(headers, rest as readline.Interface);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
