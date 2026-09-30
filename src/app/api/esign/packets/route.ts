import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { prepareAnchoredPacket } from "@/lib/contracts/anchors";
import { planPacket, loadPacketTemplates } from "@/lib/contracts/routing";
import { buildContractData } from "@/lib/contracts/merge-data";
import { fillDocxToPdf } from "@/lib/contracts/docx-merge";
import { orderedFields, type FieldGroups } from "@/lib/esign/fields";
import type { PacketField } from "@/lib/esign/packet-config";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { saveEnvelopePdf, readTemplatePdf } from "@/lib/esign/storage";
import {
  fillAcroForm,
  stampDataBoxes,
  buildMergeContextForOpportunity,
} from "@/lib/esign/merge";
export async function POST(req: NextRequest) {
  const auth = await requireAuthOrRespond("Opportunity.Edit");
  if ("response" in auth) return auth.response;
  const form = await req.formData();
  const generate = form.get("generate") === "true";
  const files = form
    .getAll("files")
    .filter((x): x is File => x instanceof File);
  let templateIds: string[], documentOrder: string[];
  try {
    templateIds = JSON.parse(String(form.get("templateIds") ?? "[]"));
    documentOrder = JSON.parse(String(form.get("documentOrder") ?? "[]"));
    if (
      !Array.isArray(templateIds) ||
      !templateIds.every((x) => typeof x === "string") ||
      !Array.isArray(documentOrder)
    )
      throw new Error();
  } catch {
    return NextResponse.json(
      { error: "Invalid document selection." },
      { status: 400 },
    );
  }
  if (
    (!generate && files.length + templateIds.length < 1) ||
    files.length + templateIds.length > 20 ||
    files.reduce((s, f) => s + f.size, 0) > 50 * 1024 * 1024
  )
    return NextResponse.json(
      { error: "Choose 1–20 PDFs or templates, up to 50 MB total." },
      { status: 400 },
    );
  const opportunityId = String(form.get("opportunityId") ?? "") || null;
  const merge = opportunityId
    ? await buildMergeContextForOpportunity(opportunityId)
    : { today: new Date().toISOString().slice(0, 10) };
  const pdf = await PDFDocument.create();
  const documents = [];
  const fields: PacketField[] = [];
  const sources: {
    key: string;
    name: string;
    bytes: Uint8Array;
    groups?: FieldGroups;
  }[] = [];
  try {
    if (generate) {
      if (!opportunityId) throw new Error("Choose an opportunity first.");
      const plan = await planPacket(opportunityId);
      if (form.get("includeAddendum") === "true" && !plan.categories.includes("ADDENDUM"))
        plan.categories.splice(1, 0, "ADDENDUM");
      const { templates, missing } = await loadPacketTemplates(plan);
      if (missing.length)
        return NextResponse.json(
          {
            error: `Upload the missing contract templates first: ${missing.join(", ")}`,
          },
          { status: 400 },
        );
      const data = await buildContractData(opportunityId);
      for (const t of templates) {
        const a = await prepareAnchoredPacket(
          await fillDocxToPdf(t.buffer, data, t.name),
        );
        sources.push({
          key: t.category,
          name: t.name.replace(/\.docx$/i, ".pdf"),
          bytes: a.pdf,
          groups: { ...a, checkboxBoxes: [] },
        });
      }
    }
    for (const [i, f] of files.entries())
      sources.push({
        key: `file:${i}`,
        name: f.name,
        bytes: new Uint8Array(await f.arrayBuffer()),
      });
    for (const id of templateIds) {
      const t = await prisma.envelopeTemplate.findUnique({ where: { id } });
      if (!t?.isActive) throw new Error("Template unavailable");
      let b = await fillAcroForm(
        await readTemplatePdf(t.pdfPath),
        t.mergeMapping as Record<string, string>,
        merge,
      );
      b = await stampDataBoxes(b, t.dataBoxes as never, merge);
      sources.push({
        key: `template:${id}`,
        name: t.name,
        bytes: b,
        groups: {
          signatureBoxes: t.signatureBoxes ?? [],
          initialBoxes: t.initialBoxes ?? [],
          dateBoxes: t.dateBoxes ?? [],
          textBoxes: t.textBoxes ?? [],
          checkboxBoxes: t.checkboxBoxes ?? [],
        } as unknown as FieldGroups,
      });
    }
    if (documentOrder.length) {
      if (
        documentOrder.length !== sources.length ||
        new Set(documentOrder).size !== sources.length ||
        documentOrder.some((k) => !sources.some((s) => s.key === k))
      )
        throw new Error("Invalid order");
      sources.sort(
        (a, b) => documentOrder.indexOf(a.key) - documentOrder.indexOf(b.key),
      );
    }
    for (const s of sources) {
      const d = await PDFDocument.load(s.bytes);
      if (d.getPages().some((p) => p.getRotation().angle % 360 !== 0))
        throw new Error("Rotated pages must be normalized before upload");
      d.getForm().flatten();
      const startPage = pdf.getPageCount() + 1;
      if (s.groups)
        fields.push(
          ...orderedFields(s.groups).map((f) => ({
            ...f,
            id: randomUUID(),
            page: f.page + startPage - 1,
            recipientId: "primary",
            required:
              f.kind === "checkbox"
                ? f.required === true
                : f.required !== false,
          })),
        );
      for (const p of await pdf.copyPages(d, d.getPageIndices()))
        pdf.addPage(p);
      documents.push({
        id: randomUUID(),
        name: s.name.slice(0, 250),
        pageCount: d.getPageCount(),
        startPage,
      });
    }
    if (pdf.getPageCount() > 200)
      throw new Error("Packets are limited to 200 pages");
  } catch {
    return NextResponse.json(
      {
        error:
          "Unable to prepare documents. Use readable, unencrypted PDFs or valid templates.",
      },
      { status: 400 },
    );
  }
  const id = randomUUID();
  const preparedPdfPath = await saveEnvelopePdf(
    Buffer.from(await pdf.save()),
    id,
  );
  const config = {
    documents,
    recipients: [],
    fields,
    subject: "Document Signature Requested Coastal Debt Resolve",
    message:
      "I am sending you this request for your electronic signature. Please review and electronically sign the documents.",
    reminderDays: 1,
    expiresDays: 30,
  };
  const packet = await prisma.signingPacket.create({
    data: {
      id,
      name: documents[0].name,
      createdById: auth.session.userId,
      opportunityId,
      preparedPdfPath,
      config,
    },
  });
  return NextResponse.json({
    id: packet.id,
    revision: packet.revision,
    config,
  });
}
export async function GET() {
  const auth = await requireAuthOrRespond("Opportunity.View");
  if ("response" in auth) return auth.response;
  const items = await prisma.signingPacket.findMany({
    where: { createdById: auth.session.userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, name: true, status: true, createdAt: true },
  });
  return NextResponse.json({ items });
}
