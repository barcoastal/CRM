import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("applies the additive migration and enforces wire references, receipt links and request idempotency", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      'CREATE TABLE "Account" (id text PRIMARY KEY); CREATE TABLE "ProgramPlan" (id text PRIMARY KEY); CREATE TABLE "Draft" (id text PRIMARY KEY); CREATE TABLE "OpportunityPaymentCalculation" (id text PRIMARY KEY);',
    );
    await db.exec(
      readFileSync(
        new URL(
          "../prisma/migrations/20260930011500_crm_feedback_payments/migration.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      `INSERT INTO "Account" VALUES ('account'); INSERT INTO "ProgramPlan" VALUES ('plan'); INSERT INTO "Draft" VALUES ('draft'),('draft2');`,
    );
    const insert = (
      id: string,
      draft: string,
      request: string,
      reference: string,
    ) =>
      db.query(
        'INSERT INTO "WirePayment" (id,"accountId","programPlanId","draftId","requestKey",reference,"receivedAt","grossAmount","wireFee","netAmount","recordedById") VALUES ($1,\'account\',\'plan\',$2,$3,$4,\'2026-01-05\',1000,25,975,\'rep\')',
        [id, draft, request, reference],
      );
    await insert("wire", "draft", "request", "BANK123");
    await expect(
      insert("duplicate-bank", "draft2", "request2", "BANK123"),
    ).rejects.toThrow(/unique/);
    await expect(
      insert("duplicate-request", "draft2", "request", "BANK456"),
    ).rejects.toThrow(/unique/);
    await expect(
      insert("missing-draft", "unknown", "request3", "BANK789"),
    ).rejects.toThrow(/foreign key/);
    await db.query(
      'INSERT INTO "OpportunityPaymentCalculation" (id,"scheduleJson") VALUES ($1,$2)',
      [
        "calc",
        JSON.stringify({
          version: 1,
          splitRows: [{ date: "2026-10-02", amount: 500 }],
        }),
      ],
    );
    const saved = await db.query<{ scheduleJson: { splitRows: unknown[] } }>(
      'SELECT "scheduleJson" FROM "OpportunityPaymentCalculation"',
    );
    expect(saved.rows[0].scheduleJson.splitRows).toHaveLength(1);
    expect(
      (
        await db.query<{ count: number }>(
          'SELECT count(*)::int as count FROM "WirePayment"',
        )
      ).rows[0].count,
    ).toBe(1);
  } finally {
    await db.close();
  }
});
