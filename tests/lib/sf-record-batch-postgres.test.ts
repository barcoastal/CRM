import { beforeAll, afterAll, describe, expect, it } from "vitest";
// @ts-expect-error pg is installed without declarations.
import { Client } from "pg";
import { recordUpsertQuery, contactPropagationQueries, importRecordBatch } from "@/lib/sf-sync/record-batch";

describe.skipIf(!process.env.CLOSER_TEST_DATABASE_URL)("record batches in PostgreSQL", () => {
  const db = new Client({ connectionString: process.env.CLOSER_TEST_DATABASE_URL });
  beforeAll(async () => {
    await db.connect();
    await db.query(`CREATE TEMP TABLE "Contact" (id text PRIMARY KEY,"sfId" text UNIQUE,"primaryAccountId" text,birthdate timestamp,ssn text,"createdAt" timestamp,"updatedAt" timestamp,"isActive" boolean DEFAULT true);
      CREATE TEMP TABLE "Account" (id text PRIMARY KEY,"primaryContactId" text,"dateOfBirth" timestamp,"sfDataJson" text,"updatedAt" timestamp);
      CREATE TEMP TABLE "Opportunity" (id text PRIMARY KEY,"sfId" text UNIQUE,"primaryContactId" text,"dateOfBirth" timestamp,"contactSsn" text,"createdAt" timestamp,"updatedAt" timestamp);
      CREATE TEMP TABLE "PaymentSummaryLine" (id text PRIMARY KEY,"sfId" text UNIQUE,"totalAmount" numeric,"updatedAt" timestamp);
      CREATE TEMP TABLE "Lead" (id text PRIMARY KEY,"sfId" text UNIQUE,"createdAt" timestamp,"updatedAt" timestamp);
      INSERT INTO "Account" VALUES ('primary',null,null,'{"Primary_Contact__c":"003source","keep":"yes"}',now()),('unrelated',null,null,'{"Primary_Contact__c":"003other"}',now());`);
  });
  afterAll(async () => { await db.end(); });
  async function apply(table: string, rows: Record<string, unknown>[]) {
    const q = recordUpsertQuery(table, rows); return (await db.query(q.text, q.values)).rows.map((r: { id: string }) => r.id);
  }
  it("preserves IDs, defaults and creation dates while propagating only explicit primary contact identity", async () => {
    const row = { sfId: "003source", primaryAccountId: "primary", birthdate: new Date("1990-02-03T00:00Z"), ssn: "test-identity" };
    const [id] = await apply("Contact", [row]);
    const created = (await db.query('SELECT "createdAt" FROM "Contact"')).rows[0].createdAt;
    expect(await apply("Contact", [row])).toEqual([id]);
    await db.query(`INSERT INTO "Opportunity" (id,"primaryContactId") VALUES ('linked',$1),('other','unrelated')`, [id]);
    for (const q of contactPropagationQueries([id])) await db.query(q.text, q.values);
    expect((await db.query('SELECT "isActive","createdAt" FROM "Contact"')).rows[0]).toEqual({ isActive: true, createdAt: created });
    const account = (await db.query('SELECT * FROM "Account" WHERE id = $1', ['primary'])).rows[0];
    expect(account.primaryContactId).toBe(id);
    expect(JSON.parse(account.sfDataJson)).toMatchObject({ keep: "yes", SSN__c: "test-identity", DOB__c: "1990-02-03" });
    expect((await db.query('SELECT "contactSsn" FROM "Opportunity" WHERE id = $1', ['linked'])).rows[0].contactSsn).toBe("test-identity");
    expect((await db.query('SELECT "dateOfBirth" FROM "Account" WHERE id = $1', ['unrelated'])).rows[0].dateOfBirth).toBeNull();
    await apply("Contact", [{ ...row, birthdate: null, ssn: null }]);
    for (const q of contactPropagationQueries([id])) await db.query(q.text, q.values);
    expect((await db.query('SELECT "contactSsn" FROM "Opportunity" WHERE id = $1', ['linked'])).rows[0].contactSsn).toBeNull();
  });
  it("supports source creation dates and tables without createdAt", async () => {
    const createdAt = new Date("2026-08-01T00:00Z");
    await apply("Opportunity", [{ sfId: "006source", createdAt }]);
    // Prisma timestamps are stored as UTC without a zone; pg's default JS
    // parser otherwise interprets them in the test machine's local zone.
    expect((await db.query('SELECT to_char("createdAt", \'YYYY-MM-DD HH24:MI:SS\') AS value FROM "Opportunity" WHERE "sfId"=$1', ['006source'])).rows[0].value).toBe("2026-08-01 00:00:00");
    const [id] = await apply("PaymentSummaryLine", [{ sfId: "a00source", totalAmount: 125.25 }]);
    expect(await apply("PaymentSummaryLine", [{ sfId: "a00source", totalAmount: 250.50 }])).toEqual([id]);
    expect(Number((await db.query('SELECT "totalAmount" FROM "PaymentSummaryLine"')).rows[0].totalAmount)).toBe(250.50);
  });
  it("preserves omitted identity fields across heterogeneous source records", async () => {
    await apply("Opportunity", [{ sfId: "006preserve", contactSsn: "existing" }]);
    const adapter = { $queryRaw: (q: { text: string; values: unknown[] }) => db.query(q.text, q.values) };
    await importRecordBatch(adapter as never, "Opportunity", [
      { sfId: "006preserve", contactSsn: undefined },
      { sfId: "006clear", contactSsn: null },
      { sfId: "006set", contactSsn: "new" },
    ]);
    expect((await db.query('SELECT "contactSsn" FROM "Opportunity" WHERE "sfId"=$1', ['006preserve'])).rows[0].contactSsn).toBe("existing");
    expect((await db.query('SELECT "contactSsn" FROM "Opportunity" WHERE "sfId"=$1', ['006set'])).rows[0].contactSsn).toBe("new");
    expect((await db.query('SELECT "contactSsn" FROM "Opportunity" WHERE "sfId"=$1', ['006clear'])).rows[0].contactSsn).toBeNull();
  });
  it("preserves explicit source modification dates used by the lead mapper", async () => {
    const row = { sfId: "00Qsource", createdAt: new Date("2026-08-01T00:00Z"), updatedAt: new Date("2026-09-24T13:00Z") };
    await apply("Lead", [row]);
    await apply("Lead", [{ ...row, updatedAt: new Date("2026-09-24T14:00Z") }]);
    expect((await db.query('SELECT to_char("updatedAt", \'YYYY-MM-DD HH24:MI:SS\') AS value FROM "Lead"')).rows[0].value).toBe("2026-09-24 14:00:00");
  });
});
