import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

// GET /api/files/record?entityType=&entityId=&take=
// Lists ContentRecordLinks for a record with their parent document.
export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType");
  const entityId = url.searchParams.get("entityId");
  const take = Math.min(parseInt(url.searchParams.get("take") ?? "50", 10) || 50, 200);
  if (!entityType || !entityId) {
    return NextResponse.json({ error: "entityType + entityId required" }, { status: 400 });
  }
  const links = await prisma.contentRecordLink.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      document: {
        include: {
          latestVersion: true,
          owner: { select: { id: true, name: true } },
        },
      },
    },
  });
  return NextResponse.json(links);
}
