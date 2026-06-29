import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendESignEmail } from "@/lib/esign/send-email";
import { appBaseUrl } from "@/lib/document-request";

// Public (no-login) endpoint for INFO requests. The token is the only secret.

async function loadRequest(token: string) {
  return prisma.documentRequest.findUnique({
    where: { token },
    select: {
      id: true,
      kind: true,
      status: true,
      expiresAt: true,
      recipientName: true,
      opportunityId: true,
      accountId: true,
      createdById: true,
    },
  });
}

function liveState(req: { status: string; expiresAt: Date | null }): "OK" | "EXPIRED" | "CLOSED" {
  if (req.status === "CANCELLED") return "CLOSED";
  if (req.expiresAt && req.expiresAt.getTime() < Date.now()) return "EXPIRED";
  return "OK";
}

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const req = await loadRequest(token);
  if (!req || req.kind !== "INFO") return NextResponse.json({ error: "not_found" }, { status: 404 });

  const state = liveState(req);
  if (state !== "OK") return NextResponse.json({ error: state.toLowerCase() }, { status: 410 });

  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const info = {
    street: str(b.street),
    city: str(b.city),
    state: str(b.state, 40),
    zip: str(b.zip, 20),
    phone: str(b.phone, 40),
    email: str(b.email, 200),
    notes: str(b.notes, 4000),
  };

  // Save the address + contact onto the Account (only overwrite when provided).
  if (req.accountId) {
    const data: Record<string, string> = {};
    if (info.street) data.billingStreet = info.street;
    if (info.city) data.billingCity = info.city;
    if (info.state) data.billingState = info.state;
    if (info.zip) data.billingZip = info.zip;
    if (info.phone) data.phone = info.phone;
    if (info.email) data.email = info.email;
    if (Object.keys(data).length) {
      await prisma.account.update({ where: { id: req.accountId }, data }).catch(() => undefined);
    }
  }

  // Log everything the client submitted as a NOTE task on the opp + account so
  // it shows in the activity timeline (and the free-text "anything else").
  const addrLine = [info.street, info.city, info.state, info.zip].filter(Boolean).join(", ");
  const noteBody = [
    addrLine && `Address: ${addrLine}`,
    info.phone && `Phone: ${info.phone}`,
    info.email && `Email: ${info.email}`,
    info.notes && `Notes: ${info.notes}`,
  ]
    .filter(Boolean)
    .join("\n");

  await prisma.task
    .create({
      data: {
        recordType: "ACTIVITY",
        type: "NOTE",
        status: "COMPLETED",
        subject: `Client submitted info${req.recipientName ? ` - ${req.recipientName}` : ""}`,
        description: noteBody || "(no fields filled)",
        opportunityId: req.opportunityId ?? null,
        accountId: req.accountId ?? null,
      },
    })
    .catch(() => undefined);

  await prisma.documentRequest.update({
    where: { id: req.id },
    data: { status: "COMPLETED", completedAt: new Date(), collectedJson: info },
  });

  // Notify the rep (best-effort).
  try {
    const url = req.opportunityId ? `/opportunities/${req.opportunityId}` : "/";
    const who = req.recipientName || "A client";
    await prisma.notification.create({
      data: {
        recipientId: req.createdById,
        kind: "GENERIC",
        title: `${who} submitted their information`,
        body: addrLine || info.email || info.phone || "Info received",
        url,
        entityType: req.opportunityId ? "Opportunity" : "Account",
        entityId: req.opportunityId ?? req.accountId ?? undefined,
      },
    });
    const rep = await prisma.user.findUnique({
      where: { id: req.createdById },
      select: { email: true },
    });
    if (rep?.email) {
      const from = process.env.EMAIL_FROM ?? "Coastal Debt <no-reply@coastaldebt.com>";
      await sendESignEmail({
        from,
        to: rep.email,
        subject: `${who} submitted their information`,
        html: `<p>${who} submitted their info.</p><pre style="font-family:inherit">${noteBody.replace(/</g, "&lt;")}</pre><p><a href="${appBaseUrl()}${url}">Open in the CRM</a></p>`,
      });
    }
  } catch {
    // ignore notification failures
  }

  return NextResponse.json({ ok: true });
}
