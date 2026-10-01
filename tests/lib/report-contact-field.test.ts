import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/analytics-access", () => ({ analyticsAccess: vi.fn(), analyticsScope: () => ({}), redactAnalyticsRelations: async (rows: unknown[]) => rows }));
import { runReportWithAccess } from "@/lib/reports/runner";
import { OBJECT_METADATA } from "@/lib/reports/object-metadata";
import type { Prisma } from "@/generated/prisma/client";

describe("report contact field compatibility", () => {
  it("runs the existing VLP contact column and saved filters using Contact.fullName", async () => {
    const findMany = vi.fn(async ({ select }) => {
      expect(select.primaryContact).toEqual({ select: { id: true, fullName: true } });
      return [
        { id: "1", name: "VLP client", primaryContact: { id: "c1", fullName: "Alex Client" }, sfDataJson: JSON.stringify({ Legal_Network__c: "Victory Legal Plan", First_Contract_Signed_Date__c: "2026-06-01" }) },
        { id: "2", name: "Other network", primaryContact: { id: "c2", fullName: "Other Client" }, sfDataJson: JSON.stringify({ Legal_Network__c: "Citadel", First_Contract_Signed_Date__c: "2026-06-01" }) },
      ];
    });
    const result = await runReportWithAccess({
      objectType: "Account", columns: ["name", "primaryContact.name"],
      filters: [{ field: "sfDataJson.Legal_Network__c", operator: "equals", value: "Victory Legal Plan" }, { field: "sfDataJson.First_Contract_Signed_Date__c", operator: "gte", value: "2026-05-01" }],
      sortBy: "primaryContact.name", groupBy: "primaryContact.name",
    }, { userId: "admin", isAdmin: true, permissions: [], ownerIds: [] }, { account: { findMany } } as unknown as Prisma.TransactionClient);
    expect(result).toMatchObject({ rowCount: 1, rows: [{ name: "VLP client", "primaryContact.name": "Alex Client" }], groups: [{ key: "Alex Client" }] });
  });
  it("keeps every report database path aligned with the Prisma schema", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const models = new Map([...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].map(match => [match[1], new Map([...match[2].matchAll(/^\s+(\w+)\s+([\w]+)([?\[\]]*)/gm)].map(field => [field[1], field[2]]))]));
    for (const meta of Object.values(OBJECT_METADATA)) for (const field of meta.fields) {
      if (field.source === "computed") continue;
      let model = [...models.keys()].find(name => name.toLowerCase() === meta.prismaModel.toLowerCase())!;
      const path = field.source === "json" ? field.jsonColumn! : field.dataPath ?? field.key;
      for (const part of path.split(".")) {
        const next = models.get(model)?.get(part);
        expect(next, `${meta.prismaModel}.${field.key}: unknown ${model}.${part}`).toBeDefined();
        model = next!;
      }
    }
  });
});
