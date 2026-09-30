import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { promises as fs } from "node:fs";
import path from "node:path";
import { signedDir } from "@/lib/esign/storage";
import { verifiedPreparedPdf, sha256 } from "@/lib/esign/evidence";
export async function GET(
  _r: NextRequest,
  c: { params: Promise<{ id: string }> },
) {
  const a = await requireAuthOrRespond("Opportunity.View");
  if ("response" in a) return a.response;
  const { id } = await c.params;
  const p = await prisma.signingPacket.findFirst({
    where: { id, createdById: a.session.userId },
  });
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    let bytes: Buffer;
    if (_r.nextUrl.searchParams.get("signed") === "true") {
      if (p.status !== "COMPLETED" || !p.completedPdfPath)
        return NextResponse.json(
          { error: "Packet not completed" },
          { status: 409 },
        );
      const last = await prisma.envelope.findFirst({
        where: { packetId: id, status: "COMPLETED" },
        orderBy: { routingOrder: "desc" },
      });
      const event =
        last &&
        (await prisma.envelopeEvent.findFirst({
          where: { envelopeId: last.id, eventType: "COMPLETED" },
          orderBy: { createdAt: "desc" },
        }));
      bytes = await fs.readFile(path.join(signedDir(), p.completedPdfPath));
      if (sha256(bytes) !== JSON.parse(event?.details ?? "{}").signedSha256)
        throw new Error("Integrity check failed");
    } else bytes = (await verifiedPreparedPdf(p.preparedPdfPath)).bytes;
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Document integrity check failed." },
      { status: 409 },
    );
  }
}
