import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { recalcLeadWeeklyPayment } from "@/lib/lead-debt-rollup";

const TYPES = ["MCA", "CREDIT_LINE", "TERM_LOAN", "BUSINESS_CC", "EQUIPMENT", "INVOICE_FACTORING", "OTHER"];
const FREQS = ["DAILY", "WEEKLY", "BI_WEEKLY", "MONTHLY", "LUMP_SUM"];
const STATUSES = ["ACTIVE", "DEFAULTED", "SETTLED", "PAID_OFF", "DISPUTED"];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Lead.View");
  if ("response" in r) return r.response;
  const { id } = await params;
  const items = await prisma.leadDebt.findMany({
    where: { leadId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(items);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Lead.Edit");
  if ("response" in r) return r.response;
  const { session } = r;
  const { id } = await params;

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { type, creditorName, amount, frequency, paymentAmount, status, notes } = body ?? {};

  if (!TYPES.includes(type)) return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  if (!FREQS.includes(frequency)) return NextResponse.json({ error: "Invalid frequency" }, { status: 400 });
  const finalStatus = STATUSES.includes(status) ? status : "ACTIVE";
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt < 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const debt = await prisma.leadDebt.create({
    data: {
      leadId: id,
      type,
      creditorName: creditorName || null,
      amount: amt,
      frequency,
      paymentAmount: typeof paymentAmount === "number" ? paymentAmount : null,
      status: finalStatus,
      notes: notes || null,
      createdById: session.userId,
    },
  });

  // SF parity: keep Lead.currentTotalWeeklyPayment in sync after any creditor edit.
  await recalcLeadWeeklyPayment(id).catch(() => undefined);

  return NextResponse.json(debt);
}
