import { describe, it, expect } from "vitest";
import { diffRecords } from "../../src/lib/audit";

describe("diffRecords", () => {
  it("returns empty diffs when records are identical", () => {
    const r = diffRecords({ a: 1, b: 2 }, { a: 1, b: 2 });
    expect(r.before).toEqual({});
    expect(r.after).toEqual({});
  });

  it("captures only the fields that changed", () => {
    const r = diffRecords({ a: 1, b: 2, c: "x" }, { a: 1, b: 99, c: "x" });
    expect(r.before).toEqual({ b: 2 });
    expect(r.after).toEqual({ b: 99 });
  });

  it("captures all fields on CREATE (before=null)", () => {
    const r = diffRecords(null, { a: 1, b: 2 });
    expect(r.before).toEqual({});
    expect(r.after).toEqual({ a: 1, b: 2 });
  });

  it("captures all fields on DELETE (after=null)", () => {
    const r = diffRecords({ a: 1, b: 2 }, null);
    expect(r.before).toEqual({ a: 1, b: 2 });
    expect(r.after).toEqual({});
  });

  it("treats equal Dates as unchanged", () => {
    const d = new Date("2026-01-01T00:00:00Z");
    const r = diffRecords({ when: new Date("2026-01-01T00:00:00Z") }, { when: d });
    expect(r.before).toEqual({});
    expect(r.after).toEqual({});
  });

  it("treats different Dates as a change", () => {
    const r = diffRecords({ when: new Date("2026-01-01") }, { when: new Date("2026-02-01") });
    expect(Object.keys(r.before)).toEqual(["when"]);
  });

  it("handles new keys appearing in `after`", () => {
    const r = diffRecords({ a: 1 }, { a: 1, b: 2 });
    expect(r.before).toEqual({ b: undefined });
    expect(r.after).toEqual({ b: 2 });
  });

  it("compares nested objects by JSON equality", () => {
    const r = diffRecords({ meta: { x: 1 } }, { meta: { x: 1 } });
    expect(r.before).toEqual({});
    const r2 = diffRecords({ meta: { x: 1 } }, { meta: { x: 2 } });
    expect(r2.before).toEqual({ meta: { x: 1 } });
    expect(r2.after).toEqual({ meta: { x: 2 } });
  });
});
