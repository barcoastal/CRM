/**
 * Contract merge preview. POST a .docx template + an opportunityId; get back the
 * filled PDF. Lets us test the {{token}}/{{#table}} merge against a real deal
 * before the full packet/routing/send flow is wired.
 */
import { NextRequest, NextResponse } from "next/server";
import { buildContractData } from "@/lib/contracts/merge-data";
import { fillDocxToPdf } from "@/lib/contracts/docx-merge";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const opportunityId = String(form.get("opportunityId") ?? "");
    if (!(file instanceof File)) return NextResponse.json({ error: "No .docx file uploaded" }, { status: 400 });
    if (!opportunityId) return NextResponse.json({ error: "opportunityId required" }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const data = await buildContractData(opportunityId);
    const pdf = await fillDocxToPdf(buf, data, file.name || "contract.docx");

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
