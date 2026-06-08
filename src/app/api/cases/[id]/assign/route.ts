import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { assignCaseSchema } from "@/lib/validations/case";
import { notify } from "@/lib/notifications/notify";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Case.Edit");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = assignCaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const before = await prisma.case.findUnique({
    where: { id },
    select: { ownerId: true, caseNumber: true, subject: true },
  });
  // When assigning to a user, clear the group, and vice-versa
  const data: Record<string, unknown> = {};
  if (d.ownerId !== undefined) {
    data.ownerId = d.ownerId;
    if (d.ownerId) data.ownerGroupId = null;
  }
  if (d.ownerGroupId !== undefined) {
    data.ownerGroupId = d.ownerGroupId;
    if (d.ownerGroupId) data.ownerId = null;
  }
  const updated = await prisma.case.update({ where: { id }, data });

  // Notify the new owner when the owner actually changed (skip self).
  if (updated.ownerId && updated.ownerId !== before?.ownerId) {
    void notify({
      recipientId: updated.ownerId,
      kind: "OWNER_ASSIGNED",
      title: `Case ${updated.caseNumber}: ${updated.subject} was assigned to you`,
      url: `/cases/${updated.id}`,
      entityType: "Case",
      entityId: updated.id,
      actorId: r.session.userId,
      skipIfSelf: true,
    });
  }

  return NextResponse.json(updated);
}
