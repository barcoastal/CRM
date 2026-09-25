import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => {
  const delegate = () => ({
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    deleteMany: vi.fn(),
  });
  return {
    db: {
      user: delegate(),
      voiceAgent: delegate(),
      voiceCall: delegate(),
      lead: delegate(),
      leadDebt: delegate(),
      notification: delegate(),
      voiceEvent: delegate(),
      closerHandoff: delegate(),
      closerTierConfig: delegate(),
      $transaction: vi.fn(),
      $queryRaw: vi.fn(),
    },
    owned: vi.fn(),
    transfer: vi.fn(),
    permissions: vi.fn(),
    scope: vi.fn(),
  };
});
vi.mock("@/lib/prisma", () => ({ prisma: mocks.db }));
vi.mock("@/lib/record-access", () => ({
  teamOwnerIds: () => ["manager", "opener"],
}));
vi.mock("@/lib/lead-debt-rollup", () => ({ recalcLeadWeeklyPayment: vi.fn() }));
vi.mock("@/lib/permissions", () => ({
  loadEffectivePermissions: mocks.permissions,
  hasPermission: (p: string[], name: string) => p.includes(name),
}));
vi.mock("@/lib/call-center/service", () => ({
  ownedCall: mocks.owned,
  superviseScope: mocks.scope,
  transfer: mocks.transfer,
  freshSince: () => new Date(Date.now() - 45000),
  VoiceError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
}));
import {
  qualifyCall,
  setCloserOpen,
  transferQualified,
  validateCloserTransfer,
  salesOverview,
  requestTransfer,
  reviewTransfer,
  closerReady,
  cancelTransferRequest,
} from "@/lib/call-center/sales";
import type { Prisma } from "@/generated/prisma/client";
const tx = mocks.db as unknown as Prisma.TransactionClient;
const session = {
  userId: "opener",
  role: "AGENT",
  permissions: ["Call.Log"],
  email: "opener@example.test",
  profileName: null,
};
const call = {
  id: "v1",
  agentId: "opener",
  leadId: "lead",
  status: "IN_PROGRESS",
  qualifiedAt: new Date(),
  qualifiedDebt: 80000,
  openerId: "opener",
  closerHandoffId: null,
  salesStage: "CLOSER_READY",
  transferRequestKey: "request-1",
  transferReviewedAt: new Date(),
  transferReadyAt: new Date(),
  transferTargetId: "closer",
  qualifiedDebts: [
    { key: "a", id: "debt-a", creditorName: "Bank A", amount: 80000 },
  ],
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.db.$transaction.mockImplementation((fn) => fn(mocks.db));
  mocks.owned.mockResolvedValue(call);
  mocks.db.voiceCall.findUniqueOrThrow.mockResolvedValue(call);
  mocks.db.user.findUniqueOrThrow.mockResolvedValue({
    isCloser: false,
    closerTier: null,
  });
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
    closerOpen: true,
    status: "RESERVED",
    activeCallId: "v1",
    heartbeatAt: new Date(),
  });
  mocks.db.voiceAgent.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.voiceAgent.findMany.mockResolvedValue([{ userId: "closer" }]);
  mocks.permissions.mockResolvedValue(new Set(["Call.Log"]));
  mocks.scope.mockResolvedValue(["manager", "opener"]);
  mocks.db.leadDebt.create.mockImplementation(async ({ data }) => ({
    ...data,
    id: "new-debt",
  }));
  mocks.db.leadDebt.findFirst.mockResolvedValue({
    id: "debt-a",
    status: "ACTIVE",
  });
  mocks.db.leadDebt.count.mockResolvedValue(0);
  mocks.db.voiceCall.findMany.mockResolvedValue([]);
});
describe("Floor Manager debt routing and closer availability", () => {
  it.each([
    [79999, 3],
    [80000, 2],
    [219999, 2],
    [220000, 1],
  ])(
    "routes debt %i using the saved Floor Manager thresholds to tier %i",
    async (debt, tier) => {
      mocks.db.voiceCall.findUniqueOrThrow.mockResolvedValue({
        ...call,
        qualifiedDebt: debt,
      });
      mocks.db.user.findUnique.mockResolvedValue({
        isActive: true,
        isCloser: true,
        closerTier: tier,
      });
      expect(await validateCloserTransfer(tx, "v1", "closer")).toBe(true);
    },
  );
  it("rejects a closer in the wrong debt tier", async () => {
    mocks.db.user.findUnique.mockResolvedValue({
      isActive: true,
      isCloser: true,
      closerTier: 1,
    });
    await expect(validateCloserTransfer(tx, "v1", "closer")).rejects.toThrow(
      "Tier 2",
    );
  });
  it.each([
    { closerOpen: false },
    { status: "BUSY" },
    { activeCallId: "other-call" },
    { heartbeatAt: new Date(0) },
  ])(
    "does not transfer to a closed, busy, reserved or stale closer: %j",
    async (override) => {
      mocks.db.voiceAgent.findUnique.mockResolvedValue({
        closerOpen: true,
        status: "RESERVED",
        activeCallId: "v1",
        heartbeatAt: new Date(),
        ...override,
      });
      await expect(
        validateCloserTransfer(tx, "v1", "closer"),
      ).rejects.toMatchObject({ status: 409 });
    },
  );
  it("requires saved opener qualification even for generic transfer controls", async () => {
    mocks.db.voiceCall.findUniqueOrThrow.mockResolvedValue({
      ...call,
      qualifiedAt: null,
    });
    await expect(validateCloserTransfer(tx, "v1", "closer")).rejects.toThrow(
      "qualification",
    );
  });
  it("requires manager approval and the assigned closer readiness before connecting", async () => {
    mocks.owned.mockResolvedValue({ ...call, salesStage: "PENDING_APPROVAL" });
    await expect(transferQualified(session, "v1")).rejects.toMatchObject({
      status: 409,
    });
    expect(mocks.transfer).not.toHaveBeenCalled();
  });
  it("rejects a different target even when another closer is free", async () => {
    await expect(
      transferQualified(session, "v1", "other"),
    ).rejects.toMatchObject({ status: 409 });
    expect(mocks.transfer).not.toHaveBeenCalled();
  });
  it("rejects a closer whose calling permission was revoked", async () => {
    mocks.permissions.mockResolvedValue(new Set());
    await expect(transferQualified(session, "v1")).rejects.toMatchObject({
      status: 403,
    });
    expect(mocks.transfer).not.toHaveBeenCalled();
  });
  it("starts a warm transfer with an eligible closer without creating a handoff early", async () => {
    await transferQualified(session, "v1");
    expect(mocks.transfer).toHaveBeenCalledWith(session, "v1", "closer");
    expect(mocks.db.closerHandoff.create).not.toHaveBeenCalled();
  });
  it("closing availability does not interrupt or release an active call", async () => {
    mocks.db.user.findUniqueOrThrow.mockResolvedValue({
      isCloser: true,
      closerTier: 2,
    });
    await setCloserOpen(session, false);
    expect(mocks.db.voiceAgent.updateMany).toHaveBeenCalledWith({
      where: { userId: "opener" },
      data: { closerOpen: false },
    });
    expect(mocks.db.voiceAgent.updateMany).toHaveBeenCalledWith({
      where: { userId: "opener", activeCallId: null },
      data: { status: "PAUSED" },
    });
    expect(mocks.db.voiceCall.update).not.toHaveBeenCalled();
  });
  it("an opener cannot switch their role by opening closer availability", async () => {
    await expect(setCloserOpen(session, true)).rejects.toMatchObject({
      status: 403,
    });
    expect(mocks.db.voiceAgent.updateMany).not.toHaveBeenCalled();
  });
});
const details = {
  id: "v1",
  debts: [{ key: "a", id: "debt-a", creditorName: "Bank A", amount: 120000 }],
  notes: "  Business owner confirmed obligations  ",
};
describe("opener qualification", () => {
  it("stores each lender and calculates the confirmed total on the lead and call", async () => {
    mocks.db.voiceCall.findUniqueOrThrow.mockResolvedValue({
      ...call,
      salesStage: "QUALIFIED",
    });
    await qualifyCall(session, details);
    expect(mocks.db.leadDebt.update).toHaveBeenCalledWith({
      where: { id: "debt-a" },
      data: { creditorName: "Bank A", amount: 120000 },
    });
    expect(mocks.db.voiceCall.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          qualifiedDebt: 120000,
          qualificationNotes: "Business owner confirmed obligations",
          qualifiedDebts: details.debts,
        }),
      }),
    );
    expect(mocks.db.lead.update).toHaveBeenCalledWith({
      where: { id: "lead" },
      data: { totalDebtEst: 120000, numberOfLenders: 1, status: "QUALIFIED" },
    });
  });
  it.each([
    { debts: [] },
    { debts: [{ key: "a", creditorName: "", amount: 50 }] },
    { debts: [{ key: "a", creditorName: "Bank A", amount: -1 }] },
    { notes: " " },
  ])("requires complete lender details: %j", async (override) => {
    await expect(
      qualifyCall(session, { ...details, ...override }),
    ).rejects.toThrow("Enter each lender");
    expect(mocks.db.lead.update).not.toHaveBeenCalled();
  });
  it.each([
    "PENDING_APPROVAL",
    "PENDING_CLOSER",
    "CLOSER_READY",
    "TRANSFER_PENDING",
  ])("locks reviewed qualification during %s", async (salesStage) => {
    mocks.db.voiceCall.findUniqueOrThrow.mockResolvedValue({
      ...call,
      salesStage,
    });
    await expect(qualifyCall(session, details)).rejects.toMatchObject({
      status: 409,
    });
    expect(mocks.db.lead.update).not.toHaveBeenCalled();
  });
  it("refuses another lead's lender ID", async () => {
    mocks.db.voiceCall.findUniqueOrThrow.mockResolvedValue({
      ...call,
      salesStage: "QUALIFIED",
    });
    mocks.db.leadDebt.findFirst.mockResolvedValue(null);
    await expect(qualifyCall(session, details)).rejects.toMatchObject({
      status: 409,
    });
    expect(mocks.db.leadDebt.update).not.toHaveBeenCalled();
  });
  it("reuses a previously saved new row by its stable key", async () => {
    mocks.db.voiceCall.findUniqueOrThrow.mockResolvedValue({
      ...call,
      salesStage: "QUALIFIED",
    });
    await qualifyCall(session, {
      ...details,
      debts: [{ key: "a", creditorName: "Bank A", amount: 120000 }],
    });
    expect(mocks.db.leadDebt.create).not.toHaveBeenCalled();
    expect(mocks.db.leadDebt.update).toHaveBeenCalledOnce();
  });
  it("shares colleague availability while hiding their call IDs from other agents", async () => {
    mocks.db.user.findMany.mockResolvedValue([
      {
        id: "outside-team",
        name: "Closer",
        isCloser: true,
        closerTier: 2,
        voiceAgent: {
          status: "BUSY",
          activeCallId: "private-call",
          closerOpen: true,
          heartbeatAt: new Date(),
        },
      },
    ]);
    mocks.db.closerHandoff.findMany.mockResolvedValue([]);
    const overview = await salesOverview(session, ["opener"], false);
    expect(overview.roster[0]).toMatchObject({
      state: "ON_CALL",
      role: "CLOSER",
      callId: null,
    });
    expect(mocks.db.closerHandoff.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ closerId: "opener" }, { fronterId: "opener" }],
          voiceCall: { isNot: null },
        },
      }),
    );
  });
});

