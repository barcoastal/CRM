import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => {
  const delegate = () => ({
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
  });
  const db = {
    voiceAgent: delegate(),
    voiceCall: delegate(),
    voiceParticipant: delegate(),
    voiceEvent: delegate(),
    campaignContact: delegate(),
    campaign: delegate(),
    call: delegate(),
    lead: delegate(),
    user: delegate(),
    suppressionEntry: delegate(),
    voiceQueue: delegate(),
    closerTierConfig: delegate(),
    closerHandoff: delegate(),
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  };
  return { db, suppressed: vi.fn(), access: vi.fn(), providerUpdate: vi.fn() };
});
vi.mock("@/lib/permissions", () => ({
  loadEffectivePermissions: vi.fn().mockResolvedValue(new Set(["Call.Log"])),
  hasPermission: (permissions: string[], permission: string) =>
    permissions.includes(permission),
}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.db }));
vi.mock("@/lib/dnc", () => ({
  isSuppressed: mocks.suppressed,
  normalizePhone: (p: string) => p.replace(/\D/g, "").slice(-10),
}));
vi.mock("@/lib/record-access", () => ({
  canAccessRecord: mocks.access,
  recordScope: vi.fn().mockResolvedValue({ assignedToId: "u1" }),
  teamOwnerIds: (id: string) => [id],
}));
vi.mock("@/lib/ai-dialer/compliance", () => ({
  isWithinCallingWindow: vi.fn().mockReturnValue(true),
}));
vi.mock("@/lib/call-center/twilio", () => ({
  requireConfigured: vi.fn(),
  configuration: () => ({ enabled: true, ready: true }),
  webhookUrl: () => "https://test.invalid",
  client: () => ({
    calls: () => ({ update: mocks.providerUpdate }),
    conferences: () => ({
      update: mocks.providerUpdate,
      participants: () => ({ update: mocks.providerUpdate }),
    }),
  }),
}));
import {
  disposition,
  ownedCall,
  prepareOutbound,
  reserveAgent,
  finishCall,
  transfer,
  completeTransfer,
  monitor,
} from "@/lib/call-center/service";
import type { Prisma } from "@/generated/prisma/client";
const user = {
  userId: "u1",
  role: "AGENT",
  permissions: ["Call.Log"],
  email: "agent@example.test",
  profileName: null,
};
const call = {
  id: "v1",
  callId: "log1",
  agentId: "u1",
  leadId: "l1",
  campaignContactId: "cc1",
  phoneNumber: "+12125551234",
  status: "COMPLETED",
  direction: "OUTBOUND",
  participants: [],
  answeredAt: new Date(),
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.$transaction.mockImplementation((fn) => fn(mocks.db));
  mocks.db.voiceCall.findUnique.mockResolvedValue(call);
  mocks.db.voiceCall.findUniqueOrThrow.mockResolvedValue(call);
  mocks.db.voiceCall.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.voiceAgent.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.voiceParticipant.count.mockResolvedValue(0);
  mocks.db.user.findUnique.mockResolvedValue({ isActive: true });
  mocks.suppressed.mockResolvedValue(false);
  mocks.access.mockResolvedValue(true);
});
describe("call ownership and atomic transitions", () => {
  it("blocks controls on another agent's call", async () => {
    await expect(
      ownedCall({ ...user, userId: "u2" }, "v1"),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("rejects a stale or already reserved agent", async () => {
    mocks.db.voiceAgent.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      reserveAgent(mocks.db as unknown as Prisma.TransactionClient, "u1", "v1"),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      mocks.db.voiceAgent.updateMany.mock.calls[0][0].where.activeCallId,
    ).toBeNull();
    expect(
      mocks.db.voiceAgent.updateMany.mock.calls[0][0].where.heartbeatAt.gte,
    ).toBeInstanceOf(Date);
  });
  it("blocks DNC calls before reserving agents or creating call records", async () => {
    mocks.suppressed.mockResolvedValue(true);
    await expect(
      prepareOutbound(user, { phone: "2125551234" }),
    ).rejects.toThrow("Do Not Call");
    expect(mocks.db.call.create).not.toHaveBeenCalled();
  });
  it("blocks inaccessible lead records", async () => {
    mocks.db.lead.findFirst.mockResolvedValue(null);
    await expect(
      prepareOutbound(user, { leadId: "foreign" }),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.db.call.create).not.toHaveBeenCalled();
  });
  it("does not let a call outcome change an ongoing call", async () => {
    mocks.db.voiceCall.findUnique.mockResolvedValue({
      ...call,
      status: "IN_PROGRESS",
    });
    await expect(disposition(user, "v1", "INTERESTED", "")).rejects.toThrow(
      "End the call",
    );
  });
  it("makes repeated dispositions harmless", async () => {
    mocks.db.voiceCall.updateMany.mockResolvedValue({ count: 0 });
    await disposition(user, "v1", "INTERESTED", "");
    expect(mocks.db.lead.update).not.toHaveBeenCalled();
    expect(mocks.db.voiceAgent.updateMany).not.toHaveBeenCalled();
  });
  it("persists DNC to both the lead and shared suppression list", async () => {
    await disposition(user, "v1", "DNC", "Please stop calling");
    expect(mocks.db.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DNC" }),
      }),
    );
    expect(mocks.db.suppressionEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { phone: "2125551234" },
        update: expect.objectContaining({ expiresAt: null }),
      }),
    );
  });
  it("requires a future callback time", async () => {
    await expect(
      disposition(user, "v1", "CALLBACK", "", "2020-01-01"),
    ).rejects.toThrow("future");
    expect(mocks.db.call.update).not.toHaveBeenCalled();
  });
  it("keeps only the owner in wrap-up and releases observers", async () => {
    await finishCall("v1");
    expect(mocks.db.voiceAgent.updateMany).toHaveBeenCalledWith({
      where: { activeCallId: "v1", userId: "u1" },
      data: { status: "WRAP_UP" },
    });
    expect(mocks.db.voiceAgent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "PAUSED", activeCallId: null },
      }),
    );
  });
  it("will not reserve a second transfer target", async () => {
    mocks.db.voiceCall.findUnique.mockResolvedValue({
      ...call,
      status: "IN_PROGRESS",
    });
    mocks.db.voiceParticipant.count.mockResolvedValue(1);
    await expect(transfer(user, "v1", "u2")).rejects.toMatchObject({
      status: 409,
    });
    expect(mocks.db.voiceAgent.updateMany).not.toHaveBeenCalled();
  });
  it("does not allow a normal agent to monitor calls", async () => {
    await expect(monitor(user, "v1", "LISTEN")).rejects.toMatchObject({
      status: 403,
    });
    expect(mocks.providerUpdate).not.toHaveBeenCalled();
  });
});

