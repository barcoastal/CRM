import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { createAccountSchema } from "@/lib/validations/account";
import { ACCOUNT_RECORD_TYPES } from "@/lib/record-types";

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond("Account.View");
  if ("response" in r) return r.response;

  const url = new URL(req.url);
  const recordType = url.searchParams.get("recordType");
  const q = url.searchParams.get("q");
  const take = Math.min(Number(url.searchParams.get("limit") ?? "50"), 200);

  const where: Record<string, unknown> = { isActive: true };
  if (recordType && (ACCOUNT_RECORD_TYPES as readonly string[]).includes(recordType)) {
    where.recordType = recordType;
  }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { ein: { contains: q } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.account.findMany({
      where,
      take,
      orderBy: { updatedAt: "desc" },
      include: {
        owner: { select: { id: true, name: true } },
        _count: { select: { contacts: true, opportunities: true } },
      },
    }),
    prisma.account.count({ where }),
  ]);

  return NextResponse.json({ items, total });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Account.Create");
  if ("response" in r) return r.response;

  const body = await req.json().catch(() => ({}));
  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const account = await prisma.account.create({ data: parsed.data });
  return NextResponse.json(account, { status: 201 });
}