const manager = {
  ...session,
  userId: "manager",
  permissions: ["Call.Log", "CallCenter.Supervise"],
};
describe("manager approval and closer acknowledgement", () => {
  it("notifies the Floor Manager first and never rings an agent at request time", async () => {
    mocks.db.user.findMany.mockResolvedValue([
      { id: "manager", role: "ADMIN", managerId: null },
    ]);
    mocks.db.voiceCall.findUniqueOrThrow.mockResolvedValue({
      ...call,
      salesStage: "QUALIFIED",
    });
    await requestTransfer(session, "v1");
    expect(mocks.db.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ recipientId: "manager" })],
      }),
    );
    expect(mocks.db.voiceCall.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          salesStage: "PENDING_APPROVAL",
          transferTargetId: null,
          transferReadyAt: null,
        }),
      }),
    );
    expect(mocks.transfer).not.toHaveBeenCalled();
  });
  it("rejects a duplicate request", async () => {
    mocks.db.user.findMany.mockResolvedValue([
      { id: "manager", role: "ADMIN", managerId: null },
    ]);
    await expect(requestTransfer(session, "v1")).rejects.toMatchObject({
      status: 409,
    });
    expect(mocks.db.notification.createMany).not.toHaveBeenCalled();
  });
  it("checks supervisor team scope", async () => {
    mocks.scope.mockResolvedValue(["manager"]);
    await expect(
      reviewTransfer(manager, {
        id: "v1",
        requestKey: "request-1",
        approve: true,
        target: "closer",
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.db.voiceCall.update).not.toHaveBeenCalled();
  });
  it("requires a fresh request key and pending approval", async () => {
    mocks.db.voiceCall.findUniqueOrThrow.mockResolvedValue({
      ...call,
      salesStage: "PENDING_APPROVAL",
    });
    await expect(
      reviewTransfer(manager, {
        id: "v1",
        requestKey: "stale",
        approve: true,
        target: "closer",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("approval pings only the selected matching closer, without connecting the call", async () => {
    mocks.db.voiceCall.findUniqueOrThrow.mockResolvedValue({
      ...call,
      salesStage: "PENDING_APPROVAL",
    });
    await reviewTransfer(manager, {
      id: "v1",
      requestKey: "request-1",
      approve: true,
      target: "closer",
    });
    expect(mocks.db.voiceCall.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          salesStage: "PENDING_CLOSER",
          transferTargetId: "closer",
          transferManagerId: "manager",
        }),
      }),
    );
    expect(mocks.db.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ recipientId: "closer" })],
      }),
    );
    expect(mocks.transfer).not.toHaveBeenCalled();
  });
  it("does not approve a closer from the wrong debt tier", async () => {
    mocks.db.voiceCall.findUniqueOrThrow.mockResolvedValue({
      ...call,
      salesStage: "PENDING_APPROVAL",
    });
    mocks.db.user.findUnique.mockResolvedValue({
      isActive: true,
      isCloser: true,
      closerTier: 1,
    });
    await expect(
      reviewTransfer(manager, {
        id: "v1",
        requestKey: "request-1",
        approve: true,
        target: "closer",
      }),
    ).rejects.toThrow("Tier 2");
  });
  it("declining keeps the client with the opener and records feedback", async () => {
    mocks.db.voiceCall.findUniqueOrThrow.mockResolvedValue({
      ...call,
      salesStage: "PENDING_APPROVAL",
    });
    await reviewTransfer(manager, {
      id: "v1",
      requestKey: "request-1",
      approve: false,
      reason: "Confirm another lender",
    });
    expect(mocks.db.voiceCall.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          salesStage: "TRANSFER_REJECTED",
          transferReason: "Confirm another lender",
          transferTargetId: null,
        }),
      }),
    );
    expect(mocks.transfer).not.toHaveBeenCalled();
  });
  it("only the assigned closer can mark open", async () => {
    mocks.db.voiceCall.findUniqueOrThrow.mockResolvedValue({
      ...call,
      salesStage: "PENDING_CLOSER",
    });
    await expect(
      closerReady({ ...session, userId: "stranger" }, "v1", "request-1"),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("atomically reserves the closer for this call and notifies the opener", async () => {
    mocks.db.voiceCall.findUniqueOrThrow.mockResolvedValue({
      ...call,
      salesStage: "PENDING_CLOSER",
    });
    mocks.db.user.findUniqueOrThrow.mockResolvedValue({
      isActive: true,
      isCloser: true,
      closerTier: 2,
    });
    await closerReady({ ...session, userId: "closer" }, "v1", "request-1");
    expect(mocks.db.voiceAgent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ activeCallId: null }),
        data: { activeCallId: "v1", closerOpen: true, status: "RESERVED" },
      }),
    );
    expect(mocks.db.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ recipientId: "opener" })],
      }),
    );
  });
  it("prevents two handoffs from reserving the same closer", async () => {
    mocks.db.voiceCall.findUniqueOrThrow.mockResolvedValue({
      ...call,
      salesStage: "PENDING_CLOSER",
    });
    mocks.db.user.findUniqueOrThrow.mockResolvedValue({
      isActive: true,
      isCloser: true,
      closerTier: 2,
    });
    mocks.db.voiceAgent.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      closerReady({ ...session, userId: "closer" }, "v1", "request-1"),
    ).rejects.toMatchObject({ status: 409 });
    expect(mocks.db.voiceCall.update).not.toHaveBeenCalled();
  });
  it("canceling a ready request releases only its reserved closer", async () => {
    await cancelTransferRequest(session, "v1");
    expect(mocks.db.voiceAgent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "closer", activeCallId: "v1", status: "RESERVED" },
        data: expect.objectContaining({ activeCallId: null }),
      }),
    );
    expect(mocks.db.voiceCall.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          salesStage: "QUALIFIED",
          transferRequestKey: null,
        }),
      }),
    );
  });
  it("generic transfer controls cannot bypass approval", async () => {
    mocks.db.voiceCall.findUniqueOrThrow.mockResolvedValue({
      ...call,
      transferReviewedAt: null,
    });
    await expect(
      validateCloserTransfer(tx, "v1", "closer"),
    ).rejects.toMatchObject({ status: 409 });
  });
});
