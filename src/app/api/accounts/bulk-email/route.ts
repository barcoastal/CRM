import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  subject: z.string().min(1).max(500),
  bodyHtml: z.string().optional().nullable(),
  bodyText: z.string().optional().nullable(),
  sendNow: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const { ids, subject, bodyHtml, bodyText, sendNow } = parsed.data;

  const accounts = await prisma.account.findMany({
    where: { id: { in: ids }, email: { not: null } },
    select: { id: true, email: true },
  });

  if (accounts.length === 0) {
    return NextResponse.json({ ok: false, error: "No selected accounts have an email address" }, { status: 400 });
  }

  const defaultFrom = process.env.EMAIL_FROM ?? "Coastal Debt <no-reply@coastaldebt.com>";
  const initialStatus = sendNow ? "QUEUED" : "DRAFT";

  const created = await prisma.$transaction(
    accounts.map((a) =>
      prisma.emailMessage.create({
        data: {
          direction: "OUTBOUND",
          status: initialStatus,
          fromAddress: defaultFrom,
          toAddresses: a.email as string,
          subject,
          bodyHtml: bodyHtml ?? null,
          bodyText: bodyText ?? null,
          accountId: a.id,
          ownerId: r.session.userId,
        },
        select: { id: true },
      }),
    ),
  );

  let sent = 0;
  if (sendNow) {
    const { sendQueuedEmail } = await import("@/lib/email-sender");
    for (const msg of created) {
      const result = await sendQueuedEmail(msg.id);
      if (result.ok) sent++;
    }
  }

  return NextResponse.json({
    ok: true,
    queued: created.length,
    sent,
    skipped: ids.length - accounts.length,
  });
}
