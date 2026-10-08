import { expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ create: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/triggers/runner", () => ({
  triggerCreateArgs: mocks.create,
  makeCtx: (userId: string) => ({ userId }),
}));
vi.mock("@/lib/automation/errors", () => ({ withAutomationErrors: (handler: unknown) => handler }));

import { POST } from "@/app/api/leads/route";

it("creates a Five9 lead with Brand in the CRM column and Salesforce snapshot", async () => {
  mocks.auth.mockResolvedValue({ user: { id: "bar1" } });
  mocks.create.mockResolvedValue({ id: "lead-1" });
  const response = await POST(new NextRequest("https://crm.example/api/leads", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contactName: "Alex Smith", businessName: "Alex Co", phone: "8882804331",
      source: "COLD_CALL", brand: "Coastal Debt",
    }),
  }));
  expect(response.status).toBe(201);
  const data = mocks.create.mock.calls[0][1].data;
  expect(data.brand).toBe("Coastal Debt");
  expect(JSON.parse(data.sfDataJson)).toEqual({ Brand__c: "Coastal Debt" });
});
