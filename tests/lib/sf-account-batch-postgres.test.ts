import { beforeAll, afterAll, describe, expect, it } from "vitest";
// @ts-expect-error pg is installed without declarations.
import { Client } from "pg";
import { accountUpsertQuery, accountClosersQuery } from "@/lib/sf-sync/account-batch";

describe.skipIf(!process.env.CLOSER_TEST_DATABASE_URL)("bulk account import in PostgreSQL", () => {
  const db = new Client({ connectionString: process.env.CLOSER_TEST_DATABASE_URL });
  beforeAll(async () => {
    await db.connect();
    await db.query(`CREATE TEMP TABLE "Account" (id text PRIMARY KEY,"sfId" text UNIQUE,name text,phone text,"sfDataJson" text,"createdAt" timestamp,"updatedAt" timestamp,"clientStatus" text DEFAULT 'Active');
      CREATE TEMP TABLE "User" (id text PRIMARY KEY,"sfId" text,"isActive" boolean);
      CREATE TEMP TABLE "AccountTeamMember" (id text PRIMARY KEY,"accountId" text,"userId" text,role text,source text,"createdAt" timestamp,UNIQUE("accountId","userId",role));
      INSERT INTO "User" VALUES ('active','005active',true),('inactive','005inactive',false),('manual','005manual',true);`);
  });
  afterAll(async () => { await db.end(); });
  const row = (closer = "005active", phone: string | null = "123") => ({ sfId: "001source", name: "Test", phone, sfDataJson: JSON.stringify({ Closer__c: closer }) });
  async function apply(rows: Record<string, unknown>[]) {
    const q = accountUpsertQuery(rows);
    const ids = (await db.query(q.text, q.values)).rows.map((r: { id: string }) => r.id);
    const teams = accountClosersQuery(ids); await db.query(teams.text, teams.values);
    return ids;
  }
  it("upserts without duplicates, preserves creation time and defaults, and applies source nulls", async () => {
    const [id] = await apply([row()]);
    const created = (await db.query('SELECT "createdAt" FROM "Account"')).rows[0].createdAt;
    expect(await apply([row("005active", null)])).toEqual([id]);
    expect((await db.query('SELECT * FROM "Account"')).rows).toMatchObject([{ id, phone: null, createdAt: created, clientStatus: "Active" }]);
    expect((await db.query('SELECT "userId",source FROM "AccountTeamMember"')).rows).toEqual([{ userId: "active", source: "CLOSER_SYNC" }]);
  });
  it("removes old synced access for inactive closers and preserves manual access", async () => {
    const [id] = await apply([row()]);
    await db.query(`INSERT INTO "AccountTeamMember" VALUES ('manual-link',$1,'manual','Closer','MANUAL',now())`, [id]);
    await apply([row("005inactive")]);
    expect((await db.query('SELECT "userId",source FROM "AccountTeamMember"')).rows).toEqual([{ userId: "manual", source: "MANUAL" }]);
    await apply([row("005manual")]);
    expect((await db.query('SELECT "userId",source FROM "AccountTeamMember"')).rows).toEqual([{ userId: "manual", source: "MANUAL" }]);
  });
});
