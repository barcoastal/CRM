import { describe, it, expect } from "vitest";
import { renderTemplate, extractMergeFields } from "../../src/lib/template-render";

describe("renderTemplate", () => {
  it("substitutes single-level placeholders", () => {
    expect(renderTemplate("Hi {{name}}!", { name: "Bob" })).toBe("Hi Bob!");
  });
  it("supports dot paths", () => {
    expect(
      renderTemplate("Hi {{contact.firstName}}", { contact: { firstName: "Maria" } }),
    ).toBe("Hi Maria");
  });
  it("tolerates whitespace inside the braces", () => {
    expect(renderTemplate("Hi {{  name  }}", { name: "Bob" })).toBe("Hi Bob");
  });
  it("renders missing fields as empty", () => {
    expect(renderTemplate("Hi {{name}}, debt is {{amount}}", { name: "Bob" })).toBe(
      "Hi Bob, debt is ",
    );
  });
  it("handles multiple placeholders", () => {
    expect(
      renderTemplate("{{a}} + {{b}} = {{c}}", { a: 1, b: 2, c: 3 }),
    ).toBe("1 + 2 = 3");
  });
  it("ignores malformed tokens", () => {
    expect(renderTemplate("{name} { {name}", { name: "Bob" })).toBe("{name} { {name}");
  });
  it("treats nested null/undefined as empty", () => {
    expect(renderTemplate("{{a.b.c}}", { a: { b: null } })).toBe("");
    expect(renderTemplate("{{a.b.c}}", { a: null })).toBe("");
  });
  it("converts non-string values to string", () => {
    expect(renderTemplate("Score: {{score}}", { score: 91 })).toBe("Score: 91");
    expect(renderTemplate("Active: {{active}}", { active: true })).toBe("Active: true");
  });
});

describe("extractMergeFields", () => {
  it("returns unique sorted paths", () => {
    const fields = extractMergeFields("Hi {{contact.firstName}}, your debt is {{account.totalDebt}} and {{contact.firstName}}");
    expect(fields).toEqual(["account.totalDebt", "contact.firstName"]);
  });
  it("returns empty for a template with no merge fields", () => {
    expect(extractMergeFields("Plain text no merge")).toEqual([]);
  });
});
