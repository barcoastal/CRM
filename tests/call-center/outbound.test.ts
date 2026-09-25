import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => {
  const delegate = () => ({
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
  });
  const db = {
    voiceCall: delegate(),
    voiceAgent: delegate(),
    voiceParticipant: delegate(),
    voiceEvent: delegate(),
    voiceWebLead: delegate(),
    voiceOutboundSettings: delegate(),
    voiceDialingCampaign: delegate(),
    voiceDialerLease: delegate(),
    campaign: delegate(),
    campaignContact: delegate(),
    lead: delegate(),
    user: delegate(),
    call: delegate(),
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  };
  return {
    db,
    update: vi.fn(),
    create: vi.fn(),
    finish: vi.fn(),
    suppressed: vi.fn(),
    window: vi.fn(),
    scope: vi.fn(),
    permissions: vi.fn(),
  };
});
vi.mock("@/lib/prisma", () => ({ prisma: m.db }));
vi.mock("@/lib/permissions", () => ({
  hasPermission: (permissions: string[], key: string) =>
    permissions.includes(key),
  loadEffectivePermissions: m.permissions,
}));
vi.mock("@/lib/dnc", () => ({ isSuppressed: m.suppressed }));
vi.mock("@/lib/ai-dialer/compliance", () => ({
  isWithinCallingWindow: m.window,
}));
vi.mock("@/lib/call-center/service", () => ({
  finishCall: m.finish,
  freshSince: () => new Date(Date.now() - 45000),
  superviseScope: m.scope,
  VoiceError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
  routeInbound: vi.fn(),
  endConference: vi.fn(),
}));
vi.mock("@/lib/call-center/twilio", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/call-center/twilio")>();
  return {
    ...actual,
    client: () => ({
      calls: Object.assign(() => ({ update: m.update }), { create: m.create }),
    }),
  };
});
import {
  captureWebLeads,
  coldAnswer,
  coldReady,
  dispatchCold,
  dispatchWeb,
  saveColdCampaign,
  saveWebSettings,
  standbyVoice,
} from "@/lib/call-center/outbound";
import { identity } from "@/lib/call-center/model";
const sid = `CA${"a".repeat(32)}`,
  seatSid = `CA${"b".repeat(32)}`;
