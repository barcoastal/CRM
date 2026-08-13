import { describe, it, expect } from "vitest";
import {
  normalizeSubject,
  normalizeMessageId,
  extractEmails,
  resolveThreadId,
  type ThreadFinders,
} from "@/lib/email/threading";

describe("normalizeSubject", () => {
  it("strips re/fw/fwd prefixes repeatedly and lowercases", () => {
    expect(normalizeSubject("Re: RE: Fwd: Your settlement offer ")).toBe("your settlement offer");
    expect(normalizeSubject("FW:Payment plan")).toBe("payment plan");
    expect(normalizeSubject("Hello")).toBe("hello");
    expect(normalizeSubject("")).toBe("");
  });
});

describe("normalizeMessageId", () => {
  it("strips angle brackets and lowercases", () => {
    expect(normalizeMessageId("<ABC@x.com>")).toBe("abc@x.com");
    expect(normalizeMessageId("abc@x.com")).toBe("abc@x.com");
  });
});

describe("extractEmails", () => {
  it("parses display names and CSV lists", () => {
    expect(extractEmails('Joe Sullivan <joe@x.com>, "Ann" <ann@y.com>')).toEqual([
      "joe@x.com",
      "ann@y.com",
    ]);
    expect(extractEmails("plain@x.com")).toEqual(["plain@x.com"]);
    expect(extractEmails(null)).toEqual([]);
    expect(extractEmails("not-an-email")).toEqual([]);
  });

  it("handles quoted display names containing commas", () => {
    expect(extractEmails('"Sullivan, Joe" <joe@x.com>, Ann <ann@y.com>')).toEqual([
      "joe@x.com",
      "ann@y.com",
    ]);
  });

  it("handles mixed plain and angle-bracket addresses", () => {
    expect(extractEmails("plain@x.com, Name <other@x.com>")).toEqual([
      "plain@x.com",
      "other@x.com",
    ]);
  });
});

function finders(overrides: Partial<ThreadFinders>): ThreadFinders {
  return {
    byMessageIdHeader: async () => null,
    bySubjectAndCounterparty: async () => null,
    ...overrides,
  };
}

describe("resolveThreadId", () => {
  it("prefers inReplyTo match and returns its threadId", async () => {
    const f = finders({
      byMessageIdHeader: async (mid) =>
        mid === "<abc@x.com>" ? { id: "m1", threadId: "t1" } : null,
    });
    const r = await resolveThreadId(
      { inReplyTo: "<abc@x.com>", subject: "Re: hi", counterpartyEmails: ["joe@x.com"] },
      f,
    );
    expect(r).toBe("t1");
  });

  it("falls back to parent id when parent has no threadId", async () => {
    const f = finders({
      byMessageIdHeader: async () => ({ id: "m1", threadId: null }),
    });
    const r = await resolveThreadId(
      { inReplyTo: "<abc@x.com>", subject: "Re: hi", counterpartyEmails: [] },
      f,
    );
    expect(r).toBe("m1");
  });

  it("falls back to subject + counterparty match", async () => {
    const f = finders({
      bySubjectAndCounterparty: async (subjectNorm, emails) =>
        subjectNorm === "your offer" && emails.includes("joe@x.com")
          ? { id: "m2", threadId: "t2" }
          : null,
    });
    const r = await resolveThreadId(
      { inReplyTo: null, subject: "RE: Your offer", counterpartyEmails: ["joe@x.com"] },
      f,
    );
    expect(r).toBe("t2");
  });

  it("returns null for a brand new conversation", async () => {
    const r = await resolveThreadId(
      { inReplyTo: null, subject: "New topic", counterpartyEmails: ["joe@x.com"] },
      finders({}),
    );
    expect(r).toBeNull();
  });

  it("returns null when subject is empty after normalization", async () => {
    const f = finders({
      bySubjectAndCounterparty: async () => ({ id: "m9", threadId: "t9" }),
    });
    const r = await resolveThreadId(
      { inReplyTo: null, subject: "Re:", counterpartyEmails: ["joe@x.com"] },
      f,
    );
    expect(r).toBeNull();
  });

  it("computes the 30-day window from the injected now", async () => {
    let receivedSince: Date | null = null;
    const now = new Date("2026-08-13T00:00:00Z");
    const f = finders({
      bySubjectAndCounterparty: async (_s, _e, since) => {
        receivedSince = since;
        return null;
      },
    });
    await resolveThreadId(
      { inReplyTo: null, subject: "Hi there", counterpartyEmails: ["joe@x.com"] },
      f,
      now,
    );
    expect(receivedSince).toEqual(new Date("2026-07-14T00:00:00Z"));
  });
});
