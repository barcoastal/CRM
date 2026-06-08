/**
 * POST /api/emails/mass/[id]/preview — returns the merged + instrumented
 * HTML for one recipient so the UI can iframe it before send.
 *
 * Body: { recipientId?: string }. If recipientId is omitted, picks the
 * first recipient in the resolved audience. Pixel + click-rewriting are
 * applied with a placeholder trackingId so the preview matches what the
 * recipient will actually receive.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { instrumentBody, resolveAudience } from "@/lib/email/mass-sender";
import { getTrackingBaseUrl } from "@/lib/email/tracking-rewrite";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as { recipientId?: string };

  const mass = await prisma.massEmail.findUnique({
    where: { id },
    include: { template: true },
  });
  if (!mass) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!mass.template) return NextResponse.json({ error: "Template missing" }, { status: 400 });

  const filter = (mass.audienceFilter ?? {}) as Record<string, unknown>;
  const recipients = await resolveAudience(mass.audienceType, filter as never, mass.audienceIds);
  if (recipients.length === 0) {
    return NextResponse.json({ error: "No recipients" }, { status: 400 });
  }

  const recipient =
    (body.recipientId && recipients.find((rc) => rc.id === body.recipientId)) || recipients[0];

  const baseUrl = getTrackingBaseUrl();
  const rendered = instrumentBody(
    mass.template.bodyHtml,
    mass.template.bodyText,
    mass.template.subject,
    recipient.vars,
    "preview-" + recipient.id.slice(0, 8),
    baseUrl,
  );

  return NextResponse.json({
    recipient: { id: recipient.id, email: recipient.email, entityType: recipient.entityType },
    subject: rendered.subject,
    html: rendered.html ?? "",
    text: rendered.text ?? "",
    totalRecipients: recipients.length,
  });
}
