/**
 * Bulk-add phones to the DNC suppression list from a CSV upload.
 *
 *   POST /api/dnc/bulk-add
 *     body: { csv: "5551234567\n5559876543\n...", reason?, source? }
 *     → { added, skipped, invalid }
 *
 * Port of SF SuppressionListTrigger (platform event → batch job).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { bulkAddSuppression } from "@/lib/dnc";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    csv?: string;
    reason?: string;
    source?: string;
  };
  if (!body.csv) return NextResponse.json({ error: "csv required" }, { status: 400 });

  const result = await bulkAddSuppression({
    csv: body.csv,
    reason: body.reason,
    source: body.source,
    addedById: session.user.id,
  });

  return NextResponse.json({ ok: true, ...result });
}
