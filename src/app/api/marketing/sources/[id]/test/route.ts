import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processInboundPayload } from "@/lib/marketing/inbound";

/**
 * Internal "send test payload" endpoint for the Edit Source page. Accepts a
 * JSON body and runs it through the inbound pipeline without requiring the
 * caller to know the API key (the route handler is already auth-gated).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const source = await prisma.marketingSource.findUnique({ where: { id } });
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await processInboundPayload({
    slug: source.slug,
    apiKey: source.apiKey,
    rawPayload: body,
    ip: request.headers.get("x-forwarded-for") ?? null,
    userAgent: request.headers.get("user-agent") ?? null,
    skipApiKeyCheck: true,
  });

  return NextResponse.json(
    { status: result.status, response: result.body, httpStatus: result.httpStatus, logId: result.logId },
    { status: 200 },
  );
}
