import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

const TYPES = ["BUG", "IDEA", "PARITY"] as const;
const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

// GET - admins see everything (optionally ?status= / ?type=); everyone else
// sees their own submissions (the "my reports" list in the widget).
export async function GET(request: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { session } = r;

  const isAdmin = ADMIN_ROLES.includes(session.role);
  const sp = request.nextUrl.searchParams;
  const mine = sp.get("mine") === "1" || !isAdmin;

  const where: Record<string, unknown> = {};
  if (mine) where.userId = session.userId;
  const status = sp.get("status");
  if (status) where.status = status;
  const type = sp.get("type");
  if (type) where.type = type;

  const items = await prisma.feedback.findMany({
    where,
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: mine ? 20 : 500,
  });
  return NextResponse.json(items);
}

// POST - any authenticated user files feedback; admins get a notification.
export async function POST(request: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { session } = r;

  const b = (await request.json().catch(() => ({}))) as {
    type?: string;
    message?: string;
    pageUrl?: string;
  };
  const type = TYPES.includes(b.type as (typeof TYPES)[number]) ? (b.type as string) : "BUG";
  const message = (b.message ?? "").trim().slice(0, 5000);
  if (!message) {
    return NextResponse.json({ error: "Please describe the issue or idea." }, { status: 400 });
  }

  const item = await prisma.feedback.create({
    data: {
      userId: session.userId,
      type,
      message,
      pageUrl: (b.pageUrl ?? "").slice(0, 500) || null,
      userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    },
  });

  // Best-effort: notify admin users so reports surface without polling.
  try {
    const submitter = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true },
    });
    const admins = await prisma.user.findMany({
      where: { role: { in: ADMIN_ROLES }, isActive: true },
      select: { id: true },
    });
    const TYPE_LABEL: Record<string, string> = {
      BUG: "Bug report",
      IDEA: "Idea",
      PARITY: "Different from Salesforce",
    };
    await prisma.notification.createMany({
      data: admins
        .filter((a) => a.id !== session.userId)
        .map((a) => ({
          recipientId: a.id,
          kind: "GENERIC",
          title: `${TYPE_LABEL[type] ?? "Feedback"} from ${submitter?.name ?? "a user"}`,
          body: message.slice(0, 140),
          url: "/settings/feedback",
          entityType: "Feedback",
          entityId: item.id,
        })),
    });
  } catch {
    // notification failure must not block the submission
  }

  return NextResponse.json({ id: item.id, ok: true });
}
