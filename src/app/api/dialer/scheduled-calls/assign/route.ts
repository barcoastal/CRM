import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sendESignEmail } from "@/lib/esign/send-email";
import { calendarLinks } from "@/lib/scheduled-calls";
import { sendSmsNow } from "@/lib/sms-sender";

/**
 * POST /api/dialer/scheduled-calls/assign - floor manager assigns a closer to a
 * scheduled call; the closer gets an email with the client, debt, time, and
 * one-click add-to-calendar links.
 */
const Body = z.object({ id: z.string(), closerId: z.string() });

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const call = await prisma.scheduledCall.findUnique({ where: { id: parsed.data.id } });
  if (!call || !call.requestedAt) return NextResponse.json({ error: "Call not found or no time set" }, { status: 404 });
  const closer = await prisma.user.findUnique({ where: { id: parsed.data.closerId }, select: { name: true, email: true, mobile: true } });
  if (!closer) return NextResponse.json({ error: "Closer not found" }, { status: 404 });

  await prisma.scheduledCall.update({
    where: { id: call.id },
    data: { closerId: parsed.data.closerId, closerName: closer.name, assignedById: r.session.userId, assignedAt: new Date(), status: "ASSIGNED" },
  });

  // Text the closer's mobile too (best-effort, in addition to the email).
  if (closer.mobile) {
    const whenShort = call.requestedAt.toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    await sendSmsNow({
      to: closer.mobile,
      body: `New call assigned: ${call.clientName ?? "Client"}${call.debtLabel ? ` (${call.debtLabel}${call.tier ? `, T${call.tier}` : ""})` : ""} at ${whenShort} ET. Phone: ${call.clientPhone ?? "n/a"}.`,
    }).catch(() => undefined);
  }

  // Invite the closer (best-effort).
  if (closer.email) {
    const title = `Call: ${call.clientName ?? "Client"}${call.debtLabel ? ` (${call.debtLabel})` : ""}`;
    const when = call.requestedAt.toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    const details = `Debt settlement call with ${call.clientName ?? "the client"}. Debt: ${call.debtLabel ?? "n/a"}. Phone: ${call.clientPhone ?? "n/a"}.`;
    const links = calendarLinks(title, call.requestedAt.toISOString(), details);
    const oppLink = call.opportunityId ? `${process.env.NEXT_PUBLIC_APP_URL ?? "https://crm.coastaldebt-tools.com"}/opportunities/${call.opportunityId}` : null;
    const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:auto;color:#16325c">
      <p style="font-size:15px">You've been assigned a scheduled call.</p>
      <table style="font-size:14px;line-height:1.8">
        <tr><td style="color:#8a94a6;padding-right:12px">Client</td><td style="font-weight:700">${call.clientName ?? "-"}</td></tr>
        <tr><td style="color:#8a94a6;padding-right:12px">Debt</td><td style="font-weight:700">${call.debtLabel ?? "-"}${call.tier ? ` (Tier ${call.tier})` : ""}</td></tr>
        <tr><td style="color:#8a94a6;padding-right:12px">Phone</td><td>${call.clientPhone ?? "-"}</td></tr>
        <tr><td style="color:#8a94a6;padding-right:12px">Time</td><td style="font-weight:700">${when} (ET)</td></tr>
      </table>
      <p style="margin:20px 0 8px">
        <a href="${links.google}" style="background:#0176d3;color:#fff;text-decoration:none;padding:9px 18px;border-radius:6px;font-weight:700;font-size:13px;margin-right:8px">Add to Google Calendar</a>
        <a href="${links.outlook}" style="color:#0176d3;text-decoration:none;font-size:13px">Outlook</a>
      </p>
      ${oppLink ? `<p style="font-size:12px"><a href="${oppLink}" style="color:#0176d3">Open the opportunity in the CRM</a></p>` : ""}
    </div>`;
    const from = process.env.EMAIL_FROM ?? "Coastal Debt <no-reply@coastaldebt.com>";
    await sendESignEmail({ from, to: closer.email, subject: `Scheduled call: ${call.clientName ?? "Client"} at ${when} ET`, html }).catch(() => undefined);
  }

  return NextResponse.json({ ok: true, closerName: closer.name });
}
