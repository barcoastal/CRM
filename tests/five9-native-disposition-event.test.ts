import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  user: vi.fn(), priorCall: vi.fn(), upsertCall: vi.fn(), ids: vi.fn(), lead: vi.fn(), updateLead: vi.fn(), suppress: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  user: { findFirst: mocks.user }, call: { findUnique: mocks.priorCall, upsert: mocks.upsertCall },
  lead: { findUnique: mocks.lead }, $queryRaw: mocks.ids,
} }));
vi.mock("@/lib/triggers/runner", () => ({ triggerUpdate: mocks.updateLead, makeCtx: (userId: string) => ({ userId }) }));
vi.mock("@/lib/dnc", () => ({ addSuppression: mocks.suppress }));

import { POST } from "@/app/api/dialer/five9/disposition-event/route";

function event(overrides: Record<string, string> = {}) {
  return new NextRequest("https://crm.example/api/dialer/five9/disposition-event", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      token: "secret", call_id: "five9-call-1", number: "(888) 280-4331",
      disposition_name: "CALLBACK", user_name: "bar1@coastaldebt.com",
      campaign_name: "Bar1 CRM Frame Pilot", ...overrides,
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.FIVE9_DISPOSITION_TOKEN = "secret";
  process.env.FIVE9_FRAME_PILOT_EMAILS = "bar1@coastaldebt.com";
  mocks.user.mockResolvedValue({ id: "bar1" });
  mocks.priorCall.mockResolvedValue(null);
  mocks.ids.mockResolvedValue([{ id: "lead-1" }]);
  mocks.lead.mockResolvedValue({ sfDataJson: JSON.stringify({ Existing_Field__c: "keep" }) });
  mocks.upsertCall.mockResolvedValue({ id: "call-1" });
  mocks.updateLead.mockResolvedValue({ id: "lead-1" });
});

it("records Five9's exact disposition and maps supported values on the single matching lead", async () => {
  const response = await POST(event());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ updatedLead: true });
  expect(mocks.upsertCall).toHaveBeenCalledWith(expect.objectContaining({
    create: expect.objectContaining({ five9CallId: "five9-call-1", disposition: "CALLBACK", leadId: "lead-1" }),
  }));
  const [, id, patch] = mocks.updateLead.mock.calls[0];
  expect(id).toBe("lead-1");
  expect(patch.status).toBe("Working Lead");
  expect(JSON.parse(patch.sfDataJson)).toMatchObject({
    Existing_Field__c: "keep", five9_Disposition__c: "CALLBACK", Sub_Disposition__c: "Callback",
  });
});

it("keeps an unmapped Five9 disposition without guessing a CRM stage", async () => {
  await POST(event({ disposition_name: "AGENT UNAVAILABLE" }));
  const patch = mocks.updateLead.mock.calls[0][2];
  expect(patch.status).toBeUndefined();
  expect(JSON.parse(patch.sfDataJson)).toMatchObject({ five9_Disposition__c: "AGENT UNAVAILABLE" });
});

it("does not change a random lead when several share the phone", async () => {
  mocks.ids.mockResolvedValue([{ id: "lead-1" }, { id: "lead-2" }]);
  const response = await POST(event());
  expect(await response.json()).toMatchObject({ updatedLead: false, reason: "multiple_leads" });
  expect(mocks.updateLead).not.toHaveBeenCalled();
  expect(mocks.upsertCall).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ leadId: null }) }));
});

it("rejects unauthenticated events before touching any lead", async () => {
  const response = await POST(event({ token: "wrong" }));
  expect(response.status).toBe(401);
  expect(mocks.user).not.toHaveBeenCalled();
});
