/**
 * Contract .docx templating — fills {{tokens}} (and {{#loops}}) in a Word doc
 * with a deal's data, then converts the result to PDF via the existing
 * LibreOffice pipeline. Part of the contract-packet feature.
 *
 * Author agreements in Word with {{ClientName}} scalars and repeating sections:
 *   {{#Creditors}} {{CreditorName}} {{Balance}} {{/Creditors}}
 * Missing tokens render empty (never leave a raw {{token}} in the output).
 */
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { PDFDocument } from "pdf-lib";
import { convertWordToPdf } from "@/lib/esign/docx-to-pdf";

export type MergeData = Record<string, unknown>;

/** Fill a .docx template buffer with data; returns the filled .docx buffer. */
export function fillDocxTemplate(docxBuffer: Buffer, data: MergeData): Buffer {
  const zip = new PizZip(docxBuffer);
  const doc = new Docxtemplater(zip, {
    delimiters: { start: "{{", end: "}}" },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "", // unresolved tokens render empty, not "undefined"
  });
  doc.render(data);
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}

/** Fill a .docx template and convert to PDF. */
export async function fillDocxToPdf(
  docxBuffer: Buffer,
  data: MergeData,
  name = "contract.docx",
): Promise<Buffer> {
  const filled = fillDocxTemplate(docxBuffer, data);
  return convertWordToPdf(filled, name);
}

/** Merge several PDFs into one, in order. */
export async function mergePdfs(pdfBuffers: Buffer[]): Promise<Buffer> {
  const out = await PDFDocument.create();
  for (const buf of pdfBuffers) {
    const src = await PDFDocument.load(buf);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return Buffer.from(await out.save());
}

/** Fill several .docx templates with the same data and merge into one packet PDF. */
export async function fillPacketToPdf(
  templates: { buffer: Buffer; name: string }[],
  data: MergeData,
): Promise<Buffer> {
  const pdfs: Buffer[] = [];
  for (const tpl of templates) {
    pdfs.push(await fillDocxToPdf(tpl.buffer, data, tpl.name));
  }
  return mergePdfs(pdfs);
}
