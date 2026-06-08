import { NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { auditWrite } from "@/lib/audit";
import { isForecastCategory } from "@/lib/forecasting/categories";

export async function POST(req: Request) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  let body: { opportunityId?: string; category?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { opportunityId, category } = body;
  if (!opportunityId) {
    return NextResponse.json({ error: "opportunityId required" }, { status: 400 });
  }
  if (!category || !isForecastCategory(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const existing = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    select: { id: true, forecastCategory: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.opportunity.update({
    where: { id: opportunityId },
    data: { forecastCategory: category },
    select: { id: true, forecastCategory: true },
  });

  await auditWrite({
    userId: r.session.userId,
    entity: "Opportunity",
    entityId: opportunityId,
    action: "UPDATE",
    before: { forecastCategory: existing.forecastCategory },
    after: { forecastCategory: updated.forecastCategory },
  });

  return NextResponse.json({ ok: true, forecastCategory: updated.forecastCategory });
}
