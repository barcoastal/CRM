import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { retry } from "./reliable";

const TABLES = new Set(["Contact", "Opportunity", "Lead", "ProgramPlan", "Draft", "Debt", "Fee", "Case", "Offer", "Settlement", "Task", "Event", "EmailMessage", "PaymentSummaryLine"]);

/** Keep the mapped fields and database defaults used by the per-row importer,
 * but avoid thousands of network round trips during recovery. */
export function recordUpsertQuery(table: string, rows: Record<string, unknown>[]) {
  if (!TABLES.has(table) || !rows.length) throw new Error("Invalid sync batch");
  const keys = Object.keys(rows[0]);
  if (!keys.includes("sfId") || keys.some(k => !/^[A-Za-z][A-Za-z0-9_]*$/.test(k) || k === "id") ||
    rows.some(row => keys.some(k => !(k in row)) || Object.keys(row).some(k => !keys.includes(k)))) throw new Error("Inconsistent sync fields");
  const columns = keys.map(k => Prisma.raw(`"${k}"`));
  const extraCreated = table !== "PaymentSummaryLine" && !keys.includes("createdAt");
  const extraUpdated = !keys.includes("updatedAt");
  const names = Prisma.join([Prisma.raw('"id"'), ...columns, ...(extraCreated ? [Prisma.raw('"createdAt"')] : []), ...(extraUpdated ? [Prisma.raw('"updatedAt"')] : [])]);
  const values = Prisma.join([Prisma.raw('"id"'), ...columns, ...(extraCreated ? [Prisma.raw("NOW()")] : []), ...(extraUpdated ? [Prisma.raw("NOW()")] : [])]);
  const assignments = Prisma.join([...keys.filter(k => k !== "sfId").map(k => Prisma.raw(`"${k}" = EXCLUDED."${k}"`)), ...(extraUpdated ? [Prisma.raw('"updatedAt" = NOW()')] : [])]);
  const relation = Prisma.raw(`"${table}"`);
  return Prisma.sql`INSERT INTO ${relation} (${names})
    SELECT ${values} FROM jsonb_populate_recordset(NULL::${relation}, ${JSON.stringify(rows.map(row => ({ ...row, id: randomUUID() })))}::jsonb)
    ON CONFLICT ("sfId") DO UPDATE SET ${assignments} RETURNING id`;
}

export async function importRecordBatch(db: PrismaClient, table: string, rows: Record<string, unknown>[]) {
  // Undefined/omitted fields mean "preserve existing value", notably contact
  // identity when Salesforce has no resolvable primary contact. Never turn
  // heterogeneous mappings into nulls by merging their column lists.
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const mapped = Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
    const signature = Object.keys(mapped).sort().join(",");
    const group = groups.get(signature) ?? [];
    group.push(mapped); groups.set(signature, group);
  }
  for (const batch of groups.values()) await retry(() => db.$queryRaw(recordUpsertQuery(table, batch)));
}

export function contactPropagationQueries(ids: string[]) {
  const filter = Prisma.sql`c.id IN (${Prisma.join(ids)})`;
  return [
    Prisma.sql`UPDATE "Account" a SET "primaryContactId" = c.id, "updatedAt" = NOW()
      FROM "Contact" c WHERE ${filter} AND a.id = c."primaryAccountId"
      AND a."sfDataJson"::jsonb->>'Primary_Contact__c' = c."sfId"
      AND a."primaryContactId" IS DISTINCT FROM c.id`,
    Prisma.sql`UPDATE "Opportunity" o SET "dateOfBirth" = c.birthdate, "contactSsn" = c.ssn, "updatedAt" = NOW()
      FROM "Contact" c WHERE ${filter} AND o."primaryContactId" = c.id`,
    Prisma.sql`UPDATE "Account" a SET "dateOfBirth" = c.birthdate,
      "sfDataJson" = (COALESCE(NULLIF(a."sfDataJson", '')::jsonb, '{}'::jsonb) ||
        jsonb_build_object('SSN__c', c.ssn, 'Date_of_Birth__c', to_char(c.birthdate, 'YYYY-MM-DD'), 'DOB__c', to_char(c.birthdate, 'YYYY-MM-DD')))::text,
      "updatedAt" = NOW()
      FROM "Contact" c WHERE ${filter} AND a."primaryContactId" = c.id`,
  ];
}

export async function importContactBatch(db: PrismaClient, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  await retry(() => db.$transaction(async tx => {
    const contacts = await tx.$queryRaw<{ id: string }[]>(recordUpsertQuery("Contact", rows));
    for (const query of contactPropagationQueries(contacts.map(c => c.id))) await tx.$executeRaw(query);
  }, { maxWait: 30_000, timeout: 60_000 }));
}
