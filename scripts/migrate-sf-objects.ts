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

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 20 });
const prisma = new PrismaClient({ adapter, log: ["warn", "error"] });

const ENTITIES_ALL = ["contact", "account", "opportunity", "lead", "programplan", "draft", "debt", "fee", "case", "task", "event", "emailmessage", "accounthistory"];
const ENTITY = process.argv[2];
if (!ENTITY || !ENTITIES_ALL.includes(ENTITY)) {
  console.error(`Usage: tsx scripts/migrate-sf-objects.ts <${ENTITIES_ALL.join("|")}>`);
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
  // Related records per account: debts, fees, cases, activities, emails - so
  // every SF account related list has a CRM counterpart.
  debt: `SELECT Id, Opportunity__c, Program_Plan__c, Account__c, Creditor_Name__c, Creditor_Name_Formula__c, Account_Number__c, Debt_Amount__c, Original_Debt__c, Payment__c, Payment_Frequency__c, Debt_Status__c, Negotiation_Status__c, Legal_Status__c, Include_in_the_Program__c, Settlement_Amount__c, Settlement_Percentage__c, Total_Savings__c, Total_Savings_Percentage__c, CreatedDate FROM Debt_Details__c`,
  fee: `SELECT Id, RecordTypeId, Program_Plan__c, Draft__c, Account__c, Fee_Amount__c, Fee_Date__c, Fee_Status__c, CreatedDate FROM Fee__c`,
  case: `SELECT Id, CaseNumber, Subject, Description, Status, Priority, Origin, AccountId, OwnerId, Draft__c, CreatedDate, ClosedDate FROM Case`,
  task: `SELECT Id, Subject, Status, Priority, Type, TaskSubtype, CallType, CallDisposition, ActivityDate, CompletedDateTime, Description, OwnerId, AccountId, WhoId, WhatId, RecordTypeId, CreatedDate FROM Task WHERE AccountId != null`,
  event: `SELECT Id, Subject, Description, Location, StartDateTime, EndDateTime, ActivityDate, AccountId, WhoId, WhatId, OwnerId, CreatedDate FROM Event`,
  emailmessage: `SELECT Id, FromAddress, FromName, ToAddress, CcAddress, Subject, TextBody, Incoming, Status, MessageDate, RelatedToId, CreatedDate FROM EmailMessage`,
  // Program Plan + Draft: the actual payment schedule/history ("payments done
  // or not done") so the CRM's live payment grid matches SF exactly.
  programplan: `SELECT Id, Client__c, Opportunity__c, Payment_Processor__c, First_Payment_Date__c, Payment_Term__c, Weekly_Draft_Amount__c, Setup_Fee__c, Program_Fee_Percentage__c, Completed_Drafts_Amount__c, Completed_Drafts_Count__c, Last_Completed_Draft_Date__c, Next_Draft_Date__c, Debit_Schedule_Id__c, DS_Total_Draft_Amount__c, DS_Total_Escrow_Amount__c, CreatedDate, LastModifiedDate FROM Program_Plan__c`,
  draft: `SELECT Id, Program_Plan__c, Account__c, Draft_Date__c, Draft_Amount__c, Draft_Total_Amount__c, Draft_Status__c, Sync_Status__c, Program_Fee__c, Retainer_Fee__c, Setup_Fee__c, Processor_Fee__c, Service_Fee__c, Citadel_Fee__c, DS_Escrow_Amount__c, Draft_Cleared_Date__c, External_SAS_Id__c, External_RAM_Id__c, Retainer_SetupFee_Draft__c, CreatedDate, LastModifiedDate FROM Draft__c`,
  lead: `SELECT Id, FirstName, LastName, Company, Email, Phone, Status, LeadSource, Industry, AnnualRevenue, OwnerId, IsConverted, ConvertedDate, SSN__c,Title,Street,City,State,PostalCode,Country,Timezone__c,IP_Address__c,Keyword__c,Secured_Party__c,Call_ASAP__c,Hopper_Priority__c,Outbound_ANI_Date__c,Outbound_ANI_Identifier__c,Outbound_ANI_From__c,Hubspot_Id__c,Append_Leads_Counter__c,Call_counter__c,Has_Calendly_Event__c,Is_Archived__c,Archived_Date__c,IPQS_IsActive__c,IPQS_Active_Status__c,IPQS_Carrier__c,IPQS_Email__c,IPQS_Fraud_Score__c,IPQS_Is_Prepaid__c,IPQS_Line_Type__c,IPQS_Is_Risky__c,IPQS_Is_VOIP__c,IPQS_Is_Valid__c,Lead_Score__c,Ad_Click_Id__c,Sync_To_Account_Engagement__c,Facebook_Lead_Id__c,Total_Dial_Attempts__c,Eli_Ad_click__c,Business_Start_Date__c,EIN_Number_Tax_Id__c,Monthly_Revenue__c,UCC_filing_Date__c,MCA_Amount__c,Estimated_Total_Debt__c,Current_Total_Monthly_Payment_Formula__c,Current_Total_Daily_Payment__c,Current_Total_Weekly_Payment__c,Total_Debt_Amount__c,Payment_Amount__c,Setup_Fee__c,Retainer_Percentage__c,Payment_Term__c,Frequency__c,Monthly_Bank_Fee__c,Program_Fee_Percentage__c,Settlement_Percentage__c,Down_Payment__c,FronterLookup__c,CloserLookup__c,Call_Transferred_By_Lookup__c,Call_Received_By_Lookup__c,Call_Tranferred_DateTime__c,Call_Received_Date__c,Call_Transfer_Status__c,Transfer_Qualification__c,Outbound_Call_Priority__c,Agent_Location__c,Reason_for_Disqualification__c,Dialer_Group__c,five9_Disposition__c,five9_Last_Disposition__c,Five9_Time_To_Call__c,Add_to_f9list_Id__c,Delete_from_f9list_id__c,Five9_List_Id__c,Five9_List_Updated_by_Convoso_Batch__c,Five9_Final_Stage__c,Lead_Assignment_Date__c,Verified_Phone_Number__c,MCA_Lender_External_Id__c,MobilePhone,Work_Phone__c,Fax,Alternate_Email__c,Preferred_method_of_Contact__c,Legal_Plan_Required__c,External_ID_15_digit__c,Preferred_Language__c,Gender__c,Lenders__c,Description,Sub_Disposition__c,Last_Disposition__c FROM Lead`,
};