describe("qualified handoff completion", () => {
  const parts = [
    { id: "original", userId: "u1", role: "AGENT", callSid: "CAstandby" },
    {
      id: "target",
      userId: "u2",
      role: "TRANSFER",
      callSid: "CAtarget",
      joinedAt: new Date(),
      endedAt: null,
    },
  ];
  function prepare() {
    const active = {
      ...call,
      status: "IN_PROGRESS",
      conferenceSid: "CFtest",
      customerSid: "CAcustomer",
      salesStage: "TRANSFER_PENDING",
      qualifiedDebt: 120000,
      openerId: "u1",
      closerHandoffId: null,
      participants: parts,
    };
    mocks.db.voiceCall.findUnique.mockResolvedValue(active);
    mocks.db.voiceCall.findUniqueOrThrow.mockResolvedValue(active);
    mocks.db.voiceParticipant.findFirst.mockResolvedValue(parts[1]);
    mocks.db.closerTierConfig.findUnique.mockResolvedValue({
      tier1Max: 80000,
      tier2Max: 220000,
    });
    mocks.db.closerHandoff.create.mockResolvedValue({ id: "handoff" });
    mocks.db.lead.findUnique.mockResolvedValue({ contactName: "Client" });
    mocks.db.voiceAgent.findUnique.mockResolvedValue({
      standbyKey: "key",
      standbySid: "CAstandby",
    });
    return active;
  }
  it("records the handoff and lead owner, then returns the same opener audio leg to dialing", async () => {
    prepare();
    await completeTransfer(user, "v1");
    expect(mocks.db.closerHandoff.create).toHaveBeenCalledOnce();
    expect(mocks.db.closerHandoff.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fronterId: "u1",
          closerId: "u2",
          debt: 120000,
          tier: 2,
          leadId: "l1",
          status: "ASSIGNED",
        }),
      }),
    );
    expect(mocks.db.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assignedToId: "u2" }),
      }),
    );
    expect(mocks.providerUpdate).toHaveBeenCalledWith({
      url: "https://test.invalid",
      method: "POST",
    });
    expect(mocks.providerUpdate).not.toHaveBeenCalledWith({
      status: "completed",
    });
    expect(mocks.db.voiceAgent.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", activeCallId: null, standbyKey: "key" },
      data: { status: "AVAILABLE" },
    });
  });
  it("keeps the opener on the call until the closer actually joins", async () => {
    const active = prepare();
    mocks.db.voiceCall.findUnique.mockResolvedValue({
      ...active,
      participants: [parts[0], { ...parts[1], joinedAt: null }],
    });
    await expect(completeTransfer(user, "v1")).rejects.toThrow("Wait for");
    expect(mocks.db.closerHandoff.create).not.toHaveBeenCalled();
    expect(mocks.providerUpdate).not.toHaveBeenCalled();
  });
  it("atomically checks that the closer is still open while reserving the seat", async () => {
    await reserveAgent(
      mocks.db as unknown as Prisma.TransactionClient,
      "u2",
      "v1",
      true,
      true,
    );
    expect(mocks.db.voiceAgent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          closerOpen: true,
          activeCallId: null,
          status: { in: ["AVAILABLE"] },
          user: { isActive: true },
        }),
      }),
    );
  });
  it("records an enrolled handoff outcome and restores availability only for an open closer or automatic opener", async () => {
    mocks.db.voiceCall.findUnique.mockResolvedValue({
      ...call,
      closerHandoffId: "handoff",
      qualifiedDebt: 120000,
    });
    await disposition(user, "v1", "ENROLLED", "Completed");
    expect(mocks.db.closerHandoff.update).toHaveBeenCalledWith({
      where: { id: "handoff" },
      data: { status: "CLOSED", closedDebt: 120000 },
    });
    expect(mocks.db.voiceAgent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          activeCallId: null,
          OR: [
            { standbyKey: { not: null } },
            {
              closerOpen: true,
              user: { isActive: true, closerTier: { not: null } },
            },
          ],
        }),
        data: { status: "AVAILABLE" },
      }),
    );
  });
});

