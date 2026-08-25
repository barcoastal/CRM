import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { availableSlots } from "@/lib/scheduled-calls";

/** Public: GET the booking info + available slots for a token. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const call = await prisma.scheduledCall.findUnique({
    where: { token },
    select: { clientName: true, status: true, requestedAt: true },
  });
  if (!call) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    clientName: call.clientName,
    status: call.status,
    requestedAt: call.requestedAt,
    slots: call.status === "SENT" ? availableSlots() : [],
  });
}

/** Public: POST to book a slot. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = (await req.json().catch(() => ({}))) as { slot?: string };
  const slot = body.slot ? new Date(body.slot) : null;
  if (!slot || Number.isNaN(slot.getTime()) || slot.getTime() < Date.now()) {
    return NextResponse.json({ error: "Pick a valid future time." }, { status: 400 });
  }
  const call = await prisma.scheduledCall.findUnique({ where: { token }, select: { id: true } });
  if (!call) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.scheduledCall.update({
    where: { token },
    data: { requestedAt: slot, status: "REQUESTED" },
  });
  return NextResponse.json({ ok: true });
}
