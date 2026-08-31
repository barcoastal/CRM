// tests/gmail-map.test.ts
import { describe, it, expect } from "vitest";
import { parseHeaders, detectDirection, pickCounterparty, decodeBase64Url, type GmailHeaders } from "@/lib/google/gmail-map";

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
