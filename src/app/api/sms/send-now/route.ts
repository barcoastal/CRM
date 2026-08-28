import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { sendSmsNow } from "@/lib/sms-sender";

/**
 * Agent-facing "send this text now" endpoint for the two-way SMS console /
 * record compose box. Creates the OUTBOUND SmsMessage and sends it via SMS
 * Magic in one call, returning the row so the thread can render it immediately.
 */
const Body = z.object({
  to: z.string().min(3),
  body: z.string().min(1).max(1600),
  leadId: z.string().cuid().nullable().optional(),
  accountId: z.string().cuid().nullable().optional(),
  contactId: z.string().cuid().nullable().optional(),
  opportunityId: z.string().cuid().nullable().optional(),
  from: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("SMS.Send");
  if ("response" in r) return r.response;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Enter a number and a message." }, { status: 400 });

  const result = await sendSmsNow({
    to: parsed.data.to,
    body: parsed.data.body,
    from: parsed.data.from ?? null,
    leadId: parsed.data.leadId ?? null,
    accountId: parsed.data.accountId ?? null,
    contactId: parsed.data.contactId ?? null,
    opportunityId: parsed.data.opportunityId ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, id: result.smsId, error: result.error ?? "Send failed." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, id: result.smsId });
}
