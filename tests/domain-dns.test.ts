// tests/domain-dns.test.ts
import { describe, it, expect } from "vitest";
import { classifySpf, classifyDmarc, reverseIpForDnsbl } from "@/lib/email/domain-dns";

describe("classifySpf", () => {
  it("PASS when a v=spf1 record exists", () => {
    expect(classifySpf(["v=spf1 include:_spf.resend.com ~all"])).toEqual({ status: "PASS", record: "v=spf1 include:_spf.resend.com ~all" });
  });
  it("FAIL when TXT records exist but none are spf", () => {
    expect(classifySpf(["some-verification=abc"]).status).toBe("FAIL");
  });
  it("UNKNOWN when there are no records (lookup failure)", () => {
    expect(classifySpf(null).status).toBe("UNKNOWN");
  });
});

describe("classifyDmarc", () => {
  it("PASS on a policy of quarantine or reject", () => {
    expect(classifyDmarc(["v=DMARC1; p=reject"]).status).toBe("PASS");
    expect(classifyDmarc(["v=DMARC1; p=quarantine"]).status).toBe("PASS");
  });
  it("FAIL on p=none (present but not enforcing)", () => {
    expect(classifyDmarc(["v=DMARC1; p=none"]).status).toBe("FAIL");
  });
  it("UNKNOWN when absent", () => {
    expect(classifyDmarc(null).status).toBe("UNKNOWN");
  });
});

describe("reverseIpForDnsbl", () => {
  it("reverses the octets for a DNSBL query", () => {
    expect(reverseIpForDnsbl("1.2.3.4", "zen.spamhaus.org")).toBe("4.3.2.1.zen.spamhaus.org");
  });
  it("returns null for a non-ipv4 string", () => {
    expect(reverseIpForDnsbl("not-an-ip", "zen.spamhaus.org")).toBeNull();
  });
});
