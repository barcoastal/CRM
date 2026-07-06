/**
 * Contract merge preview. POST a .docx template + an opportunityId; get back the
 * filled PDF. Lets us test the {{token}}/{{#table}} merge against a real deal
 * before the full packet/routing/send flow is wired.
 */
import { NextRequest, NextResponse } from "next/server";
import { buildContractData } from "@/lib/contracts/merge-data";
import { fillPacketToPdf } from "@/lib/contracts/docx-merge";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const files = form.getAll("file").filter((f): f is File => f instanceof File);
    const opportunityId = String(form.get("opportunityId") ?? "");
    if (files.length === 0) return NextResponse.json({ error: "No .docx file uploaded" }, { status: 400 });
    if (!opportunityId) return NextResponse.json({ error: "opportunityId required" }, { status: 400 });

    const templates = await Promise.all(
      files.map(async (f) => ({ buffer: Buffer.from(await f.arrayBuffer()), name: f.name || "contract.docx" })),
    );
    const data = await buildContractData(opportunityId);
    const pdf = await fillPacketToPdf(templates, data);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="contract-preview.pdf"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
