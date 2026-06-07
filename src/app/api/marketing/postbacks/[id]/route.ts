import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditWrite } from "@/lib/audit";
import { POSTBACK_EVENTS } from "@/lib/marketing/postback";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const endpoint = await prisma.marketingPostbackEndpoint.findUnique({ where: { id } });
  if (!endpoint) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(endpoint);
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

  const prev = await prisma.marketingPostbackEndpoint.findUnique({ where: { id } });
  if (!prev) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.url === "string" && body.url.trim()) {
    try {
      new URL(body.url);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
    data.url = body.url.trim();
  }
  if (typeof body.method === "string") {
    const m = body.method.toUpperCase();
    if (!["GET", "POST", "PUT"].includes(m)) {
      return NextResponse.json({ error: "Invalid method" }, { status: 400 });
    }
    data.method = m;
  }
  if ("authHeaderKey" in body) data.authHeaderKey = (body.authHeaderKey as string) || null;
  if ("authHeaderValue" in body) data.authHeaderValue = (body.authHeaderValue as string) || null;
  if ("payloadTemplate" in body) data.payloadTemplate = (body.payloadTemplate as string) || null;
  if (Array.isArray(body.events)) {
    data.events = (body.events as string[]).filter((e) =>
      (POSTBACK_EVENTS as readonly string[]).includes(e),
    );
  }
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.retryOnFail === "boolean") data.retryOnFail = body.retryOnFail;
  if (typeof body.maxAttempts === "number")
    data.maxAttempts = Math.max(1, Math.min(10, body.maxAttempts));

  const endpoint = await prisma.marketingPostbackEndpoint.update({ where: { id }, data });

  await auditWrite({
    userId: session.user?.id ?? null,
    entity: "MarketingPostbackEndpoint",
    entityId: id,
    action: "UPDATE",
    before: prev as unknown as Record<string, unknown>,
    after: endpoint as unknown as Record<string, unknown>,
  }).catch(() => null);

  return NextResponse.json(endpoint);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.marketingPostbackEndpoint.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.marketingPostbackEndpoint.delete({ where: { id } });

  await auditWrite({
    userId: session.user?.id ?? null,
    entity: "MarketingPostbackEndpoint",
    entityId: id,
    action: "DELETE",
    before: { name: existing.name, url: existing.url },
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
