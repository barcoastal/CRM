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
import { verifiedPreparedPdf, isSignable, readProof, proofCookie } from "@/lib/esign/evidence";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const envelope = await prisma.envelope.findUnique({
    where: { signingToken: token },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      signerEmail: true,
      preparedPdfPath: true,
      templateId: true,
      documentName: true,
    },
  });
  if (!envelope) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!isSignable(envelope)) return NextResponse.json({error:"Not available"},{status:410});
  const proof = readProof(request.cookies.get(proofCookie(envelope.id))?.value,envelope);
  if (!proof) return NextResponse.json({error:"Verify your email first."},{status:401});
  let buf: Buffer;
  try {
    if (!envelope.preparedPdfPath) throw new Error("No snapshot");
    const prepared = await verifiedPreparedPdf(envelope.preparedPdfPath);
    if (prepared.hash !== proof.documentHash) throw new Error("Document changed");
    buf = prepared.bytes;
  } catch { return NextResponse.json({error:"Document integrity check failed. Contact the sender."},{status:409}); }
  await prisma.$transaction(async tx=>{
    const changed = await tx.envelope.updateMany({where:{id:envelope.id,status:"SENT"},data:{status:"VIEWED",viewedAt:new Date()}});
    if (changed.count) await tx.envelopeEvent.create({data:{envelopeId:envelope.id,eventType:"VIEWED",details:JSON.stringify({documentHash:proof.documentHash,verificationEventId:proof.eventId}),ipAddress:(request.headers.get("x-forwarded-for")??"").split(",")[0].trim(),userAgent:request.headers.get("user-agent")}});
  });

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${envelope.documentName.replace(/"/g, "")}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
