/**
 * GET /api/email-center/reports/record-activity?entity=lead|account|contact&id=<id>
 *
 * Returns every email tied to the record with its open/click status and source
 * (inbox, campaign name, or flow name). Used by the Email Activity panel on
 * record detail pages. Gated by Email.Send; record access is already gated by
 * the record page itself.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const url = new URL(req.url);
  const entity = url.searchParams.get("entity");
  const id = url.searchParams.get("id");
  if (!id || !entity) return NextResponse.json({ error: "entity and id required" }, { status: 400 });

  const where =
    entity === "account" ? { accountId: id } :
    entity === "contact" ? { contactId: id } :
    { leadId: id };

  const messages = await prisma.emailMessage.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, direction: true, subject: true, status: true, toAddresses: true, fromAddress: true,
      openCount: true, clickCount: true, createdAt: true, sentAt: true,
      massEmail: { select: { name: true } },
      flow: { select: { name: true } },
    },
  });

  return NextResponse.json({
    items: messages.map((m) => ({
      id: m.id,
      direction: m.direction,
      subject: m.subject || "(no subject)",
      status: m.status,
      counterparty: m.direction === "INBOUND" ? m.fromAddress : m.toAddresses,
      openCount: m.openCount,
      clickCount: m.clickCount,
      at: (m.sentAt ?? m.createdAt).toISOString(),
      source: m.massEmail?.name
        ? `Campaign: ${m.massEmail.name}`
        : m.flow?.name
        ? `Flow: ${m.flow.name}`
        : m.direction === "INBOUND"
        ? "Inbound"
        : "Direct",
    })),
  });
}
