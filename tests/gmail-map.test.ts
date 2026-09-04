// tests/gmail-map.test.ts
import { describe, it, expect } from "vitest";
import { parseHeaders, detectDirection, pickCounterparty, decodeBase64Url, extractPlainBody, extractHtmlBody, stripHtmlToText, type GmailHeaders } from "@/lib/google/gmail-map";

const rawHeaders = [
  { name: "From", value: "Client X <client@brightpath.com>" },
  { name: "To", value: "Rep One <rep@coastaldebt.com>" },
  { name: "Subject", value: "Re: your offer" },
  { name: "Message-ID", value: "<abc123@mail.brightpath.com>" },
  { name: "In-Reply-To", value: "<prev@coastaldebt.com>" },
  { name: "Date", value: "Wed, 20 Aug 2026 10:00:00 -0400" },
];

describe("parseHeaders", () => {
  it("extracts headers case-insensitively", () => {
    const h = parseHeaders(rawHeaders);
    expect(h.from).toBe("Client X <client@brightpath.com>");
    expect(h.to).toBe("Rep One <rep@coastaldebt.com>");
    expect(h.subject).toBe("Re: your offer");
    expect(h.messageId).toBe("<abc123@mail.brightpath.com>");
    expect(h.inReplyTo).toBe("<prev@coastaldebt.com>");
    expect(h.date).toBe("Wed, 20 Aug 2026 10:00:00 -0400");
  });
  it("returns empty strings for missing headers", () => {
    const h = parseHeaders([]);
    expect(h.from).toBe("");
    expect(h.subject).toBe("");
    expect(h.messageId).toBe("");
  });
});

describe("detectDirection", () => {
  it("OUTBOUND when the rep is the sender", () => {
    expect(detectDirection("rep@coastaldebt.com", "Rep One <rep@coastaldebt.com>")).toBe("OUTBOUND");
  });
  it("INBOUND when the rep is not the sender", () => {
    expect(detectDirection("rep@coastaldebt.com", "Client X <client@brightpath.com>")).toBe("INBOUND");
  });
  it("is case-insensitive on the rep address", () => {
    expect(detectDirection("Rep@Coastaldebt.com", "<rep@coastaldebt.com>")).toBe("OUTBOUND");
  });
});

describe("pickCounterparty", () => {
  it("uses From for inbound and To for outbound", () => {
    expect(pickCounterparty("INBOUND", rawHeaders[0].value, rawHeaders[1].value)).toBe("client@brightpath.com");
    expect(pickCounterparty("OUTBOUND", rawHeaders[0].value, rawHeaders[1].value)).toBe("rep@coastaldebt.com");
  });
  it("returns null when the relevant header has no address", () => {
    expect(pickCounterparty("INBOUND", "no address here", "x@y.com")).toBeNull();
  });
});

describe("decodeBase64Url", () => {
  it("decodes Gmail base64url payloads", () => {
    // "Hello" in base64url
    expect(decodeBase64Url("SGVsbG8")).toBe("Hello");
    expect(decodeBase64Url("")).toBe("");
  });
});

function b64url(s: string): string {
  return Buffer.from(s, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
}

describe("stripHtmlToText", () => {
  it("drops <style>/<script>/comment contents, not just tags", () => {
    const html = `<html><head><style>body, td { font-family: arial; color: #fff; }</style></head><body><!-- hi --><p>Hello&nbsp;there</p><script>alert(1)</script></body></html>`;
    const text = stripHtmlToText(html);
    expect(text).toBe("Hello there");
    expect(text).not.toContain("font-family");
    expect(text).not.toContain("alert");
  });
});

describe("extractPlainBody with an HTML-only payload", () => {
  it("returns clean text, not the CSS from the style block", () => {
    const payload = {
      mimeType: "text/html",
      body: { data: b64url(`<style>.a{color:red}</style><p>Real body</p>`) },
    };
    expect(extractPlainBody(payload)).toBe("Real body");
  });
});

describe("extractHtmlBody", () => {
  it("returns the decoded text/html part from a multipart payload", () => {
    const payload = {
      mimeType: "multipart/alternative",
      parts: [
        { mimeType: "text/plain", body: { data: b64url("plain") } },
        { mimeType: "text/html", body: { data: b64url("<p>rich</p>") } },
      ],
    };
    expect(extractHtmlBody(payload)).toBe("<p>rich</p>");
  });
  it("returns empty string when there is no html part", () => {
    const payload = { mimeType: "text/plain", body: { data: b64url("plain") } };
    expect(extractHtmlBody(payload)).toBe("");
  });
});
