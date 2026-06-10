import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  const { id } = await params;
  const existing = await prisma.objectFieldLabel.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.objectFieldLabel.delete({ where: { id } });
  await auditWrite({
    userId: r.session.userId,
    entity: "ObjectFieldLabel",
    entityId: id,
    action: "DELETE",
    before: existing as unknown as Record<string, unknown>,
  });

  return NextResponse.json({ ok: true });
}
