/**
 * Click-tracking redirect. Decodes ?u=<base64 url>, validates it's an
 * http(s) URL, bumps click counters, then 302-redirects the recipient
 * to the original URL. Public — no auth.
 *
 * Counter rules mirror the pixel endpoint: EmailMessage.clickCount is
 * incremented every hit; MassEmail.clickCount is only incremented on
 * the FIRST click for that message (unique clicks at the blast level).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeTrackedUrl } from "@/lib/email/tracking-rewrite";

export async function GET(req: NextRequest, ctx: { params: Promise<{ trackingId: string }> }) {
  const { trackingId } = await ctx.params;
  const u = req.nextUrl.searchParams.get("u");
  const target = u ? decodeTrackedUrl(u) : null;

  if (!target) {
    return NextResponse.json({ error: "Invalid or missing url" }, { status: 400 });
  }

  try {
    const msg = await prisma.emailMessage.findUnique({
      where: { trackingId },
      select: { id: true, firstClickedAt: true, massEmailId: true },
    });
    if (msg) {
      const isFirst = !msg.firstClickedAt;
      const now = new Date();
      await prisma.emailMessage.update({
        where: { id: msg.id },
        data: {
          clickCount: { increment: 1 },
          firstClickedAt: msg.firstClickedAt ?? now,
          clickedAt: now,
          status: "CLICKED",
        },
      });
      if (isFirst && msg.massEmailId) {
        await prisma.massEmail.update({
          where: { id: msg.massEmailId },
          data: { clickCount: { increment: 1 } },
        });
      }
    }
  } catch {
    // swallow — still redirect the user
  }

  return NextResponse.redirect(target, { status: 302 });
}
