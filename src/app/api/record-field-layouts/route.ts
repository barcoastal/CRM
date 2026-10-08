import { NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { auditWrite } from "@/lib/audit";
import { isLayoutEntity, layoutId, layoutStages, validateFieldLayout } from "@/lib/record-field-layout";

export async function PUT(request: Request) {
  const auth = await requireAuthOrRespond();
  if ("response" in auth) return auth.response;
  const user = await prisma.user.findUnique({ where: { id: auth.session.userId }, select: { role: true, isActive: true } });
  if (!user?.isActive || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  const body = await request.json().catch(() => null) as { entity?: unknown; stage?: unknown; layout?: unknown; version?: unknown } | null;
  if (!body || typeof body.entity !== "string" || !isLayoutEntity(body.entity) || typeof body.stage !== "string" || (body.stage !== "*" && !layoutStages[body.entity].includes(body.stage))) return NextResponse.json({ error: "Choose a valid record type and stage" }, { status: 400 });
  const { entity, stage } = body;
  const id = layoutId(entity, stage);
  let layout;
  try { layout = validateFieldLayout(body.entity, body.layout); }
  catch { return NextResponse.json({ error: "Invalid field layout" }, { status: 400 }); }
  const existing = await prisma.pageLayout.findUnique({ where: { id } });
  if ((existing?.updatedAt.toISOString() ?? null) !== body.version) return NextResponse.json({ error: "This layout changed since you opened it. Reload before saving." }, { status: 409 });
  try {
    const updated = await prisma.$transaction(async tx => {
      if (existing) {
        const result = await tx.pageLayout.updateMany({ where: { id, updatedAt: existing.updatedAt }, data: { layout, updatedAt: new Date() } });
        if (result.count !== 1) throw new Error("CONFLICT");
      } else {
        await tx.pageLayout.create({ data: { id, name: `${entity} fields — ${stage}`, entityType: entity, recordType: stage, createdById: auth.session.userId, layout } });
      }
      return tx.pageLayout.findUniqueOrThrow({ where: { id } });
    });
    await auditWrite({ userId: auth.session.userId, entity: "PageLayout", entityId: id, action: existing ? "UPDATE" : "CREATE", before: existing ? { layout: existing.layout } : undefined, after: { layout: updated.layout } });
    return NextResponse.json({ version: updated.updatedAt.toISOString() });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002" || (error as Error).message === "CONFLICT") return NextResponse.json({ error: "Another admin saved this layout. Reload before saving." }, { status: 409 });
    throw error;
  }
}
