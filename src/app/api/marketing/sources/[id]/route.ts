import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditWrite } from "@/lib/audit";

function makeSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const source = await prisma.marketingSource.findUnique({
    where: { id },
    include: {
      defaultOwner: { select: { id: true, name: true } },
      defaultQueue: { select: { id: true, name: true } },
    },
  });
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(source);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const prev = await prisma.marketingSource.findUnique({ where: { id } });
  if (!prev) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.slug === "string" && body.slug.trim()) {
    const slug = makeSlug(body.slug);
    if (slug !== prev.slug) {
      const conflict = await prisma.marketingSource.findUnique({ where: { slug } });
      if (conflict) return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
      data.slug = slug;
    }
  }
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (body.fieldMapping !== undefined) data.fieldMapping = body.fieldMapping;
  if ("defaultOwnerId" in body) data.defaultOwnerId = (body.defaultOwnerId as string) || null;
  if ("defaultQueueId" in body) data.defaultQueueId = (body.defaultQueueId as string) || null;
  if ("leadSource" in body) data.leadSource = (body.leadSource as string) || null;
  if (Array.isArray(body.requiredFields)) data.requiredFields = body.requiredFields;
  if ("dedupeBy" in body) data.dedupeBy = (body.dedupeBy as string) || null;

  const source = await prisma.marketingSource.update({ where: { id }, data });

  await auditWrite({
    userId: session.user?.id ?? null,
    entity: "MarketingSource",
    entityId: id,
    action: "UPDATE",
    before: prev as unknown as Record<string, unknown>,
    after: source as unknown as Record<string, unknown>,
  }).catch(() => null);

  return NextResponse.json(source);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.marketingSource.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.marketingSource.delete({ where: { id } });

  await auditWrite({
    userId: session.user?.id ?? null,
    entity: "MarketingSource",
    entityId: id,
    action: "DELETE",
    before: { name: existing.name, slug: existing.slug },
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
