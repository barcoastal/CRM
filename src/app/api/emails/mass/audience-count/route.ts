/**
 * POST /api/emails/mass/audience-count — given an audience config
 * (entityType + filters or list of IDs), returns the number of recipients
 * that would receive the blast. Used by the UI's live counter on the
 * audience-builder step.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { countAudience } from "@/lib/email/mass-sender";

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;

  const body = (await req.json().catch(() => ({}))) as {
    audienceType?: "filter" | "list";
    audienceFilter?: Record<string, unknown>;
    audienceIds?: string[];
  };
  const audienceType = body.audienceType === "list" ? "list" : "filter";
  const audienceFilter = (body.audienceFilter ?? {}) as never;
  const audienceIds = Array.isArray(body.audienceIds) ? body.audienceIds : [];
  const count = await countAudience(audienceType, audienceFilter, audienceIds);
  return NextResponse.json({ count });
}
