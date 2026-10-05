import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { applyLeadRouting } from "@/lib/automation/lead-routing";
import { ownedRecordScope } from "@/lib/owned-record-scope";

const m = vi.hoisted(() => ({ auth: vi.fn(), create: vi.fn(), findOwner: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/record-access", () => ({ recordScope: vi.fn() }));
vi.mock("@/lib/triggers/runner", () => ({
  makeCtx: (userId: string, skip: string[] = []) => ({ userId, skip: new Set(skip), prisma: { user: { findFirst: m.findOwner } } }),
  triggerCreateArgs: m.create,
}));
import { POST } from "@/app/api/leads/route";

const post = (extra: Record<string, unknown> = {}) => POST(new NextRequest("http://localhost/api/leads", {
  method: "POST",
  body: JSON.stringify({ businessName: "Test Business", contactName: "Test Contact", phone: "5550100", ...extra }),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  m.auth.mockResolvedValue({ user: { id: "eli.s", role: "SALES_REP" } });
  m.findOwner.mockResolvedValue({ id: "inbound-owner" });
  m.create.mockImplementation(async (_entity, args, ctx) => {
    await applyLeadRouting(args.data, undefined, ctx);
    return { id: "new-lead", ...args.data };
  });
});

it.each(["OTHER", "Web", "WEBSITE", "COLD_CALL"])("keeps a manually saved %s lead accessible to its creator", async source => {
  const response = await post({ source });
  expect(response.status).toBe(201);
  const lead = await response.json();
  const scope = ownedRecordScope("lead", ["eli.s"]) as { assignedToId: { in: string[] } };
  expect(scope.assignedToId.in).toContain(lead.assignedToId);
  expect(lead.leadAssignmentDate).toBeTruthy();
  expect(m.findOwner).not.toHaveBeenCalled();
});

it("defaults an empty owner to the creator", async () => {
  expect((await (await post({ assignedToId: "" })).json()).assignedToId).toBe("eli.s");
});

it("preserves an explicitly selected owner", async () => {
  expect((await (await post({ source: "Web", assignedToId: "selected-owner" })).json()).assignedToId).toBe("selected-owner");
});

it("does not create a lead without authentication", async () => {
  m.auth.mockResolvedValue(null);
  expect((await post()).status).toBe(401);
  expect(m.create).not.toHaveBeenCalled();
});

it("does not create an invalid lead", async () => {
  expect((await post({ businessName: "" })).status).toBe(400);
  expect(m.create).not.toHaveBeenCalled();
});
