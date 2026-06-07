import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * POST /api/calls/log
 *
 * Quick-action "Log a Call" endpoint. Creates a manual Call row with
 * status COMPLETED, the chosen disposition, and the current user as agent.
 * Used from the QuickActionsRow on any entity detail page (Lead/Opp/Account/
 * Contact). The Call model only directly relates to a Lead; for other
 * entities the call still lands in the activity stream because we accept
 * accountId / opportunityId / contactId and stash them in notes when the
 * direct FK doesn't exist (best-effort surfacing).
 */

const schema = z.object({
  phoneNumber: z.string().min(1),
  disposition: z.string().min(1),
  duration: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
  leadId: z.string().cuid().optional(),
  opportunityId: z.string().cuid().optional(),
  accountId: z.string().cuid().optional(),
  contactId: z.string().cuid().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const noteSuffix: string[] = [];
  if (d.opportunityId) noteSuffix.push(`Opportunity: ${d.opportunityId}`);
  if (d.accountId) noteSuffix.push(`Account: ${d.accountId}`);
  if (d.contactId) noteSuffix.push(`Contact: ${d.contactId}`);
  const notes = [d.notes, noteSuffix.length ? `\n\n--\n${noteSuffix.join("\n")}` : null]
    .filter(Boolean)
    .join("");

  const now = new Date();
  const startedAt = d.duration ? new Date(now.getTime() - d.duration * 1000) : now;
  const call = await prisma.call.create({
    data: {
      direction: "OUTBOUND",
      status: "COMPLETED",
      disposition: d.disposition,
      phoneNumber: d.phoneNumber,
      duration: d.duration ?? null,
      startedAt,
      answeredAt: startedAt,
      endedAt: now,
      notes: notes || null,
      leadId: d.leadId ?? null,
      agentId: session.user.id,
    },
  });

  return NextResponse.json(call, { status: 201 });
}
