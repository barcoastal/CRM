import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { availableSlots, matchClientForBooking } from "@/lib/scheduled-calls";

/** Public GET - available slots for the generic (Calendly-style) booking page. */
export async function GET() {
  return NextResponse.json({ slots: availableSlots() });
}

/** Public POST - client books a time from the generic link. Matches them to
 *  their record for the debt/tier, then lands in the floor manager queue. */
const Body = z.object({
  name: z.string().min(1),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  slot: z.string(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Please enter your name and pick a time." }, { status: 400 });
  const { name, email, phone, slot } = parsed.data;
  const when = new Date(slot);
  if (Number.isNaN(when.getTime()) || when.getTime() < Date.now()) {
    return NextResponse.json({ error: "Pick a valid future time." }, { status: 400 });
  }

  const match = await matchClientForBooking(email ?? null, phone ?? null);
  await prisma.scheduledCall.create({
    data: {
      token: `self_${Date.now().toString(36)}${Math.floor((Date.now() * (email?.length || 1)) % 1e6)}`,
      opportunityId: match.opportunityId,
      leadId: match.leadId,
      clientName: name,
      clientEmail: email ?? null,
      clientPhone: phone ?? null,
      debt: match.debt,
      debtLabel: match.debtLabel,
      tier: match.tier,
      requestedAt: when,
      status: "REQUESTED",
    },
  });
  return NextResponse.json({ ok: true });
}
