import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
it("keeps completed documents and append-only events even when parent deletion cascades", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `CREATE TABLE "Account"(id text primary key); CREATE TABLE "Envelope"(id text primary key,status text,"accountId" text references "Account"(id) on delete cascade,"signedDocumentUrl" text,"updatedAt" text,"lastError" text); CREATE TABLE "EnvelopeEvent"(id text primary key,"envelopeId" text references "Envelope"(id) on delete cascade,details text);`,
    );
    await db.exec(
      await readFile("prisma/sql/esign-evidence-retention.sql", "utf8"),
    );
    await db.exec(
      `INSERT INTO "Account" VALUES ('a'); INSERT INTO "Envelope" VALUES ('e','SENT','a',null,null,null); INSERT INTO "EnvelopeEvent" VALUES ('v','e','sent'); UPDATE "Envelope" SET status='COMPLETED',"signedDocumentUrl"='signed.pdf' WHERE id='e';`,
    );
    await expect(
      db.exec(
        `UPDATE "Envelope" SET "signedDocumentUrl"='tampered.pdf' WHERE id='e'`,
      ),
    ).rejects.toThrow("cannot be modified");
    await expect(
      db.exec(`DELETE FROM "Envelope" WHERE id='e'`),
    ).rejects.toThrow("must be retained");
    await expect(
      db.exec(`DELETE FROM "Account" WHERE id='a'`),
    ).rejects.toThrow();
    await expect(
      db.exec(`UPDATE "EnvelopeEvent" SET details='changed'`),
    ).rejects.toThrow("append-only");
    await expect(db.exec(`DELETE FROM "EnvelopeEvent"`)).rejects.toThrow(
      "append-only",
    );
    expect((await db.query(`SELECT * FROM "Envelope"`)).rows).toHaveLength(1);
  } finally {
    await db.close();
  }
});

it("packet migration preserves existing envelopes and prevents deleting their packet", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `CREATE TABLE "Account"(id TEXT PRIMARY KEY); CREATE TABLE "Envelope"(id TEXT PRIMARY KEY); INSERT INTO "Envelope" VALUES ('existing');`,
    );
    await db.exec(
      await readFile(
        "prisma/migrations/20260930090000_esign_packets/migration.sql",
        "utf8",
      ),
    );
    expect(
      (
        await db.query(
          `SELECT "routingOrder" FROM "Envelope" WHERE id='existing'`,
        )
      ).rows,
    ).toEqual([{ routingOrder: 1 }]);
    await db.exec(
      `INSERT INTO "SigningPacket"(id,name,"createdById","preparedPdfPath") VALUES ('p','Test','u','p.pdf'); UPDATE "Envelope" SET "packetId"='p' WHERE id='existing';`,
    );
    await expect(
      db.exec(`DELETE FROM "SigningPacket" WHERE id='p'`),
    ).rejects.toThrow();
    expect((await db.query(`SELECT id FROM "Envelope"`)).rows).toHaveLength(1);
  } finally {
    await db.close();
  }
});
