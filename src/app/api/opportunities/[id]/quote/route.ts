import { readCalculatorState } from "@/lib/payments/calculator-state";
import { createHash } from "node:crypto";
import { z } from "zod";
import { canAccessRecord } from "@/lib/record-access";
import { ssnSafeJson } from "@/lib/ssn-safe-json";
import { NextRequest } from "next/server";
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
  | { revision: string; figures: QuoteFigures; recipientEmail: string | null; recipientName: string | null; businessName: string | null }
> {
  const opp = await prisma.opportunity.findUnique({
    where: { id },
    include: {
      debts: { select: { originalBalance: true, paymentAmount: true, paymentFrequency: true } },
      lead: { select: { contactName: true, businessName: true, email: true } },
      primaryContact: { select: { fullName: true, email: true } },
      account: { select: { name: true } },
      paymentCalculations: { orderBy: { savedAt: "desc" }, take: 1 },
    },
  });
  if (!opp) return { error: "Opportunity not found", status: 404 };

  const latestCalc = opp.paymentCalculations[0];
  if (latestCalc?.scheduleJson != null && !readCalculatorState(latestCalc.scheduleJson)) return { error: "Review and save the payment calculation before sending a quote.", status: 409 };
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

  const perWeek: Record<string, number> = { DAILY: 5, WEEKLY: 1, BI_WEEKLY: 0.5, MONTHLY: 0.25, LUMP_SUM: 0 };
  const currentWeekly = opp.currentWeeklyPayment || opp.debts.reduce((sum, debt) =>
    debt.paymentAmount != null && debt.paymentAmount > 0 && debt.paymentFrequency
      ? sum + debt.paymentAmount * (perWeek[debt.paymentFrequency] ?? 1) : sum, 0);
  let figures: QuoteFigures;
  try { figures = computeQuote({
    totalDebt: latestCalc?.totalDebt ?? totalDebtVal,
    termMonths,
    citadelFee: latestCalc?.citadelFee ?? undefined,
    currentWeeklyPayment: currentWeekly || null,
    savedState: latestCalc?.scheduleJson,
    firstPaymentDate: latestCalc?.firstPaymentDate?.toISOString().slice(0, 10),
  }); } catch (error) {
    return { error: `Review and save the payment calculation: ${error instanceof Error ? error.message : "Invalid schedule"}`, status: 409 };
  }

  return {
    revision: createHash("sha256").update(JSON.stringify({ figures, calculationId: latestCalc?.id ?? null })).digest("hex"),
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
  if (!await canAccessRecord("opportunity", id)) return Response.json({ error: "Not found" }, { status: 404 });
  const q = await loadQuote(id);
  if ("error" in q) return ssnSafeJson({ error: q.error }, { status: q.status });
  return ssnSafeJson(q);
}

// POST - send the branded quote email to the client.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Opportunity.View");
  if ("response" in r) return r.response;
  const { session } = r;
  const { id } = await params;
  if (!await canAccessRecord("opportunity", id)) return Response.json({ error: "Not found" }, { status: 404 });

  const q = await loadQuote(id);
  if ("error" in q) return ssnSafeJson({ error: q.error }, { status: q.status });

  const parsed = z.object({
    recipientEmail: z.string().trim().email(),
    recipientName: z.string().max(200).optional(),
    note: z.string().max(5000).optional(),
    revision: z.string(),
    requestId: z.string().uuid(),
  }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return ssnSafeJson({ error: "Reload the quote and enter a valid recipient email." }, { status: 400 });
  const body = parsed.data;
  if (body.revision !== q.revision) return ssnSafeJson({ error: "The payment calculation changed. Close and reopen the quote to review the updated figures." }, { status: 409 });
  const to = (body.recipientEmail ?? q.recipientEmail ?? "").trim();
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return ssnSafeJson({ error: "A valid recipient email is required." }, { status: 400 });
  }
  if (q.figures.enrolledDebt <= 0) {
    return ssnSafeJson(
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
    callPhone: process.env.QUOTE_CALL_PHONE ?? "(888) 707-7177",
  });

  const deliveryKey = `quote-${id}-${createHash("sha256").update(JSON.stringify(body)).digest("hex")}`;
  const from = process.env.EMAIL_FROM ?? "Coastal Debt <no-reply@coastaldebt.com>";
  const sent = await sendESignEmail({
    from,
    to,
    subject: `Your debt relief quote - save an estimated $${Math.round(q.figures.youSave).toLocaleString("en-US")}`,
    html,
    replyTo: session.email,
    idempotencyKey: deliveryKey,
  });

  if (!sent.ok) {
    return ssnSafeJson({ error: `Quote could not be sent (${sent.error ?? "unknown"}).` }, { status: 502 });
  }

  // Log a successful send once, including safe retries with the same request ID.
  const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  await prisma.task
    .upsert({
      where: { id: deliveryKey },
      update: {},
      create: {
        id: deliveryKey,
        recordType: "ACTIVITY",
        type: "EMAIL",
        status: "COMPLETED",
        completedAt: new Date(),
        subject: `Quote emailed to ${to}`,
        notes: `Estimated savings ${money(q.figures.youSave)} (${q.figures.savingsPercent}%), weekly ${money(q.figures.weeklyPayment)}, ${q.figures.programMonths} months.`,
        ownerId: session.userId,
        opportunityId: id,
      },
    })
    .catch(() => undefined);

  return ssnSafeJson({ ok: true, sentTo: to, figures: q.figures, previewBase: appBaseUrl() });
}
