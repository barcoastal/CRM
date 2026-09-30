import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { NextResponse } from "next/server";
export async function GET() {
  if (process.env.NODE_ENV !== "development")
    return new NextResponse(null, { status: 404 });
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 3; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText("COASTAL DEBT - INTERFACE TEST", {
      x: 55,
      y: 720,
      font,
      size: 20,
      color: rgb(0.15, 0.2, 0.4),
    });
    page.drawText("SAMPLE ONLY - NOT A CONTRACT", {
      x: 55,
      y: 685,
      font,
      size: 14,
    });
    page.drawText(`Sample document page ${i} of 3`, {
      x: 55,
      y: 625,
      font,
      size: 12,
    });
    page.drawText(
      "Use Start and Next to visit each required signature or initial.",
      { x: 55, y: 590, font, size: 12 },
    );
    page.drawText(i === 2 ? "Initials:" : "Signature:", {
      x: 80,
      y: 225,
      font,
      size: 11,
    });
    if (i !== 2) {
      page.drawText("Full name:", { x: 80, y: 278, font, size: 11 });
      page.drawText("Date:", { x: 80, y: 155, font, size: 11 });
    }
  }
  return new NextResponse(new Uint8Array(await doc.save()), {
    headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store" },
  });
}
