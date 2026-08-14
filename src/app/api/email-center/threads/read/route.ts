/** POST { threadId } marks all of the caller's inbound messages in the thread read. */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const body = (await req.json().catch(() => ({}))) as { threadId?: string };
  if (!body.threadId) return NextResponse.json({ error: "threadId required" }, { status: 400 });
  const updated = await prisma.emailMessage.updateMany({
    where: {
      OR: [{ threadId: body.threadId }, { id: body.threadId }],
      ownerId: r.session.userId,
      direction: "INBOUND",
      readAt: null,
    },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true, marked: updated.count });
}
