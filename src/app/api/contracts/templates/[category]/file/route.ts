/**
 * Serve a stored contract template's raw .docx so the in-CRM editor can open it.
 */
import { NextResponse } from "next/server";
import { CATEGORIES, readTemplate, type ContractCategory } from "@/lib/contracts/templates";

export async function GET(_req: Request, { params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  if (!CATEGORIES.some((c) => c.key === category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  const buf = await readTemplate(category as ContractCategory);
  if (!buf) return NextResponse.json({ error: "Template not uploaded yet" }, { status: 404 });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `inline; filename="${category}.docx"`,
    },
  });
}
