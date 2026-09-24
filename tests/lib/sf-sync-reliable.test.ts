import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { addPredicate, incrementalCsv, nextWindow, requireSourceParent, retry, writeBatch } from "@/lib/sf-sync/reliable";
import { checkpointedEntity } from "@/lib/sf-sync/checkpoint-runner";

const directories: string[] = [];
const temp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "sf-sync-test-")); directories.push(d); return d; };
afterEach(() => { for (const d of directories.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });

describe("reliable Salesforce sync", () => {
  it("retries dropped database connections but does not retry validation failures", async () => {
    const work = vi.fn().mockRejectedValueOnce({ code: "P1017" }).mockResolvedValue("ok");
    expect(await retry(work, 3, 0)).toBe("ok"); expect(work).toHaveBeenCalledTimes(2);
    const bad = vi.fn().mockRejectedValue({ code: "P2002" });
    await expect(retry(bad, 3, 0)).rejects.toMatchObject({ code: "P2002" }); expect(bad).toHaveBeenCalledTimes(1);
  });
  it("limits concurrent writes and waits for in-flight writes before failing", async () => {
    let active = 0, peak = 0, completed = 0;
    await expect(writeBatch([0,1,2,3,4,5], async row => {
      peak = Math.max(peak, ++active);
      await new Promise(resolve => setTimeout(resolve, 1)); active--; completed++;
      if (row === 0) throw { code: "P2002" };
    }, 3)).rejects.toThrow("P2002");
    expect(peak).toBe(3); expect(active).toBe(0); expect(completed).toBe(3);
  });
  it("exports every page and preserves commas, quotes, newlines, relationships, and UTC timestamps", async () => {
    const file = path.join(temp(), "export.csv");
    const query = vi.fn().mockResolvedValueOnce([
      { Id: "001000000000001AAA", Name: 'A, "B"\nC', Owner: { Name: "Agent" }, CreatedDate: "2026-09-24T10:00:00.000+0000" },
      { Id: "001000000000002AAA", Name: null, Owner: null, CreatedDate: null },
    ]).mockResolvedValueOnce([{ Id: "001000000000003AAA", Name: "Last" }]);
    expect(await incrementalCsv("SELECT Id,Name,Owner.Name,CreatedDate FROM Account WHERE IsDeleted = false", file, query, 2)).toBe(3);
    expect(query.mock.calls[1][0]).toContain("Id > '001000000000002AAA'");
    expect(fs.readFileSync(file, "utf8")).toContain('"A, ""B""\nC",Agent,2026-09-24T10:00:00.000+0000');
    expect(fs.readFileSync(file, "utf8")).toContain("001000000000003AAA,Last,,");
  });
  it("never exposes a partial export as a complete CSV", async () => {
    const file = path.join(temp(), "export.csv"); fs.writeFileSync(file, "previous");
    await expect(incrementalCsv("SELECT Id FROM Account", file, vi.fn().mockRejectedValue(new Error("failed")))).rejects.toThrow();
    expect(fs.readFileSync(file, "utf8")).toBe("previous");
    expect(fs.readdirSync(path.dirname(file))).toEqual(["export.csv"]);
  });
  it("keeps an existing OR filter within the checkpoint window", () => {
    expect(addPredicate("SELECT Id FROM Account WHERE A = 1 OR B = 2", "LastModifiedDate >= x")).toBe("SELECT Id FROM Account WHERE (LastModifiedDate >= x) AND (A = 1 OR B = 2)");
  });
  it("excludes source rows without a required parent without hiding unresolved populated references", () => {
    expect(requireSourceParent("opportunity", "SELECT Id,AccountId FROM Opportunity")).toBe("SELECT Id,AccountId FROM Opportunity WHERE AccountId != null");
    expect(requireSourceParent("fee", "SELECT Id FROM Fee__c")).toContain("Program_Plan__c != null");
    expect(requireSourceParent("contact", "SELECT Id FROM Contact")).toBe("SELECT Id FROM Contact");
  });
  it("retains the last successful checkpoint after repeated failures", async () => {
    const stateDir = temp(), saved = { completedThrough: "2026-09-12T02:00:00.000Z", completedAt: "2026-09-12T02:01:00.000Z" };
    const file = path.join(stateDir, "account.json"); fs.writeFileSync(file, JSON.stringify(saved));
    const execute = vi.fn().mockResolvedValue(1);
    expect(await checkpointedEntity("account", { stateDir, now: new Date("2026-09-24T12:00Z"), log: () => {}, execute })).toBe(1);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls[0][0]).toMatchObject({ SF_SINCE: "2026-09-12T01:55:00.000Z", SF_UNTIL: "2026-09-24T12:00:00.000Z" });
    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual(saved);
  });
  it("advances only after success and resumes from the start of the successful run", async () => {
    const stateDir = temp(), now = new Date("2026-09-24T12:00Z");
    const execute = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    expect(await checkpointedEntity("opportunity", { stateDir, since: "2026-09-01T00:00Z", now, log: () => {}, execute })).toBe(0);
    const checkpoint = JSON.parse(fs.readFileSync(path.join(stateDir, "opportunity.json"), "utf8"));
    expect(checkpoint.completedThrough).toBe(now.toISOString());
    expect(nextWindow(checkpoint, new Date("2026-09-25T12:00Z")).since).toBe("2026-09-24T11:55:00.000Z");
  });
});
