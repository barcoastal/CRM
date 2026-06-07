import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  assignedToId: z.string().nullable().optional(),
  stage: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  const r = await requireAuthOrRespond("Opportunity.Edit");
  if ("response" in r) return r.response;

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const { ids, assignedToId, stage } = parsed.data;

  const data: Record<string, unknown> = {};
  if (assignedToId !== undefined) data.assignedToId = assignedToId || null;
  if (stage !== undefined) data.stage = stage;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const result = await prisma.opportunity.updateMany({
    where: { id: { in: ids } },
    data,
  });
  return NextResponse.json({ ok: true, updated: result.count });
}
