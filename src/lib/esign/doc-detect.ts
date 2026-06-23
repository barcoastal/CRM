/**
 * Detect what kind of document was uploaded for an e-sign template.
 *
 * We sign PDFs, so Word files get converted to PDF on upload (see
 * `docx-to-pdf.ts`). This helper decides which path a given upload takes,
 * using magic bytes + filename so a mislabeled file can't slip through.
 */
export type DocKind = "pdf" | "docx" | "doc";

export function detectDocKind(filename: string | null | undefined, bytes: Buffer): DocKind | null {
  const name = (filename ?? "").toLowerCase();

  // PDF: "%PDF" header.
  if (bytes.length >= 4 && bytes.subarray(0, 4).toString("ascii") === "%PDF") {
    return "pdf";
  }

  // DOCX (and other OOXML) are ZIP archives — "PK\x03\x04". Require the .docx
  // extension so we don't try to convert an arbitrary zip.
  const isZip =
    bytes.length >= 4 &&
    bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  if (isZip && name.endsWith(".docx")) return "docx";

  // Legacy .doc is an OLE2 compound file — "D0 CF 11 E0 A1 B1 1A E1".
  const isOle =
    bytes.length >= 8 &&
    bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 && bytes[5] === 0xb1 && bytes[6] === 0x1a && bytes[7] === 0xe1;
  if (isOle && name.endsWith(".doc")) return "doc";

  return null;
}
