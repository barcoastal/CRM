import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

// POST - add a note (a COMPLETED Task of type NOTE) attached to the record
// chain (lead / opportunity / account) so it shows in the unified Notes card
// on every related page.
export async function POST(request: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { session } = r;

  const b = (await request.json().catch(() => ({}))) as {
    body?: string;
    leadId?: string;
    opportunityId?: string;
    accountId?: string;
  };
  const body = (b.body ?? "").trim().slice(0, 10000);
  if (!body) return NextResponse.json({ error: "Note text is required." }, { status: 400 });
  const leadId = typeof b.leadId === "string" && b.leadId ? b.leadId : null;
  const opportunityId = typeof b.opportunityId === "string" && b.opportunityId ? b.opportunityId : null;
  const accountId = typeof b.accountId === "string" && b.accountId ? b.accountId : null;
  if (!leadId && !opportunityId && !accountId) {
    return NextResponse.json({ error: "A record to attach the note to is required." }, { status: 400 });
  }

  const note = await prisma.task.create({
    data: {
      recordType: "ACTIVITY",
      type: "NOTE",
      status: "COMPLETED",
      completedAt: new Date(),
      subject: body.length > 80 ? `${body.slice(0, 77)}...` : body,
      notes: body,
      ownerId: session.userId,
      leadId,
      opportunityId,
      accountId,
    },
  });

  return NextResponse.json({ id: note.id, ok: true }, { status: 201 });
}
