import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditWrite } from "@/lib/audit";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.marketingSource.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const apiKey = crypto.randomBytes(24).toString("hex");
  const updated = await prisma.marketingSource.update({
    where: { id },
    data: { apiKey },
  });

  await auditWrite({
    userId: session.user?.id ?? null,
    entity: "MarketingSource",
    entityId: id,
    action: "UPDATE",
    before: { apiKey: "[rotated]" },
    after: { apiKey: "[rotated]" },
  }).catch(() => null);

  return NextResponse.json({ apiKey: updated.apiKey });
}
