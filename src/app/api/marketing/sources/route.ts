import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditWrite } from "@/lib/audit";

function makeSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sources = await prisma.marketingSource.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      defaultOwner: { select: { id: true, name: true } },
      defaultQueue: { select: { id: true, name: true } },
      _count: { select: { inboundLogs: true } },
    },
  });
  return NextResponse.json({ sources });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  let slug = String(body.slug ?? "").trim();
  if (!slug) slug = makeSlug(name);
  slug = makeSlug(slug);
  if (!slug) return NextResponse.json({ error: "Invalid slug" }, { status: 400 });

  const existing = await prisma.marketingSource.findUnique({ where: { slug } });
  if (existing) return NextResponse.json({ error: "Slug already in use" }, { status: 409 });

  const apiKey = crypto.randomBytes(24).toString("hex");

  const source = await prisma.marketingSource.create({
    data: {
      name,
      slug,
      apiKey,
      isActive: body.isActive !== false,
      fieldMapping: (body.fieldMapping as object) ?? {},
      defaultOwnerId: (body.defaultOwnerId as string) || null,
      defaultQueueId: (body.defaultQueueId as string) || null,
      leadSource: (body.leadSource as string) || null,
      requiredFields: Array.isArray(body.requiredFields)
        ? (body.requiredFields as string[])
        : [],
      dedupeBy: (body.dedupeBy as string) || null,
    },
  });

  await auditWrite({
    userId: session.user?.id ?? null,
    entity: "MarketingSource",
    entityId: source.id,
    action: "CREATE",
    after: { name: source.name, slug: source.slug },
  }).catch(() => null);

  return NextResponse.json(source, { status: 201 });
}