const lead = {
  id: "lead",
  contactName: "Test",
  phone: "+12125551234",
  status: "NEW",
  assignedToId: "u1",
  state: "NY",
  convertedAt: null,
  nextFollowUpAt: null,
  createdAt: new Date(),
};
const call = {
  id: "call",
  workflow: "COLD",
  direction: "OUTBOUND",
  status: "RINGING",
  customerDialStarted: true,
  customerSid: sid,
  agentId: null,
  campaignId: "campaign",
  leadId: "lead",
  phoneNumber: lead.phone,
  createdAt: new Date(),
  customerAnsweredAt: new Date(),
  humanDetectedAt: new Date(),
  participants: [],
};
const seat = {
  userId: "u1",
  standbySid: seatSid,
  standbyReady: true,
  activeCallId: null,
  status: "AVAILABLE",
};
const user = {
  userId: "manager",
  role: "MANAGER",
  permissions: ["Call.Log", "CallCenter.Supervise"],
  email: "manager@example.test",
  profileName: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CALL_CENTER_PUBLIC_URL", "https://example.test");
  vi.stubEnv("CALL_CENTER_COMPANY_NAME", "Example Company");
  vi.stubEnv("CALL_CENTER_CALLBACK_NUMBER", "+12125550100");
  vi.stubEnv("TWILIO_OUTBOUND_NUMBER", "+12125550100");
  for (const d of Object.values(m.db))
    if (typeof d === "object") {
      d.findMany.mockResolvedValue([]);
      d.findFirst.mockResolvedValue(null);
      d.findUnique.mockResolvedValue(null);
      d.updateMany.mockResolvedValue({ count: 1 });
      d.count.mockResolvedValue(0);
      d.update.mockResolvedValue({});
    }
  m.db.$transaction.mockImplementation(async (fn) => fn(m.db));
  m.db.voiceCall.findUnique.mockResolvedValue(call);
  m.db.voiceCall.findUniqueOrThrow.mockResolvedValue(call);
  m.db.user.findUnique.mockResolvedValue({ isActive: true });
  m.db.lead.findUnique.mockResolvedValue(lead);
  m.db.campaign.findUnique.mockResolvedValue({
    id: "campaign",
    status: "ACTIVE",
    dialerMode: "POWER",
    agents: [{ userId: "u1" }],
  });
  m.db.call.create.mockResolvedValue({ id: "log" });
  m.permissions.mockResolvedValue(new Set(["Call.Log"]));
  m.scope.mockResolvedValue(["manager", "u1"]);
  m.suppressed.mockResolvedValue(false);
  m.window.mockReturnValue(true);
  m.update.mockResolvedValue({});
});
afterEach(() => vi.unstubAllEnvs());
describe("automatic outbound authorization and ingestion", () => {
  it("restricts shared web routing to administrators", async () => {
    await expect(
      saveWebSettings(user, {
        enabled: true,
        members: ["u1"],
        ownerFirst: false,
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(m.db.voiceOutboundSettings.upsert).not.toHaveBeenCalled();
  });
  it("rejects campaigns containing agents outside the supervisor's team", async () => {
    m.scope.mockResolvedValue(["manager"]);
    await expect(
      saveColdCampaign(user, {
        campaignId: "campaign",
        running: true,
        maxLines: 10,
        lineScope: "TEAM",
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("does not replay historical leads when routing is first enabled", async () => {
    const enabledAt = new Date("2026-09-24T14:00:00Z");
    m.db.voiceOutboundSettings.findUnique.mockResolvedValue({
      webEnabled: true,
      webEnabledAt: enabledAt,
    });
    m.db.lead.findMany.mockResolvedValue([{ id: "new", createdAt: enabledAt }]);
    await captureWebLeads();
    expect(m.db.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          recordType: "WEB",
          createdAt: { gte: enabledAt },
          voiceWebLead: null,
        }),
      }),
    );
    expect(m.db.voiceWebLead.createMany).toHaveBeenCalledWith({
      data: [
        {
          leadId: "new",
          receivedAt: enabledAt,
          deadlineAt: new Date("2026-09-24T14:01:00Z"),
        },
      ],
      skipDuplicates: true,
    });
  });
  it("cannot attach a browser to someone else's standby token", async () => {
    m.db.voiceAgent.updateMany.mockResolvedValue({ count: 0 });
    expect(
      await standbyVoice(
        {
          From: `client:${identity("u1")}`,
          CallSid: sid,
          OutboundSeat: "foreign",
        },
        new URLSearchParams(),
        true,
      ),
    ).toContain("<Hangup/>");
    expect(m.db.voiceAgent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "u1", standbyKey: "foreign" }),
      }),
    );
  });
});
describe("priority web dispatch", () => {
  beforeEach(() => {
    m.db.voiceOutboundSettings.findUnique.mockResolvedValue({
      webEnabled: true,
      webMemberIds: ["u1"],
      ownerFirst: false,
    });
    m.db.voiceWebLead.findMany.mockResolvedValue([
      { leadId: "lead", lead, receivedAt: lead.createdAt, status: "WAITING" },
    ]);
    m.db.voiceWebLead.findUnique.mockResolvedValue({ status: "WAITING" });
    m.db.voiceAgent.findMany.mockResolvedValue([seat]);
  });
  it("blocks DNC before claiming an agent or creating a call", async () => {
    m.suppressed.mockResolvedValue(true);
    expect(await dispatchWeb()).toBe(false);
    expect(m.db.voiceCall.create).not.toHaveBeenCalled();
    expect(m.db.voiceWebLead.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SKIPPED",
          reason: "Do Not Call",
        }),
      }),
    );
  });
  it("keeps an eligible lead pending when no audio seat is ready", async () => {
    m.db.voiceAgent.findMany.mockResolvedValue([]);
    expect(await dispatchWeb()).toBe(false);
    expect(m.db.voiceCall.create).not.toHaveBeenCalled();
    expect(m.db.voiceWebLead.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { reason: "Waiting for an agent with connected audio" },
      }),
    );
  });
  it("reserves a shared agent, assigns the lead and connects audio before dialing", async () => {
    expect(await dispatchWeb()).toBe(true);
    expect(m.db.voiceCall.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ workflow: "WEB", agentId: "u1" }),
      }),
    );
    expect(m.db.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assignedToId: "u1" }),
      }),
    );
    expect(m.update).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining("/webhook/join?"),
      }),
    );
    expect(m.create).not.toHaveBeenCalled();
  });
  it("recognizes a manual first attempt without making another call", async () => {
    m.db.voiceCall.findFirst.mockResolvedValue({
      attemptStartedAt: new Date(),
    });
    await dispatchWeb();
    expect(m.db.voiceCall.create).not.toHaveBeenCalled();
    expect(m.db.voiceWebLead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DIALED" }),
      }),
    );
  });
});
describe("cold answered-call handoff", () => {
  it("screens voicemail without reserving an agent", async () => {
    expect(
      await coldAnswer({ CallSid: sid, AnsweredBy: "machine_start" }, "call"),
    ).toContain("<Hangup/>");
    expect(m.db.voiceAgent.updateMany).not.toHaveBeenCalled();
    expect(m.finish).toHaveBeenCalledWith("call", "COMPLETED");
  });
  it("rejects a webhook for a different customer leg", async () => {
    expect(
      await coldAnswer({ CallSid: seatSid, AnsweredBy: "human" }, "call"),
    ).toContain("<Hangup/>");
    expect(m.db.voiceAgent.findMany).not.toHaveBeenCalled();
  });
  it("records overflow and pauses the campaign when no agent is ready", async () => {
    const xml = await coldAnswer({ CallSid: sid, AnsweredBy: "human" }, "call");
    expect(xml).toContain("Example Company");
    expect(xml).toContain("<Hangup/>");
    expect(m.finish).toHaveBeenCalledWith("call", "ABANDONED");
    expect(m.db.voiceDialingCampaign.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PAUSED" }),
      }),
    );
  });
  it("uses an atomic ready-seat claim for two competing answers", async () => {
    m.db.voiceAgent.findMany.mockResolvedValue([seat]);
    m.db.voiceAgent.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    await coldAnswer({ CallSid: sid, AnsweredBy: "human" }, "call");
    await coldAnswer({ CallSid: sid, AnsweredBy: "human" }, "call");
    expect(m.db.call.create).toHaveBeenCalledTimes(1);
    expect(m.db.voiceAgent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          activeCallId: null,
          standbyReady: true,
          standbySid: seatSid,
          status: "AVAILABLE",
        }),
      }),
    );
  });
  it("does not wait indefinitely when agent audio fails to join", async () => {
    m.db.voiceCall.findUnique.mockResolvedValue({
      ...call,
      humanDetectedAt: new Date(Date.now() - 2500),
    });
    expect(await coldReady({ CallSid: sid }, "call")).toContain(
      "Example Company",
    );
    expect(m.finish).toHaveBeenCalledWith("call", "ABANDONED");
  });
  it("bridges only after the assigned agent actually joins", async () => {
    m.db.voiceCall.findUnique.mockResolvedValue({
      ...call,
      agentId: "u1",
      conferenceSid: "CFtest",
      participants: [{ userId: "u1", joinedAt: new Date(), endedAt: null }],
    });
    expect(await coldReady({ CallSid: sid }, "call")).toContain("<Conference");
    expect(m.finish).not.toHaveBeenCalled();
  });
  it("does not consume cold capacity when a web lead is eligible", async () => {
    m.db.voiceDialingCampaign.findMany.mockResolvedValue([
      { campaignId: "campaign", campaign: { agents: [{ userId: "u1" }] } },
    ]);
    m.db.voiceAgent.findMany.mockResolvedValue([seat]);
    m.db.voiceOutboundSettings.findUnique.mockResolvedValue({
      webEnabled: true,
      webMemberIds: ["u1"],
    });
    m.db.voiceWebLead.findMany.mockResolvedValue([{ lead }]);
    expect(await dispatchCold()).toBe(false);
    expect(m.db.campaignContact.findMany).not.toHaveBeenCalled();
    expect(m.create).not.toHaveBeenCalled();
  });
  it("creates a customer-first cold call with detection and status callbacks", async () => {
    const config = {
      campaignId: "campaign",
      status: "RUNNING",
      maxLines: 10,
      lineScope: "TEAM",
      campaign: {
        timezone: "America/New_York",
        startTime: "08:00",
        endTime: "20:00",
        agents: [{ userId: "u1" }],
      },
    };
    m.db.voiceDialingCampaign.findMany.mockResolvedValue([config]);
    m.db.voiceDialingCampaign.findUnique.mockResolvedValue(config);
    m.db.voiceAgent.findMany.mockResolvedValue([seat]);
    m.db.voiceAgent.count.mockResolvedValue(1);
    m.db.campaignContact.findMany.mockResolvedValue([
      { id: "contact", leadId: "lead", attempts: 0, lastAttempt: null, lead },
    ]);
    m.db.voiceCall.create.mockResolvedValue({
      ...call,
      customerSid: null,
      fromNumber: "+12125550100",
    });
    m.create.mockResolvedValue({ sid });
    expect(await dispatchCold()).toBe(true);
    expect(m.create).toHaveBeenCalledWith(
      expect.objectContaining({
        to: lead.phone,
        machineDetection: "Enable",
        timeout: 30,
        url: expect.stringContaining("cold-answer"),
        statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      }),
    );
    expect(m.db.voiceAgent.updateMany).not.toHaveBeenCalled();
    expect(m.db.voiceCall.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workflow: "COLD",
          customerDialStarted: true,
        }),
      }),
    );
  });
});
