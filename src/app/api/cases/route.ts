import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { createCaseSchema } from "@/lib/validations/case";
import { nextCaseNumber } from "@/lib/cases";

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond("Case.View");
  if ("response" in r) return r.response;
  const url = new URL(req.url);
  const where: Record<string, unknown> = {};
  for (const key of ["accountId", "contactId", "programPlanId", "ownerId", "ownerGroupId", "status", "recordType", "priority", "escalationLevel"] as const) {
    const v = url.searchParams.get(key);
    if (v) where[key] = v;
  }
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 200);

  const items = await prisma.case.findMany({
    where,
    take: limit,
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    include: {
      account: { select: { id: true, name: true } },
      contact: { select: { id: true, fullName: true } },
      owner: { select: { id: true, name: true } },
      ownerGroup: { select: { id: true, name: true, developerName: true } },
      _count: { select: { comments: true } },
    },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Case.Create");
  if ("response" in r) return r.response;
  const body = await req.json().catch(() => ({}));
  const parsed = createCaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const caseNumber = await nextCaseNumber();
  const newCase = await prisma.case.create({
    data: {
      ...d,
      caseNumber,
      slaDueAt: d.slaDueAt ? new Date(d.slaDueAt) : null,
      createdById: r.session.userId,
    },
  });
  return NextResponse.json(newCase, { status: 201 });
}
