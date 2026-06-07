import { NextRequest, NextResponse } from "next/server";
import { processInboundPayload } from "@/lib/marketing/inbound";

/**
 * Public inbound webhook endpoint for marketing sources.
 * URL: POST /api/marketing/inbound/<slug>
 * Auth: X-API-Key header must match the source's apiKey.
 * Body: application/json or application/x-www-form-urlencoded.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const apiKey = request.headers.get("x-api-key");
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null;
  const userAgent = request.headers.get("user-agent") ?? null;

  // Parse body — accept JSON or form-urlencoded
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  let raw: Record<string, unknown> = {};
  try {
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      for (const [k, v] of params.entries()) raw[k] = v;
    } else if (contentType.includes("multipart/form-data")) {
      const fd = await request.formData();
      for (const [k, v] of fd.entries()) raw[k] = typeof v === "string" ? v : v.name;
    } else {
      const text = await request.text();
      if (text.trim().length === 0) {
        raw = {};
      } else {
        raw = JSON.parse(text);
      }
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid request body. Expected JSON or x-www-form-urlencoded." },
      { status: 400 },
    );
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return NextResponse.json(
      { error: "Request body must be a JSON object." },
      { status: 400 },
    );
  }

  const result = await processInboundPayload({
    slug,
    apiKey,
    rawPayload: raw,
    ip,
    userAgent,
  });

  return NextResponse.json(result.body, { status: result.httpStatus });
}
