import { describe, it, expect } from "vitest";
import { detectDocKind } from "@/lib/esign/doc-detect";

const pdf = Buffer.from("%PDF-1.7\n...rest");
const docxZip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]); // "PK\x03\x04"
const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

describe("detectDocKind", () => {
  it("detects a PDF by header regardless of name", () => {
    expect(detectDocKind("contract.pdf", pdf)).toBe("pdf");
    expect(detectDocKind("weird-name", pdf)).toBe("pdf");
  });

  it("detects .docx (zip magic + extension)", () => {
    expect(detectDocKind("agreement.docx", docxZip)).toBe("docx");
  });

  it("detects legacy .doc (OLE2 magic + extension)", () => {
    expect(detectDocKind("old.doc", ole)).toBe("doc");
  });

  it("rejects a zip that isn't named .docx", () => {
    expect(detectDocKind("archive.zip", docxZip)).toBeNull();
  });

  it("rejects an unknown / unsupported file", () => {
    expect(detectDocKind("notes.txt", Buffer.from("hello world"))).toBeNull();
  });

  it("does not misread a .docx name without zip bytes", () => {
    expect(detectDocKind("fake.docx", Buffer.from("not a zip"))).toBeNull();
  });
});
