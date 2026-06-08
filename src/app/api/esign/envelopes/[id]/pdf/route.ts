/**
 * Stream a prepared (filled but unsigned) envelope PDF. Auth required for
 * now; the public signer page (/sign/[token]) will get its own token-scoped
 * variant in chunk 3 so signers do not need a CRM session.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { readEnvelopePdf, readTemplatePdf } from "@/lib/esign/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireAuthOrRespond("Opportunity.Read");
  if ("response" in r) return r.response;
  const { id } = await params;

  const envelope = await prisma.envelope.findUnique({
    where: { id },
    select: { id: true, preparedPdfPath: true, templateId: true, documentName: true },
  });
  if (!envelope) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Prefer the prepared (merged) blob. If we somehow lost it, fall back to the
  // raw template PDF so the UI never goes dark on a slightly broken envelope.
  let buf: Buffer | null = null;
  try {
    if (envelope.preparedPdfPath) {
      buf = await readEnvelopePdf(envelope.preparedPdfPath);
    } else if (envelope.templateId) {
      const tpl = await prisma.envelopeTemplate.findUnique({
        where: { id: envelope.templateId },
        select: { pdfPath: true },
      });
      if (tpl) buf = await readTemplatePdf(tpl.pdfPath);
    }
  } catch {
    return NextResponse.json({ error: "PDF read failed" }, { status: 500 });
  }
  if (!buf) return NextResponse.json({ error: "No PDF on envelope" }, { status: 404 });

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${envelope.documentName.replace(/"/g, "")}.pdf"`,
      "Cache-Control": "private, max-age=0, no-cache",
    },
  });
}
