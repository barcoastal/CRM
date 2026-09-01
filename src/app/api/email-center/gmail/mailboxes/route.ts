import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];
const DOMAIN = "@coastaldebt.com";

export async function GET() {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  if (!ADMIN_ROLES.includes(r.session.role)) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const users = await prisma.user.findMany({
    where: { isActive: true, email: { endsWith: DOMAIN, mode: "insensitive" } },
    select: { id: true, name: true, email: true, gmailSync: { select: { status: true, lastSyncedAt: true, lastError: true, syncedCount: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ items: users });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  if (!ADMIN_ROLES.includes(r.session.role)) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { bulkEnableAll?: boolean };
  if (!body.bulkEnableAll) return NextResponse.json({ error: "nothing to do" }, { status: 400 });
  const users = await prisma.user.findMany({
    where: { isActive: true, email: { endsWith: DOMAIN, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  let enabled = 0;
  for (const u of users) {
    if (!u.email) continue;
    await prisma.gmailSync.upsert({
      where: { userId: u.id },
      update: { status: "ACTIVE", emailAddress: u.email.toLowerCase() },
      create: { userId: u.id, emailAddress: u.email.toLowerCase(), status: "ACTIVE" },
    });
    enabled += 1;
  }
  return NextResponse.json({ ok: true, enabled });
}
