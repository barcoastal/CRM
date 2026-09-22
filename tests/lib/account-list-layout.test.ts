import { describe, expect, it } from "vitest";
import { normalizeAccountColumns, resolveAccountView } from "../../src/lib/account-list-layout";

describe("existing account list layouts", () => {
  it("reads old column keys in the saved order and keeps additional fields", () => {
    expect(normalizeAccountColumns(["name", "owner.name", "primaryContact.name", "currentTotalDebt", "updatedAt", "legalStatus"]))
      .toEqual(["name", "ownerFullName", "primaryContact", "totalDebt", "lastModified", "legalStatus"]);
  });
  it("ignores malformed entries, deduplicates aliases and falls back for empty layouts", () => {
    expect(normalizeAccountColumns([null, "owner.name", "ownerFullName"])).toEqual(["ownerFullName"]);
    expect(normalizeAccountColumns([])).toBeUndefined();
    expect(normalizeAccountColumns(null)).toBeUndefined();
  });
  it("resolves both existing links and custom picker links to the same saved definition", () => {
    const views = [{id:"one",developerName:"SF_Angie",columns:["name"]}];
    expect(resolveAccountView(views,"view:SF_Angie")).toBe(views[0]);
    expect(resolveAccountView(views,"custom:one")).toBe(views[0]);
    expect(resolveAccountView(views,"custom:private-missing")).toBeUndefined();
  });
});
