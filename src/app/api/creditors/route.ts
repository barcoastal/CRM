import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { createCreditorSchema } from "@/lib/validations/creditor";

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond("Account.View");
  if ("response" in r) return r.response;

  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const take = Math.min(Number(url.searchParams.get("limit") ?? "100"), 200);

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { legalName: { contains: q, mode: "insensitive" } },
      { account: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const items = await prisma.creditor.findMany({
    where,
    take,
    orderBy: { legalName: "asc" },
    include: {
      account: { select: { id: true, name: true, phone: true, email: true } },
      _count: { select: { debts: true } },
    },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Account.Create");
  if ("response" in r) return r.response;

  const body = await req.json().catch(() => ({}));
  const parsed = createCreditorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    let accountId = d.accountId;
    if (!accountId) {
      const account = await tx.account.create({
        data: { recordType: "CREDITOR", name: d.accountName!, type: "ORG" },
      });
      accountId = account.id;
    }
    return tx.creditor.create({
      data: {
        accountId,
        legalName: d.legalName,
        collectionsPhone: d.collectionsPhone ?? null,
        collectionsEmail: d.collectionsEmail ?? null,
        settlementPolicy: d.settlementPolicy ?? null,
        notes: d.notes ?? null,
      },
      include: { account: true },
    });
  });
  return NextResponse.json(result, { status: 201 });
}
