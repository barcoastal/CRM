import { expect, it } from "vitest";
import { recordBrand } from "@/lib/record-brand";

it("uses the record's selected brand before imported or related values", () => {
  expect(recordBrand({ brand: "BDI", sfDataJson: '{"Brand__c":"Coastal Debt"}' }, { brand: "Coastal Debt" })).toBe("BDI");
});
it("uses imported Brand and then the linked account when no brand is selected", () => {
  expect(recordBrand({ sfDataJson: '{"Brand__c":"Coastal Debt"}' }, { brand: "BDI" })).toBe("Coastal Debt");
  expect(recordBrand({ brand: " " }, { brand: "BDI" })).toBe("BDI");
});
it("does not guess a brand for unknown, missing, or malformed records", () => {
  expect(recordBrand(null, { sfDataJson: "invalid" })).toBeNull();
  expect(recordBrand({ brand: "Other brand" })).toBe("Other brand");
});
