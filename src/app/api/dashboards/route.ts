import { analyticsApiAccess, definitionScope } from "@/lib/analytics-access";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const gate = await analyticsApiAccess("Dashboards.View");
  if ("response" in gate) return gate.response;
  const access = gate.access;
  const items = await prisma.dashboard.findMany({
    where: {
      AND: [definitionScope(access)],
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
  const gate = await analyticsApiAccess("Dashboards.Create");
  if ("response" in gate) return gate.response;
  const access = gate.access;
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
      createdById: access.userId,
    },
  });
  return NextResponse.json(dash, { status: 201 });
}
