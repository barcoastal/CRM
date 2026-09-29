import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { canAccessRecord } from "@/lib/record-access";
import { hasPermission } from "@/lib/permissions";
import { wirePaymentSchema } from "@/lib/payments/wire-validation";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const r = await requireAuthOrRespond("Account.View");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  if (!(await canAccessRecord("account", id)))
    return Response.json({ error: "Not found" }, { status: 404 });
  const [plans, payments] = await Promise.all([
    prisma.programPlan.findMany({
      where: { accountId: id, status: { in: ["ACTIVE", "PAUSED"] } },
      select: {
        id: true,
        status: true,
        startDate: true,
        opportunity: { select: { name: true } },
      },
      orderBy: { startDate: "desc" },
    }),
    prisma.wirePayment.findMany({
      where: { accountId: id },
      orderBy: { receivedAt: "desc" },
    }),
  ]);
  return Response.json({ plans, payments });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const r = await requireAuthOrRespond("Account.Edit");
  if ("response" in r) return r.response;
  if (!hasPermission(r.session.permissions, "Draft.Retry"))
    return Response.json(
      { error: "Payment editing permission required" },
      { status: 403 },
    );
  const { id } = await ctx.params;
  if (!(await canAccessRecord("account", id)))
    return Response.json({ error: "Not found" }, { status: 404 });
  const parsed = wirePaymentSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payment" },
      { status: 400 },
    );
  const d = parsed.data;
  try {
    const payment = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.wirePayment.findUnique({
          where: { requestKey: d.requestKey },
        });
        if (existing) {
          if (
            existing.accountId !== id ||
            existing.reference !== d.reference ||
            existing.programPlanId !== d.programPlanId ||
            existing.grossAmount !== d.grossAmount ||
            existing.wireFee !== d.wireFee ||
            existing.receivedAt.toISOString().slice(0, 10) !== d.receivedAt
          )
            throw new Error(
              "This request was already used for a different payment",
            );
          return existing;
        }
        const plan = await tx.programPlan.findFirst({
          where: {
            id: d.programPlanId,
            accountId: id,
            status: { in: ["ACTIVE", "PAUSED"] },
          },
        });
        if (!plan)
          throw new Error(
            "Choose an active or paused program plan belonging to this account",
          );
        const netAmount = Math.round((d.grossAmount - d.wireFee) * 100) / 100;
        const receivedAt = new Date(`${d.receivedAt}T00:00:00.000Z`);
        const draft = await tx.draft.create({
          data: {
            programPlanId: plan.id,
            scheduledDate: receivedAt,
            processedAt: receivedAt,
            settledAt: receivedAt,
            amount: netAmount,
            escrowAmount: netAmount,
            status: "SUCCESS",
            kind: "WIRE",
            processorReference: d.reference,
            processorSyncStatus: "NOT_REQUIRED",
            notes: d.notes || null,
          },
        });
        const payment = await tx.wirePayment.create({
          data: {
            ...d,
            notes: d.notes || null,
            receivedAt,
            accountId: id,
            draftId: draft.id,
            netAmount,
            recordedById: r.session.userId,
          },
        });
        await tx.programPlan.update({
          where: { id: plan.id },
          data: {
            completedPaymentsCount: { increment: 1 },
            ...(plan.firstDraftDate ? {} : { firstDraftDate: receivedAt }),
          },
        });
        await tx.account.update({
          where: { id },
          data: { firstPaymentReceived: true },
        });
        await tx.auditLog.create({
          data: {
            userId: r.session.userId,
            entity: "WirePayment",
            entityId: payment.id,
            action: "CREATE",
            after: {
              accountId: id,
              draftId: draft.id,
              reference: d.reference,
              grossAmount: d.grossAmount,
              wireFee: d.wireFee,
              netAmount,
              receivedAt: d.receivedAt,
            },
          },
        });
        await tx.task.create({
          data: {
            accountId: id,
            programPlanId: plan.id,
            ownerId: r.session.userId,
            type: "NOTE",
            recordType: "ACTIVITY",
            status: "COMPLETED",
            completedAt: new Date(),
            subject: `Wire payment received: $${d.grossAmount.toFixed(2)}`,
            notes: `Reference: ${d.reference}. Received ${d.receivedAt}. Wire fee $${d.wireFee.toFixed(2)}; escrow $${netAmount.toFixed(2)}.${d.notes ? `\n${d.notes}` : ""}`,
          },
        });
        return payment;
      },
      { isolationLevel: "Serializable" },
    );
    return Response.json({ ok: true, payment });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "P2002" || code === "P2034")
      return Response.json(
        {
          error:
            "This reference was already recorded, or another payment was saved at the same time. Refresh before retrying.",
        },
        { status: 409 },
      );
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not record the wire payment",
      },
      { status: 400 },
    );
  }
}
