import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("User.View");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, role: true, avatar: true,
      isActive: true, lastLoginAt: true, createdAt: true, updatedAt: true, mailboxAddress: true,
      profile: { select: { id: true, name: true, label: true } },
      hierarchyRole: { select: { id: true, name: true } },
      manager: { select: { id: true, name: true } },
      permissionSets: { include: { permissionSet: { select: { id: true, name: true, label: true } } } },
      groupMembers: { include: { group: { select: { id: true, name: true, type: true } } } },
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.string().optional(),
  profileId: z.string().cuid().optional().nullable(),
  hierarchyRoleId: z.string().cuid().optional().nullable(),
  managerId: z.string().cuid().optional().nullable(),
  isActive: z.boolean().optional(),
  isCloser: z.boolean().optional(),
  five9Username: z.string().max(255).optional().nullable(),
  mailboxAddress: z.string().email().max(255).optional().nullable(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("User.Edit");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (d.email && d.email !== before.email) {
    const dupe = await prisma.user.findUnique({ where: { email: d.email } });
    if (dupe) return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  if (d.mailboxAddress && d.mailboxAddress.toLowerCase() !== (before.mailboxAddress ?? "")) {
    const dupe = await prisma.user.findFirst({
      where: { mailboxAddress: { equals: d.mailboxAddress, mode: "insensitive" } },
    });
    if (dupe && dupe.id !== id) {
      return NextResponse.json({ error: "Mailbox address already in use" }, { status: 409 });
    }
  }

  const data: Record<string, unknown> = {};
  if (d.name !== undefined) data.name = d.name;
  if (d.email !== undefined) data.email = d.email;
  if (d.password) data.passwordHash = await hash(d.password, 12);
  if (d.role !== undefined) data.role = d.role;
  if (d.profileId !== undefined) data.profileId = d.profileId;
  if (d.hierarchyRoleId !== undefined) data.hierarchyRoleId = d.hierarchyRoleId;
  if (d.managerId !== undefined) data.managerId = d.managerId;
  if (d.isActive !== undefined) data.isActive = d.isActive;
  if (d.isCloser !== undefined) data.isCloser = d.isCloser;
  if (d.five9Username !== undefined) data.five9Username = d.five9Username || null;
  if (d.mailboxAddress !== undefined) data.mailboxAddress = d.mailboxAddress ? d.mailboxAddress.toLowerCase() : null;

  const user = await prisma.user.update({
    where: { id }, data,
    select: { id: true, name: true, email: true, role: true, isActive: true,
      profile: { select: { name: true, label: true } } },
  });
  await auditWrite({
    userId: r.session.userId, entity: "User", entityId: id, action: "UPDATE",
    before: { ...before, passwordHash: "[redacted]" } as unknown as Record<string, unknown>,
    after: user as unknown as Record<string, unknown>,
  }).catch(() => null);
  return NextResponse.json(user);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("User.Deactivate");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  // Soft delete — set isActive=false
  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.user.update({ where: { id }, data: { isActive: false } });
  await auditWrite({
    userId: r.session.userId, entity: "User", entityId: id, action: "UPDATE",
    before: { isActive: true }, after: { isActive: false },
  }).catch(() => null);
  return NextResponse.json({ ok: true });
}
