import { PDFDocument } from "pdf-lib";

/**
 * Thin wrappers around pdf-lib for the bits we need at upload time
 * (page count + AcroForm field discovery for the merge-field mapper).
 */

export async function pageCount(buf: Buffer): Promise<number> {
  const doc = await PDFDocument.load(buf);
  return doc.getPageCount();
}

export async function acroFormFieldNames(buf: Buffer): Promise<string[]> {
  const doc = await PDFDocument.load(buf);
  const form = doc.getForm();
  return form.getFields().map((f) => f.getName());
}