describe("approved three-way introduction", () => {
  it("joins the approved closer without holding the client or handing ownership over early", async () => {
    const approved = {
      ...call,
      status: "IN_PROGRESS",
      conferenceSid: "CFtest",
      customerSid: "CAcustomer",
      salesStage: "CLOSER_READY",
      openerId: "u1",
      qualifiedAt: new Date(),
      qualifiedDebt: 120000,
      transferReviewedAt: new Date(),
      transferReadyAt: new Date(),
      transferTargetId: "u2",
      closerHandoffId: null,
      participants: [],
    };
    mocks.db.voiceCall.findUnique.mockResolvedValue(approved);
    mocks.db.voiceCall.findUniqueOrThrow.mockResolvedValue(approved);
    mocks.db.user.findUnique.mockResolvedValue({
      isActive: true,
      isCloser: true,
      closerTier: 2,
    });
    mocks.db.closerTierConfig.findUnique.mockResolvedValue({
      tier1Max: 80000,
      tier2Max: 220000,
    });
    mocks.db.voiceAgent.findUnique.mockResolvedValue({
      activeCallId: "v1",
      status: "RESERVED",
      closerOpen: true,
      heartbeatAt: new Date(),
      standbySid: "CAready",
      standbyReady: true,
    });
    await transfer(user, "v1", "u2");
    expect(mocks.providerUpdate).toHaveBeenCalledWith({ hold: false });
    expect(mocks.providerUpdate).not.toHaveBeenCalledWith({ hold: true });
    expect(mocks.db.voiceCall.update).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: { salesStage: "TRANSFER_PENDING" },
    });
    expect(mocks.db.closerHandoff.create).not.toHaveBeenCalled();
    expect(mocks.db.lead.update).not.toHaveBeenCalled();
  });
});
