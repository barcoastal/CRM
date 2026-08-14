import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { createEmailSchema } from "@/lib/validations/email-message";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const url = new URL(req.url);
  const where: Record<string, unknown> = {};
  for (const key of ["accountId", "contactId", "leadId", "opportunityId", "caseId", "ownerId", "status", "direction", "threadId"] as const) {
    const v = url.searchParams.get(key);
    if (v) where[key] = v;
  }

  // Non-admins only ever see their own messages, or messages attached to a
  // record they are explicitly filtering by (record pages already gate access
  // to the record itself). Direct owner/thread browsing stays self-scoped.
  const isAdmin = ADMIN_ROLES.includes(r.session.role);
  if (!isAdmin) {
    const hasRecordFilter = Boolean(
      where.accountId || where.contactId || where.leadId || where.opportunityId || where.caseId,
    );
    if (!hasRecordFilter) {
      where.ownerId = r.session.userId;
    }
  }

  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 200);

  const items = await prisma.emailMessage.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { id: true, name: true } },
      template: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const body = await req.json().catch(() => ({}));
  const parsed = createEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const msg = await prisma.emailMessage.create({
    data: {
      ...d,
      ownerId: d.ownerId ?? r.session.userId,
    },
  });
  return NextResponse.json(msg, { status: 201 });
}
