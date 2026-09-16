import { NextRequest, NextResponse } from "next/server";
import { canAccessRecord } from "@/lib/record-access";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { createNegotiationSchema } from "@/lib/validations/debt";

export async function POST(request: NextRequest, { params }: {
  params: Promise<{ id: string; debtId: string }>;
}) {
  const auth = await requireAuthOrRespond("Debt.Edit");
  if ("response" in auth) return auth.response;
  const { id, debtId } = await params;
  if (!await canAccessRecord("opportunity", id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const debt = await prisma.debt.findFirst({ where: { id: debtId, opportunityId: id } });
  if (!debt) return NextResponse.json({ error: "Debt not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = createNegotiationSchema.safeParse(body);
  if (!parsed.success || !Number.isFinite(new Date(parsed.data.date).getTime())) {
    return NextResponse.json({ error: "Enter a valid date and nonnegative amounts; offer percentage must be between 0 and 100." }, { status: 400 });
  }
  const data = parsed.data;
  const negotiation = await prisma.negotiation.create({
    data: {
      ...data,
      debtId,
      negotiatorId: auth.session.userId,
      date: new Date(data.date),
      notes: data.notes || null,
    },
    include: { negotiator: { select: { id: true, name: true } } },
  });
  return NextResponse.json(negotiation, { status: 201 });
}
