import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

const VALID_KINDS = new Set(["kpi", "count", "sum", "bar", "table", "report"]);

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const existing = await prisma.dashboard.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const kind = typeof body.kind === "string" ? body.kind : "kpi";
  if (!VALID_KINDS.has(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "New Tile";

  const tile = await prisma.dashboardTile.create({
    data: {
      dashboardId: id,
      kind,
      title,
      queryKey: typeof body.queryKey === "string" ? body.queryKey : null,
      reportId: typeof body.reportId === "string" ? body.reportId : null,
      config: body.config && typeof body.config === "object" ? body.config : {},
      position:
        body.position && typeof body.position === "object"
          ? body.position
          : { x: 0, y: 0, w: kind === "bar" ? 12 : 3, h: kind === "bar" ? 3 : 2 },
    },
  });
  return NextResponse.json(tile, { status: 201 });
}
