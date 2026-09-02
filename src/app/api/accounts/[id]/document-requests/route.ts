import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { sendESignEmail } from "@/lib/esign/send-email";
import { renderDocRequestHtml, renderInfoRequestHtml, uploadUrl, intakeUrl } from "@/lib/document-request";

// GET - list the document/info requests already sent for this account.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Account.View");
  if ("response" in r) return r.response;
  const { id } = await params;
  const items = await prisma.documentRequest.findMany({
    where: { accountId: id },
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(items);
}

// POST - create a request link and email it to the recipient.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Account.Edit");
  if ("response" in r) return r.response;
  const { session } = r;
  const { id } = await params;

  const account = await prisma.account.findUnique({
    where: { id },
    select: { id: true, opportunities: { select: { id: true, leadId: true }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  const activeOpp = account.opportunities[0];

  const body = (await request.json().catch(() => ({}))) as {
    recipientEmail?: string; recipientName?: string; message?: string;
    expiresInDays?: number; kind?: string; requestedFields?: unknown;
  };

  const VALID_FIELDS = ["address", "ssn", "ein", "dob", "debts", "bank"] as const;
  const requestedFields = Array.isArray(body.requestedFields)
    ? VALID_FIELDS.filter((k) => (body.requestedFields as unknown[]).includes(k))
    : [];

  const recipientEmail = (body.recipientEmail ?? "").trim();
  if (!recipientEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipientEmail)) {
    return NextResponse.json({ error: "A valid recipient email is required" }, { status: 400 });
  }

  const kind = body.kind === "INFO" ? "INFO" : "DOCUMENTS";
  const days = Number.isFinite(body.expiresInDays) ? Number(body.expiresInDays) : 14;
  const expiresAt = days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;

  const req = await prisma.documentRequest.create({
    data: {
      accountId: account.id,
      opportunityId: activeOpp?.id ?? null,
      leadId: activeOpp?.leadId ?? null,
      recipientEmail,
      recipientName: body.recipientName?.trim() || null,
      message: body.message?.trim() || null,
      kind,
      requestedFields: kind === "INFO" && requestedFields.length ? JSON.stringify(requestedFields) : null,
      expiresAt,
      createdById: session.userId,
    },
  });

  const sender = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } });
  const link = kind === "INFO" ? intakeUrl(req.token) : uploadUrl(req.token);
  const from = process.env.EMAIL_FROM ?? "Coastal Debt <no-reply@coastaldebt.com>";
  const sent = await sendESignEmail({
    from,
    to: recipientEmail,
    subject: kind === "INFO" ? "Please confirm your information" : "Please upload your documents",
    html:
      kind === "INFO"
        ? renderInfoRequestHtml({
            recipientName: req.recipientName, senderName: sender?.name ?? null, message: req.message,
            intakeUrl: link, requestedFields: requestedFields.length ? requestedFields : ["address"],
            expiresDays: days > 0 ? days : undefined,
          })
        : renderDocRequestHtml({ recipientName: req.recipientName, senderName: sender?.name ?? null, message: req.message, uploadUrl: link }),
    replyTo: session.email,
  });

  return NextResponse.json({ id: req.id, token: req.token, url: link, emailed: sent.ok, emailError: sent.ok ? undefined : sent.error });
}
