import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ layouts: vi.fn(), account: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { pageLayout: { findMany: mocks.layouts }, account: { findUnique: mocks.account } } }));
import { assertStageRequirements } from "@/lib/stage-requirements-server";
import { missingStageFields, recordStage } from "@/lib/stage-requirements";
import { defaultFieldLayout, validateFieldLayout } from "@/lib/record-field-layout";
beforeEach(() => { vi.resetAllMocks(); mocks.layouts.mockResolvedValue([]); });
it("normalizes legacy stage spellings", () => {
  expect(recordStage("Lead", { status: "OPPORTUNITY" })).toBe("Converted");
  expect(recordStage("Opportunity", { stage: "WORKING_OPPORTUNITY" })).toBe("Working Opportunity");
  expect(recordStage("Account", { stage: "Old", clientStatus: "Active" })).toBe("Active");
});
it("required fields cannot be hidden or mapped to unsupported display values", () => {
  const layout = defaultFieldLayout("Lead");
  layout["lead-1"].fields.find(field => field.id === "Email")!.required = true;
  layout["lead-1"].fields.find(field => field.id === "Email")!.hidden = true;
  expect(() => validateFieldLayout("Lead", layout)).toThrow("visible");
});
it("checks whitespace but accepts zero and false", () => {
  const layout = defaultFieldLayout("Negotiation");
  for (const field of layout["negotiation-snapshot"].fields) field.required = ["Original balance", "Delinquent", "Creditor phone"].includes(field.id);
  expect(missingStageFields("Negotiation", layout, { originalBalance: 0, isDelinquent: false, creditorPhone: " " })).toEqual(["Creditor phone"]);
});
it("uses defaults when no stage override exists and reads Salesforce fields", async () => {
  mocks.layouts.mockResolvedValue([{ id: "record-fields:Lead:*", layout: { "lead-1": { columns: 2, fields: [{ id: "SSN", hidden: false, required: true, span: 1 }] } } }]);
  await expect(assertStageRequirements("Lead", { status: "Converted", sfDataJson: "{}" })).rejects.toThrow("SSN");
  await expect(assertStageRequirements("Lead", { status: "Converted", sfDataJson: '{"SSN__c":"present"}' })).resolves.toBeUndefined();
});
it("lets users complete current-stage records one field at a time", async () => {
  await assertStageRequirements("Lead", { status: "Working Lead", email: "x@example.com" }, { status: "Working Lead" });
  expect(mocks.layouts).not.toHaveBeenCalled();
});
it("prefers a stage override to the default requirements", async () => {
  mocks.layouts.mockResolvedValue([{ id: "record-fields:Lead:*", layout: { "lead-1": { columns: 2, fields: [{ id: "Email", hidden: false, required: true, span: 1 }] } } }, { id: "record-fields:Lead:Converted", layout: {} }]);
  await expect(assertStageRequirements("Lead", { status: "Converted" })).resolves.toBeUndefined();
});
it("does not silently bypass requirements on database errors", async () => {
  mocks.layouts.mockRejectedValue(new Error("Unavailable"));
  await expect(assertStageRequirements("Lead", { status: "Converted" })).rejects.toThrow("Unavailable");
});
