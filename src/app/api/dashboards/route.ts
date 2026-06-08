import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function GET() {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const items = await prisma.dashboard.findMany({
    where: {
      OR: [{ isShared: true }, { createdById: r.session.userId }],
    },
    orderBy: { updatedAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { tiles: true } },
    },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const description = typeof body.description === "string" ? body.description : null;
  const isShared = typeof body.isShared === "boolean" ? body.isShared : true;
  const dash = await prisma.dashboard.create({
    data: {
      name,
      description,
      isShared,
      createdById: r.session.userId,
    },
  });
  return NextResponse.json(dash, { status: 201 });
}