const CSV_PATH = `/tmp/sf-${ENTITY}.csv`;

async function exportFromSF(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Exporting ${ENTITY} from Salesforce (bulk API)…`);
  if (process.env.SF_AUTH_URL) {
    // Containerized path (Railway): direct Bulk API 2.0 REST - no sf CLI.
    const { bulkQueryToCsv } = await import("../src/lib/sf-sync/bulk-export");
    await bulkQueryToCsv(SOQL[ENTITY], CSV_PATH);
  } else {
    // Local path: authenticated sf CLI.
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
  }
  const size = fs.statSync(CSV_PATH).size;
  console.log(`[${new Date().toISOString()}] CSV written: ${(size / 1024 / 1024).toFixed(1)} MB`);
}

/**
 * Streaming RFC-4180 CSV record reader. Handles quoted fields containing
 * commas, escaped quotes ("") AND NEWLINES - the line-based parser this
 * replaces split records at embedded newlines (long-text SF fields like
 * Description), which polluted the DB with garbage rows.
 */
export async function* csvRecords(path: string): AsyncGenerator<string[]> {
  const stream = fs.createReadStream(path, { encoding: "utf8", highWaterMark: 1 << 20 });
  let cur = "";
  let fields: string[] = [];
  let inQuotes = false;
  let pendingQuote = false;

  for await (const chunk of stream as AsyncIterable<string>) {
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk[i];
      if (pendingQuote) {
        pendingQuote = false;
        if (c === '"') { cur += '"'; continue; } // escaped quote
        inQuotes = false; // closing quote; fall through to handle c normally
      }
      if (inQuotes) {
        if (c === '"') pendingQuote = true;
        else cur += c;
        continue;
      }
      if (c === '"') inQuotes = true;
      else if (c === ",") { fields.push(cur); cur = ""; }
      else if (c === "\n") {
        fields.push(cur);
        cur = "";
        if (fields.length > 1 || fields[0] !== "") yield fields;
        fields = [];
      } else if (c !== "\r") cur += c;
    }
  }
  if (cur !== "" || fields.length > 0) {
    fields.push(cur);
    if (fields.length > 1 || fields[0] !== "") yield fields;
  }
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

async function migrateContacts(headers: string[], records: AsyncIterable<string[]>): Promise<void> {
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

  for await (const cells of records) {
    const sfId = cells[I.Id];
    if (!sfId || !/^[a-zA-Z0-9]{15,18}$/.test(sfId)) continue; // skip malformed rows
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

async function migrateAccounts(headers: string[], records: AsyncIterable<string[]>): Promise<void> {
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

  for await (const cells of records) {
    const sfId = cells[I.Id];
    if (!sfId || !/^[a-zA-Z0-9]{15,18}$/.test(sfId)) continue; // skip malformed rows

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

async function migrateOpportunities(headers: string[], records: AsyncIterable<string[]>): Promise<void> {
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

  for await (const cells of records) {
    const sfId = cells[I.Id];
    if (!sfId || !/^[a-zA-Z0-9]{15,18}$/.test(sfId)) continue; // skip malformed rows
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

async function migrateLeads(headers: string[], records: AsyncIterable<string[]>): Promise<void> {
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

  for await (const cells of records) {
    const sfId = cells[I.Id];
    if (!sfId || !/^[a-zA-Z0-9]{15,18}$/.test(sfId)) continue; // skip malformed rows
    const firstName = cells[I.FirstName] || "";
    const lastName = cells[I.LastName] || "Unknown";
    batch.push({
      sfId,
      businessName: cells[I.Company] || `${firstName} ${lastName}`.trim() || "Unknown",
      contactName: `${firstName} ${lastName}`.trim() || "Unknown",
      email: cells[I.Email] || null,
      phone: cells[I.Phone] || "0000000000",
      status: cells[I.Status] || "New",
      // source is NOT NULL (default OTHER) - null here kills the whole upsert.
      source: cells[I.LeadSource] || "OTHER",
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

/** SF opportunity Id -> CRM opportunity.id (for program-plan links). */
async function loadOpportunityMap(): Promise<Map<string, string>> {
  const rows = await prisma.opportunity.findMany({ where: { sfId: { not: null } }, select: { id: true, sfId: true } });
  const m = new Map<string, string>();
  for (const r of rows) if (r.sfId) m.set(r.sfId, r.id);
  return m;
}

/**
 * SF Payment_Processor__c Id -> CRM PaymentProcessor.id. The three SF
 * processor records are fixed; ensure matching CRM rows exist.
 */
async function loadProcessorMap(): Promise<Map<string, string>> {
  const SF_PROCESSORS: Array<[string, string, string]> = [
    ["a0W8Y00000Sbq8WUAR", "SAS", "SAS Processor"],
    ["a0WVO000000affm2AA", "RAM", "RAM Processor"],
    ["a0WVO000003zZS92AM", "LAPP", "LAPP Processor"],
  ];
  const m = new Map<string, string>();
  for (const [sfId, code, name] of SF_PROCESSORS) {
    const row = await prisma.paymentProcessor.upsert({
      where: { code },
      update: {},
      create: { code, name },
    });
    m.set(sfId, row.id);
  }
  return m;
}

async function migrateProgramPlans(headers: string[], records: AsyncIterable<string[]>): Promise<void> {
  const idx = (h: string) => headers.indexOf(h);
  const required = ["Client__c", "Weekly_Draft_Amount__c", "Debit_Schedule_Id__c"];
  const missing = required.filter((h) => idx(h) === -1);
  if (missing.length) throw new Error(`ProgramPlan CSV missing columns (${missing.join(", ")}) - refusing to import.`);
  const accounts = await loadAccountMap();
  const opps = await loadOpportunityMap();
  const processors = await loadProcessorMap();
  let batch: Array<Record<string, unknown>> = [];
  let count = 0;
  let skipped = 0;

  async function flush() {
    if (batch.length === 0) return;
    const results = await Promise.allSettled(
      batch.map((p) =>
        prisma.programPlan.upsert({ where: { sfId: p.sfId as string }, update: p, create: p as never }),
      ),
    );
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      console.error(`[${new Date().toISOString()}] ${failures.length}/${batch.length} plan upserts failed:`, (failures[0] as PromiseRejectedResult).reason?.message);
    }
    count += batch.length;
    batch = [];
    if (count % 5000 === 0) console.log(`[${new Date().toISOString()}] ProgramPlan: ${count} imported, ${skipped} skipped`);
  }

  for await (const cells of records) {
    const g = (h: string): string => { const i = idx(h); return i >= 0 ? cells[i] ?? "" : ""; };
    const sfId = g("Id");
    if (!sfId || !/^[a-zA-Z0-9]{15,18}$/.test(sfId)) continue;
    const accountId = accounts.get(g("Client__c"));
    if (!accountId) { skipped++; continue; }
    const num = (v: string): number | null => (v !== "" && !Number.isNaN(Number(v)) ? Number(v) : null);
    const term = num(g("Payment_Term__c"));
    batch.push({
      sfId,
      accountId,
      opportunityId: opps.get(g("Opportunity__c")) ?? null,
      processorId: processors.get(g("Payment_Processor__c")) ?? null,
      status: "ACTIVE",
      startDate: g("First_Payment_Date__c") ? new Date(g("First_Payment_Date__c")) : new Date(g("CreatedDate") || Date.now()),
      firstDraftDate: g("First_Payment_Date__c") ? new Date(g("First_Payment_Date__c")) : null,
      termMonths: term && term > 0 ? Math.round(term) : 6,
      // SF plans draft weekly; Weekly_Draft_Amount__c is the recurring amount.
      monthlyAmount: num(g("Weekly_Draft_Amount__c")) ?? 0,
      totalProgramCost: num(g("DS_Total_Draft_Amount__c")),
      completedPaymentsCount: Math.round(num(g("Completed_Drafts_Count__c")) ?? 0),
      externalDebitScheduleId: g("Debit_Schedule_Id__c") || null,
    });
    if (batch.length >= 50) await flush();
  }
  await flush();
  console.log(`[${new Date().toISOString()}] DONE ProgramPlan: ${count} total, ${skipped} skipped (no matching Account)`);
}

/** SF program-plan Id -> CRM programPlan.id (for draft links). */
async function loadPlanMap(): Promise<Map<string, string>> {
  const rows = await prisma.programPlan.findMany({ where: { sfId: { not: null } }, select: { id: true, sfId: true } });
  const m = new Map<string, string>();
  for (const r of rows) if (r.sfId) m.set(r.sfId, r.id);
  return m;
}

/** SF Draft_Status__c -> CRM Draft.status. */
function mapDraftStatus(sf: string): string {
  switch (sf) {
    case "Completed": case "Processed": return "SUCCESS";
    case "NSF": case "Rejected": return "FAILED";
    case "Processing": return "PROCESSING";
    case "Cancelled": return "CANCELLED";
    case "Skipped Payment": case "Rescheduled": return "SKIPPED";
    default: return "SCHEDULED"; // Pending | Scheduled
  }
}

async function migrateDrafts(headers: string[], records: AsyncIterable<string[]>): Promise<void> {
  const idx = (h: string) => headers.indexOf(h);
  const required = ["Program_Plan__c", "Draft_Status__c", "Draft_Total_Amount__c", "Citadel_Fee__c"];
  const missing = required.filter((h) => idx(h) === -1);
  if (missing.length) throw new Error(`Draft CSV missing columns (${missing.join(", ")}) - refusing to import.`);
  const plans = await loadPlanMap();
  console.log(`[${new Date().toISOString()}] ${plans.size} program plans mapped`);
  let batch: Array<Record<string, unknown>> = [];
  let count = 0;
  let skipped = 0;

  async function flush() {
    if (batch.length === 0) return;
    const results = await Promise.allSettled(
      batch.map((d) =>
        prisma.draft.upsert({ where: { sfId: d.sfId as string }, update: d, create: d as never }),
      ),
    );
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      console.error(`[${new Date().toISOString()}] ${failures.length}/${batch.length} draft upserts failed:`, (failures[0] as PromiseRejectedResult).reason?.message);
    }
    count += batch.length;
    batch = [];
    if (count % 25000 < 100) console.log(`[${new Date().toISOString()}] Draft: ${count} imported, ${skipped} skipped`);
  }

  for await (const cells of records) {
    const g = (h: string): string => { const i = idx(h); return i >= 0 ? cells[i] ?? "" : ""; };
    const sfId = g("Id");
    if (!sfId || !/^[a-zA-Z0-9]{15,18}$/.test(sfId)) continue;
    const programPlanId = plans.get(g("Program_Plan__c"));
    if (!programPlanId) { skipped++; continue; }
    const num = (v: string): number => (v !== "" && !Number.isNaN(Number(v)) ? Number(v) : 0);
    const total = num(g("Draft_Total_Amount__c")) || num(g("Draft_Amount__c"));
    const fees =
      num(g("Retainer_Fee__c")) + num(g("Program_Fee__c")) + num(g("Setup_Fee__c")) +
      num(g("Service_Fee__c")) + num(g("Processor_Fee__c")) + num(g("Citadel_Fee__c"));
    const escrow = g("DS_Escrow_Amount__c") !== "" ? num(g("DS_Escrow_Amount__c")) : Math.max(0, Math.round((total - fees) * 100) / 100);
    batch.push({
      sfId,
      programPlanId,
      scheduledDate: g("Draft_Date__c") ? new Date(g("Draft_Date__c")) : new Date(g("CreatedDate") || Date.now()),
      amount: total,
      status: mapDraftStatus(g("Draft_Status__c")),
      returnReason: ["NSF", "Rejected"].includes(g("Draft_Status__c")) ? g("Draft_Status__c") : null,
      feeRetainer: num(g("Retainer_Fee__c")),
      feeProgram: num(g("Program_Fee__c")),
      feeSetup: num(g("Setup_Fee__c")),
      feeService: num(g("Service_Fee__c")),
      feeBank: num(g("Processor_Fee__c")),
      feeLegal: num(g("Citadel_Fee__c")),
      escrowAmount: escrow,
      settledAt: g("Draft_Cleared_Date__c") ? new Date(g("Draft_Cleared_Date__c")) : null,
      externalSasId: g("External_SAS_Id__c") || null,
      externalRamId: g("External_RAM_Id__c") || null,
      processorSyncStatus: g("Sync_Status__c") === "In Sync" ? "SYNCED" : "NOT_SYNCED",
    });
    if (batch.length >= 50) await flush();
  }
  await flush();
  console.log(`[${new Date().toISOString()}] DONE Draft: ${count} total, ${skipped} skipped (no matching Program Plan)`);
}

/** Generic upsert-by-sfId flusher used by the related-record importers. */
function makeFlusher(
  label: string,
  upsert: (row: Record<string, unknown>) => Promise<unknown>,
  logEvery = 5000,
) {
  let batch: Array<Record<string, unknown>> = [];
  let count = 0;
  let skipped = 0;
  return {
    push: async (row: Record<string, unknown> | null) => {
      if (row === null) { skipped++; return; }
      batch.push(row);
      if (batch.length >= 50) {
        const results = await Promise.allSettled(batch.map(upsert));
        const failures = results.filter((r) => r.status === "rejected");
        if (failures.length > 0) {
          console.error(`[${new Date().toISOString()}] ${failures.length}/${batch.length} ${label} upserts failed:`, (failures[0] as PromiseRejectedResult).reason?.message);
        }
        count += batch.length;
        batch = [];
        if (count % logEvery < 50) console.log(`[${new Date().toISOString()}] ${label}: ${count} imported, ${skipped} skipped`);
      }
    },
    finish: async () => {
      if (batch.length > 0) {
        const results = await Promise.allSettled(batch.map(upsert));
        const failures = results.filter((r) => r.status === "rejected");
        if (failures.length > 0) {
          console.error(`[${new Date().toISOString()}] ${failures.length}/${batch.length} ${label} upserts failed:`, (failures[0] as PromiseRejectedResult).reason?.message);
        }
        count += batch.length;
      }
      console.log(`[${new Date().toISOString()}] DONE ${label}: ${count} total, ${skipped} skipped`);
    },
  };
}

function mkGetters(headers: string[], cells: string[]) {
  const idx = new Map(headers.map((h, i) => [h, i]));
  const g = (h: string): string => { const i = idx.get(h); return i != null ? cells[i] ?? "" : ""; };
  const num = (h: string): number | null => { const v = g(h); return v !== "" && !Number.isNaN(Number(v)) ? Number(v) : null; };
  const date = (h: string): Date | null => { const v = g(h); return v ? new Date(v) : null; };
  return { g, num, date };
}

async function migrateDebts(headers: string[], records: AsyncIterable<string[]>): Promise<void> {
  const opps = await loadOpportunityMap();
  const plans = await loadPlanMap();
  const f = makeFlusher("Debt", (d) => prisma.debt.upsert({ where: { sfId: d.sfId as string }, update: d, create: d as never }));
  for await (const cells of records) {
    const { g, num, date } = mkGetters(headers, cells);
    const sfId = g("Id");
    if (!/^[a-zA-Z0-9]{15,18}$/.test(sfId)) continue;
    const opportunityId = opps.get(g("Opportunity__c")) ?? null;
    if (!opportunityId) { await f.push(null); continue; }
    const neg = g("Negotiation_Status__c");
    const status =
      neg.toLowerCase().includes("settled") || g("Debt_Status__c").toLowerCase().includes("settled") ? "SETTLED"
      : neg ? "NEGOTIATING" : "ENROLLED";
    await f.push({
      sfId,
      opportunityId,
      programPlanId: plans.get(g("Program_Plan__c")) ?? null,
      creditorName: g("Creditor_Name_Formula__c") || g("Creditor_Name__c") || "Unknown Creditor",
      accountNumber: g("Account_Number__c") || null,
      paymentFrequency: g("Payment_Frequency__c") ? g("Payment_Frequency__c").toUpperCase().replace(/[^A-Z]/g, "_") : null,
      paymentAmount: num("Payment__c"),
      originalBalance: num("Original_Debt__c") ?? num("Debt_Amount__c") ?? 0,
      currentBalance: num("Debt_Amount__c") ?? 0,
      enrolledBalance: num("Debt_Amount__c") ?? 0,
      status,
      settledAmount: num("Settlement_Amount__c"),
      savingsAmount: num("Total_Savings__c"),
      savingsPercent: num("Total_Savings_Percentage__c"),
      notes: [g("Debt_Status__c"), g("Negotiation_Status__c"), g("Legal_Status__c")].filter(Boolean).join(" | ") || null,
    });
  }
  await f.finish();
}

// SF Fee__c RecordTypeId -> fee type (from the org's RecordType table).
const FEE_RECORD_TYPES: Record<string, string> = {
  "0128Y000001Z0JPQA0": "PROCESSOR",
  "0128Y000001Z0JQQA0": "RETAINER",
  "0128Y000001Z0JRQA0": "SERVICE",
  "0128Y000001Z0JSQA0": "SETUP",
  "012VO000000fn1ZYAQ": "CITADEL",
  "012VO000000fn1aYAA": "PROGRAM",
};

async function migrateFees(headers: string[], records: AsyncIterable<string[]>): Promise<void> {
  const plans = await loadPlanMap();
  const f = makeFlusher("Fee", (d) => prisma.fee.upsert({ where: { sfId: d.sfId as string }, update: d, create: d as never }), 50000);
  for await (const cells of records) {
    const { g, num, date } = mkGetters(headers, cells);
    const sfId = g("Id");
    if (!/^[a-zA-Z0-9]{15,18}$/.test(sfId)) continue;
    const programPlanId = plans.get(g("Program_Plan__c"));
    if (!programPlanId) { await f.push(null); continue; }
    const st = g("Fee_Status__c").toLowerCase();
    await f.push({
      sfId,
      programPlanId,
      recordType: FEE_RECORD_TYPES[g("RecordTypeId").slice(0, 18)] ?? FEE_RECORD_TYPES[g("RecordTypeId").slice(0, 15)] ?? "OTHER",
      amount: num("Fee_Amount__c") ?? 0,
      chargedDate: date("Fee_Date__c") ?? date("CreatedDate") ?? new Date(),
      status: st.includes("paid") || st.includes("collect") || st.includes("complete") ? "CHARGED" : st.includes("waiv") ? "WAIVED" : st.includes("refund") ? "REFUNDED" : "PENDING",
    });
  }
  await f.finish();
}

async function loadDraftMap(): Promise<Map<string, string>> {
  const rows = await prisma.draft.findMany({ where: { sfId: { not: null } }, select: { id: true, sfId: true } });
  const m = new Map<string, string>();
  for (const r of rows) if (r.sfId) m.set(r.sfId, r.id);
  return m;
}

async function migrateCases(headers: string[], records: AsyncIterable<string[]>): Promise<void> {
  const accounts = await loadAccountMap();
  const users = await loadUserMap();
  const drafts = await loadDraftMap();
  const f = makeFlusher("Case", (d) => prisma.case.upsert({ where: { sfId: d.sfId as string }, update: d, create: d as never }), 500);
  for await (const cells of records) {
    const { g, date } = mkGetters(headers, cells);
    const sfId = g("Id");
    if (!/^[a-zA-Z0-9]{15,18}$/.test(sfId)) continue;
    const st = g("Status").toLowerCase();
    await f.push({
      sfId,
      caseNumber: g("CaseNumber") || `SF-${sfId}`,
      subject: g("Subject") || `Case ${g("CaseNumber")}`,
      description: g("Description") || null,
      status: st.includes("closed") || st.includes("resolved") ? "CLOSED" : st.includes("escalat") ? "ESCALATED" : st.includes("progress") || st.includes("working") ? "IN_PROGRESS" : st.includes("new") ? "NEW" : "OPEN",
      priority: g("Priority").toLowerCase().includes("high") ? "HIGH" : g("Priority").toLowerCase().includes("low") ? "LOW" : "NORMAL",
      origin: ["PHONE", "EMAIL", "WEB", "CHAT"].find((o) => g("Origin").toUpperCase().includes(o)) ?? "OTHER",
      accountId: accounts.get(g("AccountId")) ?? null,
      draftId: drafts.get(g("Draft__c")) ?? null,
      ownerId: users.get(g("OwnerId")) ?? null,
      resolvedAt: date("ClosedDate"),
    });
  }
  await f.finish();
}

// Task record types (from the org): Disposition rows keep their own type.
const TASK_RT_DISPOSITION = new Set(["0128Y000001Z0MyQAK"]);

async function migrateTasks(headers: string[], records: AsyncIterable<string[]>): Promise<void> {
  const accounts = await loadAccountMap();
  const contacts = await loadContactMap();
  const opps = await loadOpportunityMap();
  const users = await loadUserMap();
  const f = makeFlusher("Task", (d) => prisma.task.upsert({ where: { sfId: d.sfId as string }, update: d, create: d as never }), 25000);
  for await (const cells of records) {
    const { g, date } = mkGetters(headers, cells);
    const sfId = g("Id");
    if (!/^[a-zA-Z0-9]{15,18}$/.test(sfId)) continue;
    const accountId = accounts.get(g("AccountId"));
    if (!accountId) { await f.push(null); continue; }
    const st = g("Status").toLowerCase();
    const sub = (g("TaskSubtype") || g("Type")).toLowerCase();
    const type = g("CallType") || sub.includes("call") ? "CALL" : sub.includes("email") ? "EMAIL" : sub.includes("letter") ? "LETTER" : "TASK";
    const who = g("WhoId");
    const what = g("WhatId");
    await f.push({
      sfId,
      recordType: TASK_RT_DISPOSITION.has(g("RecordTypeId")) ? "DISPOSITION" : "ACTIVITY",
      subject: g("Subject") || "(no subject)",
      type,
      status: st.includes("complet") ? "COMPLETED" : st.includes("progress") ? "IN_PROGRESS" : st.includes("defer") ? "DEFERRED" : st.includes("wait") ? "WAITING" : "NOT_STARTED",
      priority: g("Priority").toLowerCase().includes("high") ? "HIGH" : "NORMAL",
      accountId,
      contactId: who.startsWith("003") ? contacts.get(who) ?? null : null,
      opportunityId: what.startsWith("006") ? opps.get(what) ?? null : null,
      ownerId: users.get(g("OwnerId")) ?? null,
      dueDate: date("ActivityDate"),
      completedAt: date("CompletedDateTime"),
      disposition: g("CallDisposition") || null,
      notes: g("Description") || null,
      createdAt: date("CreatedDate") ?? new Date(),
    });
  }
  await f.finish();
}

async function migrateEvents(headers: string[], records: AsyncIterable<string[]>): Promise<void> {
  const accounts = await loadAccountMap();
  const contacts = await loadContactMap();
  const users = await loadUserMap();
  const f = makeFlusher("Event", (d) => prisma.event.upsert({ where: { sfId: d.sfId as string }, update: d, create: d as never }), 500);
  for await (const cells of records) {
    const { g, date } = mkGetters(headers, cells);
    const sfId = g("Id");
    if (!/^[a-zA-Z0-9]{15,18}$/.test(sfId)) continue;
    const startAt = date("StartDateTime") ?? date("ActivityDate") ?? date("CreatedDate") ?? new Date();
    const who = g("WhoId");
    await f.push({
      sfId,
      subject: g("Subject") || "(no subject)",
      description: g("Description") || null,
      location: g("Location") || null,
      startAt,
      endAt: date("EndDateTime") ?? startAt,
      accountId: accounts.get(g("AccountId")) ?? null,
      contactId: who.startsWith("003") ? contacts.get(who) ?? null : null,
      ownerId: users.get(g("OwnerId")) ?? null,
      status: startAt < new Date() ? "COMPLETED" : "SCHEDULED",
      createdAt: date("CreatedDate") ?? new Date(),
    });
  }
  await f.finish();
}

async function migrateEmailMessages(headers: string[], records: AsyncIterable<string[]>): Promise<void> {
  const accounts = await loadAccountMap();
  const opps = await loadOpportunityMap();
  const f = makeFlusher("EmailMessage", (d) => prisma.emailMessage.upsert({ where: { sfId: d.sfId as string }, update: d, create: d as never }), 5000);
  for await (const cells of records) {
    const { g, date } = mkGetters(headers, cells);
    const sfId = g("Id");
    if (!/^[a-zA-Z0-9]{15,18}$/.test(sfId)) continue;
    const related = g("RelatedToId");
    const incoming = g("Incoming").toLowerCase() === "true";
    await f.push({
      sfId,
      direction: incoming ? "INBOUND" : "OUTBOUND",
      status: incoming ? "DELIVERED" : "SENT",
      fromAddress: g("FromAddress") || g("FromName") || "unknown",
      toAddresses: g("ToAddress") || "",
      cc: g("CcAddress") || null,
      subject: g("Subject") || "(no subject)",
      bodyText: g("TextBody") || null,
      accountId: related.startsWith("001") ? accounts.get(related) ?? null : null,
      opportunityId: related.startsWith("006") ? opps.get(related) ?? null : null,
      sentAt: date("MessageDate") ?? date("CreatedDate"),
      createdAt: date("CreatedDate") ?? new Date(),
    });
  }
  await f.finish();
}

/**
 * AccountHistory: SF field-change audit trail. The Bulk API refuses *History
 * objects, so this pages the REST query API directly (no CSV step).
 */
async function migrateAccountHistory(): Promise<void> {
  const raw = process.env.SF_AUTH_URL;
  if (!raw) throw new Error("accounthistory requires SF_AUTH_URL (REST paging)");
  const am = raw.match(/^force:\/\/([^:]*)::([^@]+)@(.+)$/);
  if (!am) throw new Error("SF_AUTH_URL malformed");
  const [, clientId, refreshToken, host] = am;
  const tokRes = await fetch(`https://${host}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: clientId || "PlatformCLI", refresh_token: refreshToken }),
  });
  const tok = (await tokRes.json()) as { access_token?: string; instance_url?: string };
  if (!tok.access_token) throw new Error("SF auth failed for accounthistory");

  const accounts = await loadAccountMap();
  const users = await loadUserMap();
  const f = makeFlusher("AccountHistory", (d) =>
    prisma.accountHistory.upsert({ where: { sfId: d.sfId as string }, update: d, create: d as never }), 25000);

  let url = `${tok.instance_url}/services/data/v62.0/query?q=${encodeURIComponent(
    "SELECT Id, AccountId, Field, OldValue, NewValue, CreatedById, CreatedDate FROM AccountHistory",
  )}`;
  for (;;) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${tok.access_token}` } });
    const j = (await res.json()) as {
      records?: Array<{ Id: string; AccountId: string; Field: string; OldValue: unknown; NewValue: unknown; CreatedById: string; CreatedDate: string }>;
      nextRecordsUrl?: string;
      done?: boolean;
    };
    if (!j.records) throw new Error(`accounthistory query failed: ${JSON.stringify(j).slice(0, 300)}`);
    for (const r of j.records) {
      const accountId = accounts.get(r.AccountId);
      if (!accountId) { await f.push(null); continue; }
      await f.push({
        sfId: r.Id,
        accountId,
        field: r.Field,
        oldValue: r.OldValue != null ? String(r.OldValue) : null,
        newValue: r.NewValue != null ? String(r.NewValue) : null,
        changedById: users.get(r.CreatedById) ?? null,
        changedAt: new Date(r.CreatedDate),
      });
    }
    if (j.done || !j.nextRecordsUrl) break;
    url = `${tok.instance_url}${j.nextRecordsUrl}`;
  }
  await f.finish();
}

async function main() {
  if (ENTITY === "accounthistory") {
    await migrateAccountHistory();
    await prisma.$disconnect();
    return;
  }
  // ALWAYS re-export. Reusing a stale CSV once caused a mass null-overwrite:
  // the import mapped columns missing from an old export to null and wiped
  // operational fields across all accounts. Fresh export or nothing.
  if (fs.existsSync(CSV_PATH)) fs.unlinkSync(CSV_PATH);
  await exportFromSF();

  const gen = csvRecords(CSV_PATH);
  const first = await gen.next();
  if (first.done) {
    console.error("Empty CSV");
    process.exit(1);
  }
  const headers = first.value;
  console.log(`Headers: ${headers.join(", ")}`);

  const rest: AsyncIterable<string[]> = { [Symbol.asyncIterator]: () => gen };

  if (ENTITY === "contact") await migrateContacts(headers, rest);
  if (ENTITY === "account") await migrateAccounts(headers, rest);
  if (ENTITY === "opportunity") await migrateOpportunities(headers, rest);
  if (ENTITY === "lead") await migrateLeads(headers, rest);
  if (ENTITY === "programplan") await migrateProgramPlans(headers, rest);
  if (ENTITY === "draft") await migrateDrafts(headers, rest);
  if (ENTITY === "debt") await migrateDebts(headers, rest);
  if (ENTITY === "fee") await migrateFees(headers, rest);
  if (ENTITY === "case") await migrateCases(headers, rest);
  if (ENTITY === "task") await migrateTasks(headers, rest);
  if (ENTITY === "event") await migrateEvents(headers, rest);
  if (ENTITY === "emailmessage") await migrateEmailMessages(headers, rest);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
