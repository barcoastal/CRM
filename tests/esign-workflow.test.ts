import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/opportunity-stage", () => ({ advanceOppStage: vi.fn() }));
import {
  orderedFields,
  nextUnfinished,
  fieldStyle,
  type FieldGroups,
} from "@/lib/esign/fields";
import {
  packetConfigSchema,
  packetErrors,
  type PacketConfig,
} from "@/lib/esign/packet-config";
import { recipientBoxes } from "@/lib/esign/packet-routing";
import { invitationHtml } from "@/lib/esign/packet-email";
import { requiredFieldsError, signingInput } from "@/lib/esign/signing-input";
import { DISCLOSURE_VERSION } from "@/lib/esign/disclosure";
const box = { page: 1, x: 40, y: 500, width: 120, height: 25 };
const groups: FieldGroups = {
  signatureBoxes: [{ ...box, page: 2 }, { ...box }],
  initialBoxes: [{ ...box, y: 400 }],
  textBoxes: [{ ...box, label: "Full name (page 1)" }],
  dateBoxes: [box],
  checkboxBoxes: [],
};
const config: PacketConfig = {
  documents: [{ id: "d", name: "Test.pdf", startPage: 1, pageCount: 2 }],
  recipients: [
    {
      id: "a",
      name: "Alice Test",
      email: "alice@example.test",
      action: "SIGN",
      order: 1,
    },
    {
      id: "b",
      name: "Bob Test",
      email: "bob@example.test",
      action: "SIGN",
      order: 2,
    },
  ],
  fields: [
    {
      ...box,
      id: "a-sign",
      kind: "signature",
      recipientId: "a",
      required: true,
    },
    {
      ...box,
      id: "b-sign",
      kind: "signature",
      recipientId: "b",
      required: true,
    },
  ],
  subject: "Test",
  message: "Test message",
  reminderDays: 1,
  expiresDays: 30,
};
describe("Guided signing", () => {
  it("sorts fields in document reading order, retaining stable IDs", () => {
    const fields = orderedFields(groups);
    expect(fields.find((f) => f.id === "text-0")?.kind).toBe("name");
    expect(fields.at(-1)?.id).toBe("signature-0");
    expect(
      fields.indexOf(fields.find((f) => f.id === "signature-1")!),
    ).toBeLessThan(fields.indexOf(fields.find((f) => f.id === "initial-0")!));
  });
  it("Next skips auto-filled fields and already applied signatures, and wraps to gaps", () => {
    const f = orderedFields(groups);
    expect(nextUnfinished(f, new Set())?.id).toBe("signature-1");
    expect(nextUnfinished(f, new Set(["signature-1"]), "signature-1")?.id).toBe(
      "initial-0",
    );
    expect(
      nextUnfinished(f, new Set(["signature-0", "initial-0"]), "signature-0")
        ?.id,
    ).toBe("signature-1");
    expect(
      nextUnfinished(f, new Set(["signature-0", "signature-1", "initial-0"])),
    ).toBeNull();
  });
  it("uses bottom-left PDF coordinates for all zoom scales", () => {
    expect(fieldStyle(box, 792)).toEqual({
      left: 40,
      top: 267,
      width: 120,
      height: 25,
    });
  });
  it("rejects finishing when only one of several required signatures was applied", () => {
    const body = signingInput.parse({
      signature: "data:image/png;base64,AAAA",
      fullName: "Alice Test",
      consent: true,
      disclosureVersion: DISCLOSURE_VERSION,
      appliedFieldIds: ["signature-0"],
    });
    expect(
      requiredFieldsError(body, {
        ...groups,
        initialBoxes: [],
        textBoxes: [],
        dateBoxes: [],
      }),
    ).toContain("every required location");
  });
});
describe("Packet preparation", () => {
  it("accepts a valid sequential packet", () => {
    expect(packetConfigSchema.safeParse(config).success).toBe(true);
    expect(packetErrors(config, [{ width: 612, height: 792 }])).toEqual([]);
  });
  it("blocks send for missing required signatures, duplicate orders, or fields beyond the page", () => {
    const c = structuredClone(config);
    c.recipients[1].order = 1;
    c.fields[1].required = false;
    c.fields[0].x = 600;
    const errors = packetErrors(c, [{ width: 612, height: 792 }]);
    expect(errors.join(" ")).toContain("distinct signing order");
    expect(errors.join(" ")).toContain("Bob Test");
    expect(errors.join(" ")).toContain("outside page");
  });
  it("rejects duplicate field identities and copy-recipient signature assignments", () => {
    const c = structuredClone(config);
    c.fields[1].id = c.fields[0].id;
    c.recipients[1].action = "COPY";
    expect(packetErrors(c, [{ width: 612, height: 792 }]).join(" ")).toContain(
      "Field IDs must be unique",
    );
    expect(packetErrors(c, [{ width: 612, height: 792 }]).join(" ")).toContain(
      "belong to a signer",
    );
  });
  it("isolates each signer fields and reuses full name automatically", () => {
    const c = structuredClone(config);
    c.fields.push({
      ...box,
      id: "name",
      kind: "name",
      recipientId: "a",
      required: true,
    });
    const a = recipientBoxes(c, "a");
    const b = recipientBoxes(c, "b");
    expect(a.signatureBoxes).toHaveLength(1);
    expect(a.textBoxes[0].label).toBe("Full name");
    expect(b.textBoxes).toEqual([]);
  });
  it("rejects invalid emails and reminder/expiry bounds", () => {
    expect(
      packetConfigSchema.safeParse({ ...config, expiresDays: 0 }).success,
    ).toBe(false);
    expect(
      packetConfigSchema.safeParse({ ...config, reminderDays: -1 }).success,
    ).toBe(false);
    expect(
      packetConfigSchema.safeParse({
        ...config,
        recipients: [{ ...config.recipients[0], email: "bad" }],
      }).success,
    ).toBe(false);
  });
  it("escapes invitation message, sender and links", () => {
    const html = invitationHtml({
      sender: "<script>bad</script>",
      message: '<img onerror="bad">',
      url: 'https://example.test/?a="x"',
      root: "https://example.test",
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img onerror");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Review Documents");
  });
});

it("validates typed and choice fields before accepting signer values", async () => {
  const { textFieldError } = await import("@/lib/esign/fields");
  expect(textFieldError({ inputType: "email" }, "invalid")).toContain(
    "valid email",
  );
  expect(textFieldError({ inputType: "number" }, "12x")).toContain(
    "valid number",
  );
  expect(textFieldError({ inputType: "number" }, "12.50")).toBeNull();
  expect(
    textFieldError(
      { inputType: "dropdown", options: ["Owner", "Director"] },
      "Stranger",
    ),
  ).toContain("listed options");
  expect(
    textFieldError({ inputType: "radio", options: ["Yes", "No"] }, "Yes"),
  ).toBeNull();
  const c = structuredClone(config);
  c.fields.push({
    ...box,
    id: "choice",
    kind: "text",
    recipientId: "a",
    required: true,
    inputType: "dropdown",
    options: [],
  });
  expect(packetErrors(c, [{ width: 612, height: 792 }]).join(" ")).toContain(
    "distinct, nonempty options",
  );
});
