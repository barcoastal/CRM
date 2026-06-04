import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { sendQueuedEmail } from "@/lib/email-sender";

/** POST /api/emails/[id]/send — fire one email immediately, bypassing the queue. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const { id } = await params;
  const result = await sendQueuedEmail(id);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, providerMessageId: result.providerMessageId });
}
