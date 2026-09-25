import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    'CREATE TABLE "User" (id TEXT PRIMARY KEY); CREATE TABLE "Call" (id TEXT PRIMARY KEY); CREATE TABLE "Lead" (id TEXT PRIMARY KEY); CREATE TABLE "Campaign" (id TEXT PRIMARY KEY); CREATE TABLE "CloserHandoff" (id TEXT PRIMARY KEY); INSERT INTO "User" VALUES (\'agent\'); INSERT INTO "Call" VALUES (\'old-five9-call\');',
  );
  await db.exec(
    readFileSync("prisma/sql/native-call-center-additive.sql", "utf8"),
  );
  await db.exec(
    readFileSync("prisma/sql/native-call-center-outbound.sql", "utf8"),
  );
  await db.exec(
    readFileSync("prisma/sql/native-call-center-sales-roles.sql", "utf8"),
  );
  await db.exec(
    readFileSync("prisma/sql/native-call-center-approval.sql", "utf8"),
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
it("applies the additive migration without modifying existing calls", async () => {
  expect((await db.query('SELECT id FROM "Call"')).rows).toEqual([
    { id: "old-five9-call" },
  ]);
});
it("allows only one simultaneous agent reservation", async () => {
  await db.exec(
    `INSERT INTO "VoiceAgent" ("userId", status, "updatedAt") VALUES ('agent','AVAILABLE',NOW())`,
  );
  const claims = await Promise.all(
    ["call-a", "call-b"].map((id) =>
      db.query(
        `UPDATE "VoiceAgent" SET "activeCallId"=$1, status='BUSY' WHERE "userId"='agent' AND "activeCallId" IS NULL AND status='AVAILABLE' RETURNING "userId"`,
        [id],
      ),
    ),
  );
  expect(claims.flatMap((r) => r.rows)).toHaveLength(1);
});
it("cannot duplicate provider call IDs on webhook retries", async () => {
  await db.query(
    `INSERT INTO "VoiceCall" (id,direction,"phoneNumber","fromNumber","customerSid","updatedAt") VALUES ('v1','INBOUND','+12125551234','+12125551235','CAunique',NOW())`,
  );
  await expect(
    db.query(
      `INSERT INTO "VoiceCall" (id,direction,"phoneNumber","fromNumber","customerSid","updatedAt") VALUES ('v2','INBOUND','+12125551234','+12125551235','CAunique',NOW())`,
    ),
  ).rejects.toThrow();
});
it("deduplicates the first-call queue across repeated lead arrivals", async () => {
  await db.exec(`INSERT INTO "Lead" VALUES ('web-lead');`);
  const insert = `INSERT INTO "VoiceWebLead" ("leadId", "receivedAt", "deadlineAt", "updatedAt") VALUES ('web-lead', NOW(), NOW() + INTERVAL '60 seconds', NOW()) ON CONFLICT ("leadId") DO NOTHING`;
  await Promise.all([db.exec(insert), db.exec(insert)]);
  expect(
    (await db.query(`SELECT * FROM "VoiceWebLead" WHERE "leadId"='web-lead'`))
      .rows,
  ).toHaveLength(1);
});
it("shares the dispatch budget across simultaneous server claims", async () => {
  await db.exec(
    `INSERT INTO "VoiceDialerLease" VALUES ('dispatch', NOW() - INTERVAL '1 second')`,
  );
  const results = await Promise.all(
    [1, 2].map(() =>
      db.query(
        `UPDATE "VoiceDialerLease" SET "expiresAt" = NOW() + INTERVAL '1 second' WHERE id='dispatch' AND "expiresAt" <= NOW() RETURNING id`,
      ),
    ),
  );
  expect(results.flatMap((r) => r.rows)).toHaveLength(1);
});
it("reuses an agent audio leg across sequential call-history records", async () => {
  await db.exec(`INSERT INTO "VoiceCall" (id,direction,"phoneNumber","fromNumber","updatedAt") VALUES ('history-a','OUTBOUND','+12125551234','+12125551235',NOW()), ('history-b','OUTBOUND','+12125551234','+12125551235',NOW());
    INSERT INTO "VoiceParticipant" (id,"voiceCallId","userId",role,"callSid") VALUES ('part-a','history-a','agent','AGENT','CAstandby'), ('part-b','history-b','agent','AGENT','CAstandby');`);
  expect(
    (
      await db.query(
        `SELECT id FROM "VoiceParticipant" WHERE "callSid"='CAstandby'`,
      )
    ).rows,
  ).toHaveLength(2);
});

it("stores the approval snapshot without altering existing call ownership", async () => {
  await db.query(
    `UPDATE "VoiceCall" SET "qualifiedDebts"=$1::jsonb, "salesStage"='PENDING_APPROVAL', "transferRequestKey"='request-1' WHERE id='v1'`,
    [JSON.stringify([{ key: "a", creditorName: "Bank A", amount: 50000 }])],
  );
  const result = await db.query(
    `SELECT "qualifiedDebts", "salesStage", "transferTargetId" FROM "VoiceCall" WHERE id='v1'`,
  );
  expect(result.rows[0]).toMatchObject({
    salesStage: "PENDING_APPROVAL",
    transferTargetId: null,
    qualifiedDebts: [{ key: "a", creditorName: "Bank A", amount: 50000 }],
  });
});
