import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { sendQueuedSms } from "@/lib/sms-sender";

/** POST /api/sms/[id]/send — fire one SMS immediately. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Sms.Send");
  if ("response" in r) return r.response;
  const { id } = await params;
  const result = await sendQueuedSms(id);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, errorCode: result.errorCode },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, providerMessageId: result.providerMessageId });
}
