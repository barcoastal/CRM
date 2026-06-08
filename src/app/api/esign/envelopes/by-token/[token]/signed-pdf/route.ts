/**
 * Public signed PDF endpoint. After completion the signer (or anyone with the
 * signing token) can fetch the final stamped PDF.
 *
 *   GET /api/esign/envelopes/by-token/:token/signed-pdf
 *
 * `Envelope.signedDocumentUrl` stores just the filename (e.g.
 * "<envelopeId>-signed.pdf"). The actual blob lives under signedDir().
 */
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { signedDir } from "@/lib/esign/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const envelope = await prisma.envelope.findUnique({
    where: { signingToken: token },
    select: { id: true, status: true, signedDocumentUrl: true, documentName: true },
  });
  if (!envelope) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!envelope.signedDocumentUrl) {
    return NextResponse.json({ error: "Not signed yet" }, { status: 404 });
  }

  let buf: Buffer;
  try {
    buf = await fs.readFile(path.join(signedDir(), envelope.signedDocumentUrl));
  } catch {
    return NextResponse.json({ error: "Signed PDF read failed" }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${envelope.documentName.replace(/"/g, "")} (signed).pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
