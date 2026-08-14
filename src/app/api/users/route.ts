import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const r = await requireAuthOrRespond("User.View");
  if ("response" in r) return r.response;

  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "100")));
  const includeInactive = url.searchParams.get("includeInactive") === "true";
  const where: Record<string, unknown> = includeInactive ? {} : { isActive: true };

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatar: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      profile: { select: { id: true, name: true, label: true } },
      hierarchyRole: { select: { id: true, name: true } },
      manager: { select: { id: true, name: true } },
      _count: { select: { permissionSets: true } },
    },
    take: limit,
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ users });
}

const createUserSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.string().default("SALES_REP"),
  profileId: z.string().cuid().optional().nullable(),
  hierarchyRoleId: z.string().cuid().optional().nullable(),
  managerId: z.string().cuid().optional().nullable(),
  isActive: z.boolean().default(true),
  isCloser: z.boolean().default(false),
  five9Username: z.string().max(255).optional().nullable(),
  mailboxAddress: z.string().email().max(255).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const r = await requireAuthOrRespond("User.Create");
  if ("response" in r) return r.response;

  const body = await request.json().catch(() => ({}));
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: d.email } });
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
  }

  if (d.mailboxAddress) {
    const dupeMailbox = await prisma.user.findFirst({
      where: { mailboxAddress: { equals: d.mailboxAddress, mode: "insensitive" } },
    });
    if (dupeMailbox) {
      return NextResponse.json({ error: "Mailbox address already in use" }, { status: 409 });
    }
  }

  const passwordHash = await hash(d.password, 12);
  const user = await prisma.user.create({
    data: {
      name: d.name,
      email: d.email,
      passwordHash,
      role: d.role,
      profileId: d.profileId ?? null,
      hierarchyRoleId: d.hierarchyRoleId ?? null,
      managerId: d.managerId ?? null,
      isActive: d.isActive,
      isCloser: d.isCloser,
      five9Username: d.five9Username || null,
      mailboxAddress: d.mailboxAddress ? d.mailboxAddress.toLowerCase() : null,
    },
    select: {
      id: true, name: true, email: true, role: true, isActive: true,
      profile: { select: { id: true, name: true, label: true } },
    },
  });
  return NextResponse.json(user, { status: 201 });
}
