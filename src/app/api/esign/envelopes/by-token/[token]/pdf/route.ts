/**
 * Public PDF endpoint for the signer page. No auth: anyone with the signing
 * token can fetch the prepared (merged-but-not-signed) PDF for the envelope.
 *
 *   GET /api/esign/envelopes/by-token/:token/pdf
 *
 * Returns 404 when the envelope is missing, declined, voided, or already
 * completed. After completion the signer should pull the SIGNED PDF instead
 * (see ../signed-pdf/route.ts).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readEnvelopePdf, readTemplatePdf } from "@/lib/esign/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const envelope = await prisma.envelope.findUnique({
    where: { signingToken: token },
    select: {
      id: true,
      status: true,
      preparedPdfPath: true,
      templateId: true,
      documentName: true,
    },
  });
  if (!envelope) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (envelope.status === "DECLINED" || envelope.status === "VOIDED" || envelope.status === "COMPLETED") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

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
      "Cache-Control": "no-store",
    },
  });
}
