import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { ACCOUNT_RECORD_TYPES } from "@/lib/record-types";

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  ownerId: z.string().nullable().optional(),
  recordType: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  const r = await requireAuthOrRespond("Account.Edit");
  if ("response" in r) return r.response;

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const { ids, ownerId, recordType } = parsed.data;

  const data: Record<string, unknown> = {};
  if (ownerId !== undefined) data.ownerId = ownerId || null;
  if (recordType !== undefined) {
    if (!(ACCOUNT_RECORD_TYPES as readonly string[]).includes(recordType)) {
      return NextResponse.json({ error: "Invalid recordType" }, { status: 400 });
    }
    data.recordType = recordType;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const result = await prisma.account.updateMany({
    where: { id: { in: ids } },
    data,
  });
  return NextResponse.json({ ok: true, updated: result.count });
}
