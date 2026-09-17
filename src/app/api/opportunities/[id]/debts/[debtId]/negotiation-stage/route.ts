import { isNegotiationEligible } from "@/lib/negotiation-access";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { canAccessRecord } from "@/lib/record-access";
import { NEGOTIATION_STAGES, negotiationStage } from "@/lib/negotiation-workflow";

const schema = z.object({ stage: z.enum(NEGOTIATION_STAGES), previousStatus: z.string().nullable(), notes: z.string().trim().max(5000).optional() });
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; debtId: string }> }) {
  const auth = await requireAuthOrRespond("Debt.Edit");
  if ("response" in auth) return auth.response;
  const { id, debtId } = await params;
  if (!await canAccessRecord("opportunity", id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!await isNegotiationEligible(id)) return NextResponse.json({ error: "Negotiations require a Closed Won opportunity and an Active account." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid negotiation stage." }, { status: 400 });
  const debt = await prisma.debt.findFirst({ where: { id: debtId, opportunityId: id } });
  if (!debt) return NextResponse.json({ error: "Debt not found" }, { status: 404 });
  const { stage, previousStatus, notes } = parsed.data;
  if (debt.negotiationStatus !== previousStatus) return NextResponse.json({ error: "This debt was updated by someone else. Refresh and try again." }, { status: 409 });
  if (negotiationStage(debt.negotiationStatus, debt.status) === stage) return NextResponse.json({ ok: true });
  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.debt.updateMany({ where: { id: debtId, opportunityId: id, negotiationStatus: previousStatus }, data: { negotiationStatus: stage } });
      if (updated.count !== 1) throw new Error("STAGE_CONFLICT");
      await tx.negotiation.create({ data: {
        debtId, negotiatorId: auth.session.userId, type: "STAGE_CHANGE", date: new Date(), response: "PENDING",
        notes: `Stage changed: ${negotiationStage(debt.negotiationStatus, debt.status) ?? debt.negotiationStatus} → ${stage}${notes ? `\n${notes}` : ""}`,
      } });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "STAGE_CONFLICT") return NextResponse.json({ error: "This debt was updated by someone else. Refresh and try again." }, { status: 409 });
    throw error;
  }
  return NextResponse.json({ ok: true, stage });
}
