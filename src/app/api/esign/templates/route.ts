import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";
import { saveTemplatePdf } from "@/lib/esign/storage";
import { acroFormFieldNames, pageCount } from "@/lib/esign/pdf";
import { RECORD_TYPES } from "@/lib/esign/merge-paths";
import { detectDocKind } from "@/lib/esign/doc-detect";
import { convertWordToPdf } from "@/lib/esign/docx-to-pdf";

export async function GET() {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  const items = await prisma.envelopeTemplate.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      recordType: true,
      description: true,
      pdfFilename: true,
      pageCount: true,
      isActive: true,
      mergeMapping: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { id: true, name: true } },
    },
  });

  const out = items.map((t) => {
    const mapping = (t.mergeMapping ?? {}) as Record<string, unknown>;
    return {
      id: t.id,
      name: t.name,
      recordType: t.recordType,
      description: t.description,
      pdfFilename: t.pdfFilename,
      pageCount: t.pageCount,
      isActive: t.isActive,
      fieldCount: Object.keys(mapping).length,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      createdBy: t.createdBy,
    };
  });

  return NextResponse.json({ items: out });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  const name = (form.get("name") ?? "").toString().trim();
  const recordTypeRaw = (form.get("recordType") ?? "CONTRACT").toString().trim();
  const description = (form.get("description") ?? "").toString().trim() || null;

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const recordType = (RECORD_TYPES as readonly string[]).includes(recordTypeRaw)
    ? recordTypeRaw
    : "CONTRACT";

  const originalFilename =
    (file instanceof File && typeof file.name === "string" && file.name) || `${name}.pdf`;

  // Accept PDF directly; convert Word (.docx/.doc) to PDF so the rest of the
  // signing pipeline (render, place fields, merge signed PDF) is unchanged.
  const uploaded = Buffer.from(await file.arrayBuffer());
  const kind = detectDocKind(originalFilename, uploaded);
  if (!kind) {
    return NextResponse.json(
      { error: "Unsupported file. Upload a PDF or Word document (.pdf, .docx, .doc)." },
      { status: 400 },
    );
  }

  let bytes = uploaded;
  if (kind === "docx" || kind === "doc") {
    try {
      bytes = Buffer.from(await convertWordToPdf(uploaded, originalFilename));
    } catch (err) {
      return NextResponse.json(
        {
          error:
            "Could not convert the Word document to PDF. Please try re-saving it, or upload a PDF.",
          details: err instanceof Error ? err.message : String(err),
        },
        { status: 422 },
      );
    }
  }

  let pages = 1;
  let fieldNames: string[] = [];
  try {
    pages = await pageCount(bytes);
    fieldNames = await acroFormFieldNames(bytes);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to parse PDF", details: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  // Build a stub mapping with each AcroForm field unset, so the mapper UI
  // already has a row per field on first load.
  const stubMapping: Record<string, string> = {};
  for (const n of fieldNames) stubMapping[n] = "";

  const tpl = await prisma.envelopeTemplate.create({
    data: {
      name,
      recordType,
      description,
      pdfPath: "pending.pdf", // overwritten below after we know the id
      pdfFilename: originalFilename,
      pageCount: pages,
      mergeMapping: stubMapping,
      createdById: r.session.userId,
    },
  });

  const { relativePath } = await saveTemplatePdf(bytes, tpl.id);

  const saved = await prisma.envelopeTemplate.update({
    where: { id: tpl.id },
    data: { pdfPath: relativePath },
  });

  await auditWrite({
    userId: r.session.userId,
    entity: "EnvelopeTemplate",
    entityId: saved.id,
    action: "CREATE",
    after: {
      name: saved.name,
      recordType: saved.recordType,
      pdfFilename: saved.pdfFilename,
      pageCount: saved.pageCount,
    },
  });

  return NextResponse.json(saved, { status: 201 });
}
