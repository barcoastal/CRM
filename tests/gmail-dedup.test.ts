// tests/gmail-dedup.test.ts
import { describe, it, expect } from "vitest";
import { generateMessageId } from "@/lib/email-sender";
import { normalizeMessageId } from "@/lib/email/threading";

describe("generateMessageId", () => {
  it("produces an RFC-shaped id on the sending domain and round-trips through normalizeMessageId", () => {
    const id = generateMessageId("coastaldebt.com");
    expect(id).toMatch(/^<[a-z0-9.]+@coastaldebt\.com>$/i);
    const normalized = normalizeMessageId(id);
    expect(normalized).not.toContain("<");
    expect(normalized).toContain("@coastaldebt.com");
  });
});
