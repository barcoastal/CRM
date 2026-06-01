import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { convertLead } from "@/lib/lead-conversion";
import { OPPORTUNITY_RECORD_TYPES, ACCOUNT_RECORD_TYPES } from "@/lib/record-types";

const Body = z.object({
  accountRecordType: z.enum(ACCOUNT_RECORD_TYPES).optional(),
  opportunityRecordType: z.enum(OPPORTUNITY_RECORD_TYPES).optional(),
  opportunityName: z.string().min(1).optional(),
  accountOwnerId: z.string().cuid().optional(),
  contactRole: z.string().optional(),
  doNotCreateOpportunity: z.boolean().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Lead.Convert");
  if ("response" in r) return r.response;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await convertLead(id, {
      ...parsed.data,
      performedById: r.session.userId,
    });
    return NextResponse.json(result, { status: result.alreadyConverted ? 200 : 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "conversion failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
