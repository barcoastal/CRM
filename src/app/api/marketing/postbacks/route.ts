import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditWrite } from "@/lib/audit";
import { POSTBACK_EVENTS } from "@/lib/marketing/postback";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const endpoints = await prisma.marketingPostbackEndpoint.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { logs: true } } },
  });
  return NextResponse.json({ endpoints });
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
  const url = String(body.url ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 });
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const events: string[] = Array.isArray(body.events)
    ? (body.events as string[]).filter((e) =>
        (POSTBACK_EVENTS as readonly string[]).includes(e),
      )
    : [];

  const method = String(body.method ?? "POST").toUpperCase();
  if (!["GET", "POST", "PUT"].includes(method)) {
    return NextResponse.json({ error: "Invalid method" }, { status: 400 });
  }

  const endpoint = await prisma.marketingPostbackEndpoint.create({
    data: {
      name,
      url,
      method,
      authHeaderKey: (body.authHeaderKey as string) || null,
      authHeaderValue: (body.authHeaderValue as string) || null,
      payloadTemplate: (body.payloadTemplate as string) || null,
      events,
      isActive: body.isActive !== false,
      retryOnFail: body.retryOnFail !== false,
      maxAttempts: Math.max(1, Math.min(10, Number(body.maxAttempts) || 3)),
    },
  });

  await auditWrite({
    userId: session.user?.id ?? null,
    entity: "MarketingPostbackEndpoint",
    entityId: endpoint.id,
    action: "CREATE",
    after: { name: endpoint.name, url: endpoint.url, events },
  }).catch(() => null);

  return NextResponse.json(endpoint, { status: 201 });
}
