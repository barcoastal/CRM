import { describe, expect, it } from "vitest";
import { arrangeFields, defaultFieldLayout, validateFieldLayout } from "@/lib/record-field-layout";

describe("record field layouts", () => {
  it("preserves the original layout without configuration", () => {
    expect(arrangeFields(["Email", "Phone"], value => value)).toEqual([{ field: "Email", span: 1 }, { field: "Phone", span: 1 }]);
  });
  it("reorders and hides fields while retaining new fields", () => {
    expect(arrangeFields(["Email", "Phone", "Brand"], value => value, { columns: 2, fields: [{ id: "Phone", hidden: false, span: 2 }, { id: "Email", hidden: true, span: 1 }] })).toEqual([{ field: "Phone", span: 2 }, { field: "Brand", span: 1 }]);
  });
  it("cannot reintroduce fields removed by record permissions", () => {
    expect(arrangeFields(["Email"], value => value, { columns: 2, fields: [{ id: "SSN", hidden: false, span: 1 }, { id: "Email", hidden: false, span: 1 }] })).toEqual([{ field: "Email", span: 1 }]);
  });
  it("validates all default layouts and rejects unknown fields and duplicate slots", () => {
    for (const entity of ["Lead", "Account", "Opportunity", "Negotiation"] as const) expect(validateFieldLayout(entity, defaultFieldLayout(entity))).toEqual(defaultFieldLayout(entity));
    expect(() => validateFieldLayout("Lead", { bogus: { columns: 2, fields: [] } })).toThrow();
    const layout = defaultFieldLayout("Lead");
    const key = Object.keys(layout)[0];
    layout[key].fields.push(layout[key].fields[0]);
    expect(() => validateFieldLayout("Lead", layout)).toThrow();
  });
});
