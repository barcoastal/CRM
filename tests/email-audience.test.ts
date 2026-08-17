// tests/email-audience.test.ts
import { describe, it, expect } from "vitest";
import { dedupeByEmail, parseSources, type AudienceSource } from "@/lib/email/audience";

describe("parseSources", () => {
  it("keeps only well-formed sources", () => {
    const raw = [
      { type: "segment", id: "s1" },
      { type: "listview", id: "l1" },
      { type: "campaign", id: "c1" },
      { type: "bogus", id: "x" },
      { type: "segment" },
      "junk",
    ];
    expect(parseSources(raw)).toEqual([
      { type: "segment", id: "s1" },
      { type: "listview", id: "l1" },
      { type: "campaign", id: "c1" },
    ]);
  });
  it("handles non-arrays", () => {
    expect(parseSources(null)).toEqual([]);
    expect(parseSources({})).toEqual([]);
  });
});

describe("dedupeByEmail", () => {
  const r = (email: string, id: string) => ({
    entityType: "Lead" as const,
    id,
    email,
    vars: {},
  });
  it("keeps the first recipient per case-insensitive email", () => {
    const out = dedupeByEmail([r("A@x.com", "1"), r("a@x.com", "2"), r("b@x.com", "3")]);
    expect(out.map((x) => x.id)).toEqual(["1", "3"]);
  });
  it("drops empty emails", () => {
    expect(dedupeByEmail([r("", "1")])).toEqual([]);
  });
});
