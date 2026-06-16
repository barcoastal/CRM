/**
 * Run this sequence right now — enroll any new matches, then advance ACTIVE
 * enrollments whose nextActionAt is due.
 *
 *   POST /api/engagement/sequences/:id/run-now
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { evaluateAndEnroll, processEnrollments } from "@/lib/engagement/engine";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await params;

  const enrollRes = await evaluateAndEnroll({ sequenceId: id });
  const processRes = await processEnrollments({ sequenceId: id, limit: 200 });

  return NextResponse.json({
    ok: true,
    enroll: enrollRes,
    process: processRes,
  });
}
