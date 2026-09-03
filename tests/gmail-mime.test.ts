// tests/gmail-mime.test.ts
import { describe, it, expect } from "vitest";
import { buildMime } from "@/lib/google/mime-build";

function decode(raw: string): string {
  return Buffer.from(raw, "base64url").toString("utf8");
}

describe("buildMime", () => {
  it("builds a simple text message with the core headers", () => {
    const raw = buildMime({
      from: "rep@coastaldebt.com",
      to: ["client@brightpath.com"],
      subject: "Hello there",
      bodyText: "Hi Client",
      messageId: "<abc@coastaldebt.com>",
    });
    const s = decode(raw);
    expect(s).toContain("From: rep@coastaldebt.com");
    expect(s).toContain("To: client@brightpath.com");
    expect(s).toContain("Subject: Hello there");
    expect(s).toContain("Message-ID: <abc@coastaldebt.com>");
    expect(s).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(s).toContain(Buffer.from("Hi Client", "utf8").toString("base64"));
  });

  it("adds reply headers and CC", () => {
    const raw = buildMime({
      from: "rep@coastaldebt.com",
      to: ["client@brightpath.com"],
      cc: ["boss@coastaldebt.com"],
      subject: "Re: Offer",
      bodyText: "See below",
      messageId: "<def@coastaldebt.com>",
      inReplyTo: "<orig@brightpath.com>",
      references: "<orig@brightpath.com>",
    });
    const s = decode(raw);
    expect(s).toContain("Cc: boss@coastaldebt.com");
    expect(s).toContain("In-Reply-To: <orig@brightpath.com>");
    expect(s).toContain("References: <orig@brightpath.com>");
  });

  it("builds multipart/mixed with an attachment", () => {
    const raw = buildMime({
      from: "rep@coastaldebt.com",
      to: ["client@brightpath.com"],
      subject: "Docs",
      bodyText: "Attached",
      messageId: "<ghi@coastaldebt.com>",
      attachments: [{ filename: "agreement.pdf", contentType: "application/pdf", content: Buffer.from("PDFDATA") }],
    });
    const s = decode(raw);
    expect(s).toContain("Content-Type: multipart/mixed; boundary=");
    expect(s).toContain('Content-Disposition: attachment; filename="agreement.pdf"');
    expect(s).toContain("Content-Type: application/pdf");
    expect(s).toContain(Buffer.from("PDFDATA").toString("base64"));
  });

  it("RFC-2047 encodes a non-ASCII subject", () => {
    const raw = buildMime({
      from: "rep@coastaldebt.com",
      to: ["client@brightpath.com"],
      subject: "Réservé café",
      bodyText: "x",
      messageId: "<jkl@coastaldebt.com>",
    });
    const s = decode(raw);
    expect(s).toContain("Subject: =?UTF-8?B?");
  });
});
