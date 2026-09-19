import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sendQueuedEmail } from "@/lib/email-sender";
import { isEmailSuppressed } from "@/lib/email/suppression";
import { canAccessRecord } from "@/lib/record-access";
import { hasSameOrigin } from "@/lib/request-origin";

const schema = z.object({
  email: z.string().email(), subject: z.string().trim().min(1).max(500),
  message: z.string().trim().min(1).max(50000),
  calculationSummary: z.string().max(20000).optional(),
  leadId: z.string().optional(), accountId: z.string().optional(), opportunityId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireAuthOrRespond("Email.Send");
  if ("response" in auth) return auth.response;
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid recipient, subject, and message" }, { status: 400 });
  const d = parsed.data;
  for (const [entity, id] of [["lead", d.leadId], ["account", d.accountId], ["opportunity", d.opportunityId]] as const) {
    if (id && !await canAccessRecord(entity, id)) return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: "Email delivery is not configured. No proposal was sent." }, { status: 503 });
  if (await isEmailSuppressed(d.email)) return NextResponse.json({ error: "This recipient is excluded from email delivery" }, { status: 409 });
  const msg = await prisma.emailMessage.create({ data: {
    direction: "OUTBOUND", status: "DRAFT", ownerId: auth.session.userId,
    fromAddress: process.env.EMAIL_FROM || "Coastal Debt <no-reply@coastaldebt.com>",
    toAddresses: d.email, subject: d.subject,
    bodyText: [d.message, d.calculationSummary].filter(Boolean).join("\n\n"),
    leadId: d.leadId, accountId: d.accountId, opportunityId: d.opportunityId,
  } });
  const result = await sendQueuedEmail(msg.id);
  if (!result.ok) return NextResponse.json({ success: false, messageId: msg.id, error: "Proposal delivery failed. Check the email record before retrying." }, { status: 502 });
  return NextResponse.json({ success: true, messageId: msg.id, message: "Proposal submitted for delivery" });
}
