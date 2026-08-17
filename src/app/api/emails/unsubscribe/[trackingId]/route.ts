/**
 * Unsubscribe landing. The tracking id maps to the exact EmailMessage that
 * carried the link, so we know the recipient address without a signed token.
 * GET renders a tiny confirmation page and suppresses; POST supports RFC 8058
 * one-click (mail clients POST with no body).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addEmailSuppression } from "@/lib/email/suppression";
import { extractEmails } from "@/lib/email/threading";

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function suppressByTrackingId(trackingId: string): Promise<string | null> {
  const msg = await prisma.emailMessage.findUnique({
    where: { trackingId },
    select: { toAddresses: true },
  });
  if (!msg) return null;
  const email = extractEmails(msg.toAddresses)[0] ?? null;
  if (!email) return null;
  await addEmailSuppression(email, "UNSUBSCRIBE", "unsubscribe-link");
  return email;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ trackingId: string }> }) {
  const { trackingId } = await ctx.params;
  const email = await suppressByTrackingId(trackingId);
  const message = email
    ? `${escHtml(email)} has been unsubscribed. You will not receive marketing email from us again.`
    : "This unsubscribe link is invalid or expired.";
  return new NextResponse(
    `<!doctype html><html><head><title>Unsubscribe</title></head><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f7f7f6"><div style="max-width:420px;background:#fff;border:1px solid #e6e6e3;border-radius:14px;padding:32px;text-align:center"><h1 style="font-size:18px;margin:0 0 8px">Coastal Debt</h1><p style="font-size:14px;color:#444">${message}</p></div></body></html>`,
    { status: email ? 200 : 404, headers: { "Content-Type": "text/html" } },
  );
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ trackingId: string }> }) {
  const { trackingId } = await ctx.params;
  const email = await suppressByTrackingId(trackingId);
  return NextResponse.json({ ok: Boolean(email) }, { status: email ? 200 : 404 });
}
