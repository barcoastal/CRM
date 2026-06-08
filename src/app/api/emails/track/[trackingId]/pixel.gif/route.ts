/**
 * Open-tracking pixel. Returns a 1x1 transparent GIF and bumps the
 * open counters on the matching EmailMessage + MassEmail (first-open only
 * for the parent MassEmail.openCount, so it represents unique opens).
 *
 * Public endpoint — recipients hit this from their email clients with no
 * session cookie. No auth.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 1x1 transparent GIF, base64.
const PIXEL_B64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const PIXEL_BUFFER = Buffer.from(PIXEL_B64, "base64");

function pixelResponse(): Response {
  return new Response(PIXEL_BUFFER, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL_BUFFER.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ trackingId: string }> }) {
  const { trackingId } = await ctx.params;
  if (!trackingId) return pixelResponse();

  // Best-effort tracking. Never let DB errors block the pixel response.
  try {
    const msg = await prisma.emailMessage.findUnique({
      where: { trackingId },
      select: { id: true, openedAt: true, massEmailId: true },
    });
    if (msg) {
      const isFirst = !msg.openedAt;
      await prisma.emailMessage.update({
        where: { id: msg.id },
        data: {
          openCount: { increment: 1 },
          openedAt: msg.openedAt ?? new Date(),
          status: isFirst ? "OPENED" : undefined,
        },
      });
      if (isFirst && msg.massEmailId) {
        await prisma.massEmail.update({
          where: { id: msg.massEmailId },
          data: { openCount: { increment: 1 } },
        });
      }
    }
  } catch {
    // swallow — pixel still returns 200
  }

  return pixelResponse();
}

// Some clients send a HEAD probe before fetching.
export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store",
    },
  });
}
