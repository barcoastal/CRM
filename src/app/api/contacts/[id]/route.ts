import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { updateContactSchema } from "@/lib/validations/contact";
import { auditWrite } from "@/lib/audit";
import { validateContactPatch } from "@/lib/validation/contact-validation";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Contact.View");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      primaryAccount: true,
      owner: { select: { id: true, name: true } },
      accountRelations: { include: { account: { select: { id: true, name: true, recordType: true } } } },
    },
  });
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(contact);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Contact.Edit");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const parsed = updateContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const before = await prisma.contact.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // SF validation rules — reject patches that violate ported Contact rules.
  const vErrors = validateContactPatch(
    {
      id: before.id,
      firstName: before.firstName,
      lastName: before.lastName,
      email: before.email,
      phone: before.phone,
      mobilePhone: before.mobilePhone,
      primaryAccountId: before.primaryAccountId,
    },
    {
      firstName: typeof d.firstName === "string" ? d.firstName : undefined,
      lastName: typeof d.lastName === "string" ? d.lastName : undefined,
      email: typeof d.email === "string" ? d.email : undefined,
      phone: typeof d.phone === "string" ? d.phone : undefined,
      mobilePhone: typeof d.mobilePhone === "string" ? d.mobilePhone : undefined,
      primaryAccountId: typeof d.primaryAccountId === "string" ? d.primaryAccountId : undefined,
    },
  );
  if (vErrors.length > 0) {
    return NextResponse.json({ error: vErrors[0], errors: vErrors }, { status: 400 });
  }

  const data: Record<string, unknown> = { ...d };
  if (d.firstName !== undefined || d.lastName !== undefined) {
    const fn = d.firstName ?? before.firstName;
    const ln = d.lastName ?? before.lastName;
    data.fullName = [fn, ln].filter(Boolean).join(" ").trim();
  }
  if (d.birthdate) data.birthdate = new Date(d.birthdate);

  const contact = await prisma.contact.update({ where: { id }, data });
  await auditWrite({
    userId: r.session.userId,
    entity: "Contact",
    entityId: id,
    action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: contact as unknown as Record<string, unknown>,
  }).catch(() => null);
  return NextResponse.json(contact);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Contact.Delete");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const before = await prisma.contact.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.contact.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
