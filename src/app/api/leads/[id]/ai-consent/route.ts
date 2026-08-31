import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

const schema = z.object({
  consented: z.boolean(),
  consentText: z.string().min(1).max(4000),
  consentSource: z.string().min(2).max(255),
  consentAt: z.string().datetime().optional(),
}).superRefine((value, ctx) => {
  if (value.consented && value.consentText.length < 20) {
    ctx.addIssue({ code: "custom", path: ["consentText"], message: "Store the complete consent disclosure" });
  }
  if (value.consented && !value.consentAt) {
    ctx.addIssue({ code: "custom", path: ["consentAt"], message: "The original consent timestamp is required" });
  }
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthOrRespond("Lead.Edit");
  if ("response" in auth) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid consent evidence", details: parsed.error.flatten() }, { status: 400 });
  const { id } = await params;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const lead = await prisma.lead.update({
    where: { id },
    data: parsed.data.consented ? {
      aiCallConsent: true,
      aiCallConsentAt: new Date(parsed.data.consentAt!),
      aiCallConsentSource: parsed.data.consentSource,
      aiCallConsentText: parsed.data.consentText,
      aiCallConsentIp: forwarded ?? request.headers.get("x-real-ip"),
    } : {
      aiCallConsent: false,
      aiCallConsentAt: null,
      aiCallConsentSource: parsed.data.consentSource,
      aiCallConsentText: parsed.data.consentText,
      aiCallConsentIp: forwarded ?? request.headers.get("x-real-ip"),
    },
    select: { id: true, aiCallConsent: true, aiCallConsentAt: true, aiCallConsentSource: true },
  });
  return NextResponse.json({ lead });
}
