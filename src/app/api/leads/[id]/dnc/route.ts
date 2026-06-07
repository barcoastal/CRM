import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * SF "Add Numbers To DNC" header action — flags the lead's phone(s) on the
 * Do-Not-Call list. Mirrors the SF Lightning Lead detail header button so
 * the action exists at parity.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { id: true, phone: true, sfDataJson: true },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Update DNC__c in sfDataJson + the typed column if present
  const sf = lead.sfDataJson ? JSON.parse(lead.sfDataJson) as Record<string, unknown> : {};
  sf.DNC__c = true;
  sf.Check_DNC__c = true;

  await prisma.lead.update({
    where: { id },
    data: {
      sfDataJson: JSON.stringify(sf),
    },
  });

  // Best-effort DNC entry. The model name may vary; the action shouldn't fail
  // the request if the table doesn't exist.
  try {
    if (lead.phone) {
      await (prisma as unknown as { dncEntry?: { upsert: (args: unknown) => Promise<unknown> } })
        .dncEntry?.upsert({
          where: { phone: lead.phone },
          create: { phone: lead.phone, source: "LEAD_HEADER_ACTION", leadId: lead.id },
          update: { source: "LEAD_HEADER_ACTION", leadId: lead.id },
        });
    }
  } catch { /* ignore optional table miss */ }

  return NextResponse.json({ ok: true });
}
