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
