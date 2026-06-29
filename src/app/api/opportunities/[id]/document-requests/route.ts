import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { sendESignEmail } from "@/lib/esign/send-email";
import { renderDocRequestHtml, uploadUrl } from "@/lib/document-request";

// GET — list the document requests already sent for this opportunity.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Opportunity.Read");
  if ("response" in r) return r.response;
  const { id } = await params;
  const items = await prisma.documentRequest.findMany({
    where: { opportunityId: id },
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(items);
}

// POST — create a document-request link and email it to the recipient.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Opportunity.Edit");
  if ("response" in r) return r.response;
  const { session } = r;
  const { id } = await params;

  const opp = await prisma.opportunity.findUnique({
    where: { id },
    select: { id: true, accountId: true, leadId: true },
  });
  if (!opp) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    recipientEmail?: string;
    recipientName?: string;
    message?: string;
    expiresInDays?: number;
  };

  const recipientEmail = (body.recipientEmail ?? "").trim();
  if (!recipientEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipientEmail)) {
    return NextResponse.json({ error: "A valid recipient email is required" }, { status: 400 });
  }

  const days = Number.isFinite(body.expiresInDays) ? Number(body.expiresInDays) : 14;
  const expiresAt =
    days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;

  const req = await prisma.documentRequest.create({
    data: {
      opportunityId: opp.id,
      accountId: opp.accountId ?? null,
      leadId: opp.leadId ?? null,
      recipientEmail,
      recipientName: body.recipientName?.trim() || null,
      message: body.message?.trim() || null,
      expiresAt,
      createdById: session.userId,
    },
  });

  const sender = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true },
  });

  const from = process.env.EMAIL_FROM ?? "Coastal Debt <no-reply@coastaldebt.com>";
  const sent = await sendESignEmail({
    from,
    to: recipientEmail,
    subject: "Please upload your documents",
    html: renderDocRequestHtml({
      recipientName: req.recipientName,
      senderName: sender?.name ?? null,
      message: req.message,
      uploadUrl: uploadUrl(req.token),
    }),
    replyTo: session.email,
  });

  return NextResponse.json({
    id: req.id,
    token: req.token,
    url: uploadUrl(req.token),
    emailed: sent.ok,
    emailError: sent.ok ? undefined : sent.error,
  });
}
