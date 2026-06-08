import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { readTemplatePdf } from "@/lib/esign/storage";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const tpl = await prisma.envelopeTemplate.findUnique({
    where: { id },
    select: { pdfPath: true, pdfFilename: true },
  });
  if (!tpl) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await readTemplatePdf(tpl.pdfPath);
  } catch (err) {
    return NextResponse.json(
      { error: "PDF not found on disk", details: err instanceof Error ? err.message : String(err) },
      { status: 404 },
    );
  }

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${tpl.pdfFilename.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
