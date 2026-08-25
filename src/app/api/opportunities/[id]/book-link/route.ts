import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { sendESignEmail } from "@/lib/esign/send-email";
import { createBookingLink } from "@/lib/scheduled-calls";

/**
 * POST /api/opportunities/[id]/book-link
 * Create a booking link for the opp and email it to the client so they can pick
 * a time to talk to a closer.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Opportunity.View");
  if ("response" in r) return r.response;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { email?: string };

  const res = await createBookingLink(id);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 404 });

  const to = (body.email ?? res.call.clientEmail ?? "").trim();
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return NextResponse.json({ error: "No valid client email on this opportunity.", url: res.url }, { status: 400 });
  }

  const name = res.call.clientName ?? "there";
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:auto;color:#16325c">
    <p style="font-size:15px">Hi ${name},</p>
    <p style="font-size:14px;line-height:1.6">Let's get your debt relief plan moving. Pick a time that works and one of our specialists will call you.</p>
    <p style="text-align:center;margin:28px 0">
      <a href="${res.url}" style="background:#0176d3;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:700;font-size:15px">Schedule my call</a>
    </p>
    <p style="font-size:12px;color:#8a94a6">Or paste this link: ${res.url}</p>
    <p style="font-size:12px;color:#8a94a6">Coastal Debt Resolve</p>
  </div>`;

  const from = process.env.EMAIL_FROM ?? "Coastal Debt <no-reply@coastaldebt.com>";
  const sent = await sendESignEmail({ from, to, subject: "Schedule your call with Coastal Debt", html, replyTo: r.session.email });
  if (!sent.ok) return NextResponse.json({ error: `Could not send (${sent.error ?? "unknown"}).`, url: res.url }, { status: 502 });

  return NextResponse.json({ ok: true, sentTo: to, url: res.url });
}
