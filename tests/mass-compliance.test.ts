// tests/mass-compliance.test.ts
import { describe, it, expect } from "vitest";
import { appendUnsubscribeFooter, unsubscribeHeaders } from "@/lib/email/mass-sender";

describe("appendUnsubscribeFooter", () => {
  it("appends a footer link before </body> when present", () => {
    const out = appendUnsubscribeFooter("<html><body><p>Hi</p></body></html>", "https://x.com/u/t1");
    expect(out).toContain('href="https://x.com/u/t1"');
    expect(out.indexOf("Unsubscribe")).toBeLessThan(out.indexOf("</body>"));
  });
  it("appends at the end when no body tag", () => {
    const out = appendUnsubscribeFooter("<p>Hi</p>", "https://x.com/u/t1");
    expect(out.endsWith("</p>")).toBe(false);
    expect(out).toContain("Unsubscribe");
  });
});

describe("unsubscribeHeaders", () => {
  it("builds one-click List-Unsubscribe headers", () => {
    const h = unsubscribeHeaders("https://x.com/u/t1");
    expect(h["List-Unsubscribe"]).toBe("<https://x.com/u/t1>");
    expect(h["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});
