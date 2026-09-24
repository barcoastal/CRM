import { beforeAll, afterAll, describe, it, expect } from "vitest";
// @ts-expect-error pg is installed without declarations.
import { Client } from "pg";
import { closerProductionQuery } from "@/lib/closer-production";

// Session-local tables shadow CRM names; this never modifies application data.
describe.skipIf(!process.env.CLOSER_TEST_DATABASE_URL)("closer production in PostgreSQL", () => {
  const db = new Client({ connectionString: process.env.CLOSER_TEST_DATABASE_URL });
  beforeAll(async () => {
    await db.connect();
    await db.query(`CREATE TEMP TABLE "Opportunity" (id text, "assignedToId" text, stage text,
      "totalDebt" float8, "createdAt" timestamp, "firstContractSignedDateOpp" timestamp, "closeDate" timestamp);
      CREATE TEMP TABLE "OpportunityHistory" ("opportunityId" text, field text, "newValue" text, "changedAt" timestamp);`);
    const rows = [
      ["active", "a", "Closed Won - First Payment Completed", 7688064.32, "2026-09-03T12:00Z"],
      ["archive1", "a", "Archived Opportunity", 7688064.32, "2026-09-03T12:00Z"],
      ["archive2", "a", "Archived Opportunity", 7688064.32, "2026-09-03T12:00Z"],
      ["draft", "a", "Working Opportunity", 7688064.32, "2026-09-03T12:00Z"],
      ["cancel", "a", "Closed Lost - Cancelled", 50000, "2026-09-04T12:00Z"],
      ["signed", "a", "Contract Signed", 100000, "2026-09-04T12:00Z"],
      ["old", "a", "Closed Won", 200000, "2026-09-01T03:59:59Z"],
      ["next", "a", "Closed Won", 300000, "2026-10-01T04:00:00Z"],
      ["native", "b", "Closed Won", 75000, null],
      ["old-native", "b", "Closed Won", 90000, null],
      ["unknown", "outside", "Closed Won", 999999, "2026-09-03T12:00Z"],
    ];
    for (const r of rows) await db.query(`INSERT INTO "Opportunity" VALUES ($1,$2,$3,$4,'2026-08-15',$5,NULL)`, r);
    await db.query(`INSERT INTO "OpportunityHistory" VALUES
      ('native','Stage','Closed Won','2026-09-05T12:00Z'),
      ('old-native','stage','Closed Won','2026-08-10T12:00Z'),
      ('old-native','StageName','Closed Won - First Payment Completed','2026-09-05T12:00Z');`);
  });
  afterAll(async () => { await db.end(); });
  async function production(to = "2026-10-01T04:00:00Z") {
    const q = closerProductionQuery(["a", "b"], new Date("2026-09-01T04:00Z"), new Date(to));
    return (await db.query(q.text, q.values.map(v => v instanceof Date ? v.toISOString() : v))).rows;
  }
  it("counts the real won version once and keeps cancellations separate", async () => {
    const rows = await production();
    expect(rows.find((r: { userId: string }) => r.userId === "a")).toMatchObject({
      won: 1, wonDebt: 7688064.32, signed: 3, grossDebt: 7838064.32,
      canceled: 1, canceledDebt: 50000, paid: 1, paidDebt: 7688064.32,
    });
    expect(rows).toHaveLength(2);
  });
  it("counts native CRM wins from first stage history and respects Eastern boundaries", async () => {
    expect((await production()).find((r: { userId: string }) => r.userId === "b")).toMatchObject({ won: 1, wonDebt: 75000 });
  });
  it("includes newly closed deals when the live reporting window advances", async () => {
    expect((await production("2026-09-05T11:59:59Z")).find((r: { userId: string }) => r.userId === "b").wonDebt).toBe(0);
    expect((await production("2026-09-05T12:00:01Z")).find((r: { userId: string }) => r.userId === "b").wonDebt).toBe(75000);
  });
});
