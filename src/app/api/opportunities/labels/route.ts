import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { recordScope } from "@/lib/record-access";
import { auditWrite } from "@/lib/audit";

const schema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  label: z.string().trim().min(1).max(60),
  operation: z.enum(["add", "remove"]),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuthOrRespond("Opportunity.Edit");
  if ("response" in auth) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Select records and enter a label of 1–60 characters." }, { status: 400 });
  const { ids, label, operation } = parsed.data;
  const scope = await recordScope("opportunity");
  let updated = 0;
  try {
    updated = await prisma.$transaction(async tx => {
      if (operation === "add") {
        const result = await tx.opportunity.updateMany({
          where: { id: { in: ids }, AND: [scope], NOT: { labels: { has: label } } },
          data: { labels: { push: label } },
        });
        return result.count;
      }
      const rows = await tx.opportunity.findMany({
        where: { id: { in: ids }, AND: [scope], labels: { has: label } },
        select: { id: true, labels: true },
      });
      for (const row of rows) {
        const result = await tx.opportunity.updateMany({
          where: { id: row.id, AND: [scope], labels: { equals: row.labels } },
          data: { labels: row.labels.filter(value => value !== label) },
        });
        // Roll back rather than overwrite a concurrently added label.
        if (result.count !== 1) throw new Error("LABEL_CONFLICT");
      }
      return rows.length;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "LABEL_CONFLICT") {
      return NextResponse.json({ error: "A selected record changed. Refresh the list and try again." }, { status: 409 });
    }
    throw error;
  }
  await auditWrite({ userId: auth.session.userId, entity: "Opportunity", entityId: ids[0], action: "UPDATE", after: { label, operation, updated }, diffOnly: false });
  return NextResponse.json({ ok: true, updated });
}
