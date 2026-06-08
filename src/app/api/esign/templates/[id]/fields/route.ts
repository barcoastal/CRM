import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { readTemplatePdf } from "@/lib/esign/storage";
import { acroFormFieldNames, pageCount } from "@/lib/esign/pdf";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const tpl = await prisma.envelopeTemplate.findUnique({
    where: { id },
    select: { pdfPath: true, pageCount: true },
  });
  if (!tpl) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await readTemplatePdf(tpl.pdfPath);
  } catch {
    return NextResponse.json({ fields: [], pageCount: tpl.pageCount });
  }

  let fields: string[] = [];
  let pages = tpl.pageCount;
  try {
    fields = await acroFormFieldNames(bytes);
    pages = await pageCount(bytes);
  } catch {
    // PDF is unreadable somehow. Surface what we have so the UI still loads.
  }

  return NextResponse.json({ fields, pageCount: pages });
}
