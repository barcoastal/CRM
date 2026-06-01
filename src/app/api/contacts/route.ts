import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { createContactSchema } from "@/lib/validations/contact";

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond("Contact.View");
  if ("response" in r) return r.response;

  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId");
  const q = url.searchParams.get("q");
  const take = Math.min(Number(url.searchParams.get("limit") ?? "50"), 200);

  const where: Record<string, unknown> = { isActive: true };
  if (accountId) {
    where.OR = [
      { primaryAccountId: accountId },
      { accountRelations: { some: { accountId } } },
    ];
  }
  if (q) {
    where.OR = [
      ...((where.OR as object[]) ?? []),
      { fullName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }

  const items = await prisma.contact.findMany({
    where,
    take,
    orderBy: { updatedAt: "desc" },
    include: {
      primaryAccount: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Contact.Create");
  if ("response" in r) return r.response;

  const body = await req.json().catch(() => ({}));
  const parsed = createContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const fullName = [d.firstName, d.lastName].filter(Boolean).join(" ").trim();

  const contact = await prisma.contact.create({
    data: {
      firstName: d.firstName,
      lastName: d.lastName ?? "",
      fullName,
      email: d.email ?? null,
      phone: d.phone ?? null,
      mobilePhone: d.mobilePhone ?? null,
      title: d.title ?? null,
      birthdate: d.birthdate ? new Date(d.birthdate) : null,
      primaryAccountId: d.primaryAccountId ?? null,
      ownerId: d.ownerId ?? null,
    },
  });

  // Auto-create AccountContactRelation if primaryAccountId was provided
  if (d.primaryAccountId) {
    await prisma.accountContactRelation.upsert({
      where: { accountId_contactId: { accountId: d.primaryAccountId, contactId: contact.id } },
      create: { accountId: d.primaryAccountId, contactId: contact.id, role: "Primary Contact" },
      update: {},
    });
  }

  return NextResponse.json(contact, { status: 201 });
}
