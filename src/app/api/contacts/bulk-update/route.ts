import { ssnSafeJson } from "@/lib/ssn-safe-json";
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  ownerId: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const r = await requireAuthOrRespond("Contact.Edit");
  if ("response" in r) return r.response;

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return ssnSafeJson({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const { ids, ownerId } = parsed.data;

  const data: Record<string, unknown> = {};
  if (ownerId !== undefined) data.ownerId = ownerId || null;
  if (Object.keys(data).length === 0) {
    return ssnSafeJson({ error: "Nothing to update" }, { status: 400 });
  }

  const result = await prisma.contact.updateMany({
    where: { id: { in: ids } },
    data,
  });
  return ssnSafeJson({ ok: true, updated: result.count });
}
