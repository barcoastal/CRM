/**
 * Generate a deal's routed contract packet. POST { opportunityId } →  auto-routes
 * (Coastal + processor + legal), fills each stored template with the deal's data,
 * merges into one PDF, and returns it. The chosen packet is reported in the
 * X-Packet-Plan header so the UI can show what was assembled.
 */
import { NextRequest, NextResponse } from "next/server";
import { buildContractData } from "@/lib/contracts/merge-data";
import { fillPacketToPdf } from "@/lib/contracts/docx-merge";
import { planPacket, loadPacketTemplates } from "@/lib/contracts/routing";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { opportunityId?: string };
    const opportunityId = body.opportunityId?.trim();
    if (!opportunityId) return NextResponse.json({ error: "opportunityId required" }, { status: 400 });

    const plan = await planPacket(opportunityId);
    const { templates } = await loadPacketTemplates(plan);
    const data = await buildContractData(opportunityId);
    const pdf = await fillPacketToPdf(templates, data);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="contract-packet.pdf"`,
        "X-Packet-Plan": JSON.stringify({ processor: plan.processor, legal: plan.legal, categories: plan.categories }),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
