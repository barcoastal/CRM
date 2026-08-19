import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { sendESignEmail } from "@/lib/esign/send-email";
import { computeQuote, renderQuoteEmail, type QuoteFigures } from "@/lib/quote-email";
import { appBaseUrl } from "@/lib/document-request";

/**
 * Resolve the quote inputs from an opportunity, mirroring the opp page's
 * Total Payments Summary math so the emailed figures match the rail exactly.
 */
async function loadQuote(id: string): Promise<
  | { error: string; status: number }
  | { figures: QuoteFigures; recipientEmail: string | null; recipientName: string | null; businessName: string | null }
> {
  const opp = await prisma.opportunity.findUnique({
    where: { id },
    include: {
      debts: { select: { originalBalance: true } },
      lead: { select: { contactName: true, businessName: true, email: true } },
      primaryContact: { select: { fullName: true, email: true } },
      account: { select: { name: true } },
      paymentCalculations: { orderBy: { savedAt: "desc" }, take: 1 },
    },
  });
  if (!opp) return { error: "Opportunity not found", status: 404 };

  const latestCalc = opp.paymentCalculations[0];
  let sf: Record<string, unknown> = {};
  try {
    sf = opp.sfDataJson ? (JSON.parse(opp.sfDataJson) as Record<string, unknown>) : {};
  } catch {
    /* ignore */
  }

  const totalDebtVal = opp.debts.reduce((s, d) => s + d.originalBalance, 0) || opp.totalDebt || 0;
  const termMonths =
    latestCalc?.programFeePeriod ||
    (sf["Payment_Term__c"] != null && Number(sf["Payment_Term__c"]) > 0 ? Number(sf["Payment_Term__c"]) : 0) ||
    6;

  const figures = computeQuote({
    totalDebt: latestCalc?.totalDebt ?? totalDebtVal,
    termMonths,
    citadelFee: latestCalc?.citadelFee ?? undefined,
    currentWeeklyPayment: opp.currentWeeklyPayment ?? null,
  });

  return {
    figures,
    recipientEmail:
      opp.oppEmail ?? opp.primaryContact?.email ?? opp.lead?.email ?? null,
    recipientName: opp.primaryContact?.fullName ?? opp.lead?.contactName ?? opp.name ?? null,
    businessName: opp.account?.name ?? opp.lead?.businessName ?? null,
  };
}

// GET - preview figures + prefill for the Get Quote modal.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Opportunity.View");
  if ("response" in r) return r.response;
  const { id } = await params;
  const q = await loadQuote(id);
  if ("error" in q) return NextResponse.json({ error: q.error }, { status: q.status });
  return NextResponse.json(q);
}

// POST - send the branded quote email to the client.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Opportunity.View");
  if ("response" in r) return r.response;
  const { session } = r;
  const { id } = await params;

  const q = await loadQuote(id);
  if ("error" in q) return NextResponse.json({ error: q.error }, { status: q.status });

  const body = (await request.json().catch(() => ({}))) as {
    recipientEmail?: string;
    recipientName?: string;
    note?: string;
  };
  const to = (body.recipientEmail ?? q.recipientEmail ?? "").trim();
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return NextResponse.json({ error: "A valid recipient email is required." }, { status: 400 });
  }
  if (q.figures.enrolledDebt <= 0) {
    return NextResponse.json(
      { error: "This opportunity has no debt on file to quote. Add a debt first." },
      { status: 400 },
    );
  }

  const sender = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true },
  });

  const html = renderQuoteEmail({
    recipientName: body.recipientName ?? q.recipientName,
    senderName: sender?.name ?? null,
    businessName: q.businessName,
    note: body.note ?? null,
    figures: q.figures,
    callPhone: process.env.QUOTE_CALL_PHONE ?? null,
  });

  const from = process.env.EMAIL_FROM ?? "Coastal Debt <no-reply@coastaldebt.com>";
  const sent = await sendESignEmail({
    from,
    to,
    subject: `Your debt relief quote - save an estimated $${Math.round(q.figures.youSave).toLocaleString("en-US")}`,
    html,
    replyTo: session.email,
  });

  // Log the send on the opp activity timeline + notify the sender.
  const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  await prisma.task
    .create({
      data: {
        recordType: "ACTIVITY",
        type: "EMAIL",
        status: "COMPLETED",
        completedAt: new Date(),
        subject: `Quote emailed to ${to}`,
        notes: `Estimated savings ${money(q.figures.youSave)} (${q.figures.savingsPercent}%), weekly ${money(q.figures.weeklyPayment)}, ${q.figures.programMonths} months.${sent.ok ? "" : ` SEND FAILED: ${sent.error ?? "unknown"}`}`,
        ownerId: session.userId,
        opportunityId: id,
      },
    })
    .catch(() => undefined);

  if (!sent.ok) {
    return NextResponse.json({ error: `Quote could not be sent (${sent.error ?? "unknown"}).` }, { status: 502 });
  }

  return NextResponse.json({ ok: true, sentTo: to, figures: q.figures, previewBase: appBaseUrl() });
}
