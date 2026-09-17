import { isNegotiationEligible } from "@/lib/negotiation-access";
import { NextRequest, NextResponse } from "next/server";
import { calculateOffer } from "@/lib/negotiation-offer";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { canAccessRecord } from "@/lib/record-access";
const schema = z.object({ amount: z.number().positive().finite().multipleOf(0.01), payments: z.number().int().min(1).max(360), frequency: z.enum(["Monthly", "Weekly", "Lump sum"]), notes: z.string().max(5000).default("") });
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; debtId: string }> }) {
  const auth = await requireAuthOrRespond("Offer.Create");
  if ("response" in auth) return auth.response;
  const { id, debtId } = await params;
  if (!await canAccessRecord("opportunity", id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!await isNegotiationEligible(id)) return NextResponse.json({ error: "Negotiations require a Closed Won opportunity and an Active account." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid offer and payment schedule." }, { status: 400 });
  const debt = await prisma.debt.findFirst({ where: { id: debtId, opportunityId: id } });
  if (!debt) return NextResponse.json({ error: "Debt not found" }, { status: 404 });
  const { amount, payments, frequency, notes } = parsed.data;
  if (!calculateOffer(debt.currentBalance, amount, payments) || (frequency === "Lump sum" && payments !== 1)) return NextResponse.json({ error: "Offer must be within the current balance and have a valid payment schedule." }, { status: 400 });
  const offer = await prisma.$transaction(async (tx) => {
    const offer = await tx.offer.create({ data: { debtId, opportunityId: id, amountOffered: amount, percentOffered: amount / debt.currentBalance, direction: "FROM_US", createdById: auth.session.userId, settlementFrequency: frequency, settlementTerm: String(payments), totalSettlementAmount: amount, termsNotes: `${payments} payment(s), ${frequency.toLowerCase()}. ${notes}`.trim() } });
    await tx.negotiation.create({ data: { debtId, offerId: offer.id, negotiatorId: auth.session.userId, type: "OFFER", date: new Date(), offerAmount: amount, offerPercent: amount / debt.currentBalance * 100, notes: `Offer saved for review; not sent. ${offer.termsNotes}` } });
    return offer;
  });
  return NextResponse.json({ id: offer.id }, { status: 201 });
}
