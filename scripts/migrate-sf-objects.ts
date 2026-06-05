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

import { PrismaClient } from "@prisma/client";
import { spawnSync, execSync } from "node:child_process";
import fs from "node:fs";
import readline from "node:readline";

const prisma = new PrismaClient({ log: ["warn", "error"] });

const ENTITY = process.argv[2];
if (!ENTITY || !["contact", "account", "opportunity", "lead"].includes(ENTITY)) {
  console.error("Usage: tsx scripts/migrate-sf-objects.ts <contact|account|opportunity|lead>");
  process.exit(1);
}

const SOQL: Record<string, string> = {
  contact: `SELECT Id, FirstName, LastName, Email, Phone, MobilePhone, Title, Birthdate, AccountId, OwnerId, IsActive__c FROM Contact`,
  account: `SELECT Id, Name, Phone, Website, Industry, AnnualRevenue, NumberOfEmployees, BillingStreet, BillingCity, BillingState, BillingPostalCode, BillingCountry, OwnerId, ParentId FROM Account`,
  opportunity: `SELECT Id, Name, StageName, Amount, CloseDate, AccountId, OwnerId, Description, LeadSource, Probability FROM Opportunity`,
  lead: `SELECT Id, FirstName, LastName, Company, Email, Phone, Status, LeadSource, Industry, AnnualRevenue, OwnerId, IsConverted, ConvertedDate FROM Lead`,
};

const CSV_PATH = `/tmp/sf-${ENTITY}.csv`;

function exportFromSF(): void {
  console.log(`[${new Date().toISOString()}] Exporting ${ENTITY} from Salesforce…`);
  const result = spawnSync(
    "sf",
    ["data", "query", "--target-org", "coastal", "--query", SOQL[ENTITY], "--result-format", "csv", "--bulk", "--wait", "60"],
    { stdio: ["ignore", "pipe", "inherit"], maxBuffer: 5 * 1024 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    console.error("SF export failed");
    process.exit(1);
  }
  fs.writeFileSync(CSV_PATH, result.stdout);
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

async function userMap(): Promise<Map<string, string>> {
  // SF user 18-char Id → CRM user.id (best effort by stored sfId if we had it,
  // OR by email. Imported users have email; we map by email.)
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  // We can't map SF ownerId → CRM user without storing the SF id on the user.
  // For now, return empty — owners come in as null. Future: import users with sfId.
  return new Map();
}

async function migrateContacts(headers: string[], rl: readline.Interface): Promise<void> {
  const idx = (h: string) => headers.indexOf(h);
  const I = {
    Id: idx("Id"), FirstName: idx("FirstName"), LastName: idx("LastName"),
    Email: idx("Email"), Phone: idx("Phone"), MobilePhone: idx("MobilePhone"),
    Title: idx("Title"), Birthdate: idx("Birthdate"), IsActive: idx("IsActive__c"),
  };
  let batch: Array<{ sfId: string; firstName: string; lastName: string; fullName: string; email?: string | null; phone?: string | null; mobilePhone?: string | null; title?: string | null; birthdate?: Date | null; isActive: boolean }> = [];
  let count = 0;

  async function flush() {
    if (batch.length === 0) return;
    await prisma.$transaction(
      batch.map((c) =>
        prisma.contact.upsert({
          where: { sfId: c.sfId },
          update: c,
          create: c,
        }),
      ),
      { timeout: 60000 },
    );
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
      isActive: cells[I.IsActive] !== "false",
    });
    if (batch.length >= 500) await flush();
  }
  await flush();
  console.log(`[${new Date().toISOString()}] DONE Contact: ${count} total`);
}

async function migrateAccounts(headers: string[], rl: readline.Interface): Promise<void> {
  const idx = (h: string) => headers.indexOf(h);
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
    await prisma.$transaction(
      batch.map((a) =>
        prisma.account.upsert({
          where: { sfId: a.sfId as string },
          update: a,
          create: a as never,
        }),
      ),
      { timeout: 60000 },
    );
    count += batch.length;
    batch = [];
    if (count % 5000 === 0) console.log(`[${new Date().toISOString()}] Account: ${count} imported`);
  }

  for await (const line of rl) {
    if (!line.trim()) continue;
    const cells = parseLine(line);
    const sfId = cells[I.Id];
    if (!sfId) continue;
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
    });
    if (batch.length >= 500) await flush();
  }
  await flush();
  console.log(`[${new Date().toISOString()}] DONE Account: ${count} total`);
}

async function migrateOpportunities(headers: string[], rl: readline.Interface): Promise<void> {
  const idx = (h: string) => headers.indexOf(h);
  const I = {
    Id: idx("Id"), Name: idx("Name"), StageName: idx("StageName"), Amount: idx("Amount"),
    CloseDate: idx("CloseDate"), AccountId: idx("AccountId"), Description: idx("Description"),
    LeadSource: idx("LeadSource"), Probability: idx("Probability"),
  };
  const accountMap = new Map<string, string>();
  const accounts = await prisma.account.findMany({ where: { sfId: { not: null } }, select: { id: true, sfId: true } });
  for (const a of accounts) if (a.sfId) accountMap.set(a.sfId, a.id);

  let batch: Array<Record<string, unknown>> = [];
  let count = 0;
  let skipped = 0;

  async function flush() {
    if (batch.length === 0) return;
    await prisma.$transaction(
      batch.map((o) =>
        prisma.opportunity.upsert({
          where: { sfId: o.sfId as string },
          update: o,
          create: o as never,
        }),
      ),
      { timeout: 60000 },
    );
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
    if (!accountId) { skipped++; continue; } // FK constraint — Opp requires accountId
    batch.push({
      sfId,
      accountId,
      name: cells[I.Name] || "Unnamed Opp",
      stage: cells[I.StageName] || "Working Opportunity",
      amount: cells[I.Amount] ? Number(cells[I.Amount]) : null,
      closeDate: cells[I.CloseDate] ? new Date(cells[I.CloseDate]) : null,
      description: cells[I.Description] || null,
      leadSource: cells[I.LeadSource] || null,
      probability: cells[I.Probability] ? Number(cells[I.Probability]) : null,
    });
    if (batch.length >= 500) await flush();
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
    ConvertedDate: idx("ConvertedDate"),
  };
  let batch: Array<Record<string, unknown>> = [];
  let count = 0;

  async function flush() {
    if (batch.length === 0) return;
    await prisma.$transaction(
      batch.map((l) =>
        prisma.lead.upsert({
          where: { sfId: l.sfId as string },
          update: l,
          create: l as never,
        }),
      ),
      { timeout: 60000 },
    );
    count += batch.length;
    batch = [];
    if (count % 10000 === 0) console.log(`[${new Date().toISOString()}] Lead: ${count} imported`);
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
    });
    if (batch.length >= 1000) await flush();
  }
  await flush();
  console.log(`[${new Date().toISOString()}] DONE Lead: ${count} total`);
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    exportFromSF();
  } else {
    console.log(`[${new Date().toISOString()}] Reusing existing ${CSV_PATH} (delete to re-export)`);
  }

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
