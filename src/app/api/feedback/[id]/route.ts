import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];
const STATUSES = ["NEW", "IN_PROGRESS", "DONE", "WONT_FIX"];

// PATCH - admins update status / notes. The submitter gets a notification
// when the status changes so they know their report went somewhere.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { session } = r;
  if (!ADMIN_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const b = (await request.json().catch(() => ({}))) as {
    status?: string;
    adminNotes?: string;
  };
  const data: Record<string, string> = {};
  if (b.status && STATUSES.includes(b.status)) data.status = b.status;
  if (typeof b.adminNotes === "string") data.adminNotes = b.adminNotes.slice(0, 2000);
  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const existing = await prisma.feedback.findUnique({
    where: { id },
    select: { userId: true, status: true, message: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const item = await prisma.feedback.update({ where: { id }, data });

  if (data.status && data.status !== existing.status && existing.userId !== session.userId) {
    const STATUS_LABEL: Record<string, string> = {
      IN_PROGRESS: "is being worked on",
      DONE: "is done",
      WONT_FIX: "was reviewed and closed",
      NEW: "was reopened",
    };
    await prisma.notification
      .create({
        data: {
          recipientId: existing.userId,
          kind: "GENERIC",
          title: `Your feedback ${STATUS_LABEL[data.status] ?? "was updated"}`,
          body: existing.message.slice(0, 140),
          url: "/",
          entityType: "Feedback",
          entityId: id,
        },
      })
      .catch(() => undefined);
  }

  return NextResponse.json(item);
}
