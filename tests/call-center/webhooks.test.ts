import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  call: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
  participant: { updateMany: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn() },
  agent: { updateMany: vi.fn(), findUnique: vi.fn() },
  log: { updateMany: vi.fn() },
  webLead: { updateMany: vi.fn() },
  end: vi.fn(),
  finish: vi.fn(),
  requeue: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    voiceCall: m.call,
    voiceParticipant: m.participant,
    voiceAgent: m.agent,
    user: m.user,
    call: m.log,
    voiceWebLead: m.webLead,
  },
}));
vi.mock("@/lib/call-center/service", () => ({
  endConference: m.end,
  finishCall: m.finish,
  requeueInbound: m.requeue,
}));
vi.mock("@/lib/call-center/outbound", () => ({ noteAbandonment: vi.fn() }));
vi.mock("@/lib/call-center/twilio", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/call-center/twilio")>();
  return { ...actual, client: () => ({ calls: () => ({ update: m.update }) }) };
});
vi.mock("@/lib/dnc", () => ({
  isSuppressed: vi.fn().mockResolvedValue(false),
}));
import {
  customerStatus,
  join,
  conferenceEvent,
} from "@/lib/call-center/webhooks";
import { identity } from "@/lib/call-center/model";
const sid = `CA${"a".repeat(32)}`,
  conference = `CF${"b".repeat(32)}`;
const call = {
  id: "v1",
  agentId: "u1",
  direction: "INBOUND",
  status: "CONNECTING",
  conferenceSid: conference,
  customerSid: sid,
  customerDialStarted: false,
  participants: [
    {
      id: "p1",
      userId: "u1",
      role: "AGENT",
      callSid: null,
      endedAt: null,
      joinedAt: null,
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CALL_CENTER_PUBLIC_URL", "https://example.test");
  m.call.findUnique.mockResolvedValue(call);
  m.call.findUniqueOrThrow.mockResolvedValue(call);
  m.call.updateMany.mockResolvedValue({ count: 1 });
  m.participant.updateMany.mockResolvedValue({ count: 1 });
  m.user.findUnique.mockResolvedValue({ isActive: true });
  m.update.mockResolvedValue({});
});
afterEach(() => vi.unstubAllEnvs());
describe("provider event handling", () => {
  it("records web first-attempt timing from the signed provider timestamp", async () => {
    const createdAt = new Date(Date.now() - 30000),
      timestamp = new Date(Date.now() - 25000);
    m.call.findUnique.mockResolvedValue({
      ...call,
      direction: "OUTBOUND",
      workflow: "WEB",
      createdAt,
    });
    await customerStatus(
      {
        CallSid: sid,
        CallStatus: "initiated",
        Timestamp: timestamp.toISOString(),
      },
      "v1",
    );
    expect(m.webLead.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "DIALED", attemptedAt: timestamp, reason: null },
      }),
    );
  });
  it("handles an initiation callback arriving after terminal status without losing SLA evidence", async () => {
    const createdAt = new Date(Date.now() - 30000),
      timestamp = new Date(Date.now() - 25000);
    m.call.findUnique.mockResolvedValue({
      ...call,
      direction: "OUTBOUND",
      workflow: "WEB",
      status: "FAILED",
      createdAt,
    });
    await customerStatus(
      {
        CallSid: sid,
        CallStatus: "initiated",
        Timestamp: timestamp.toISOString(),
      },
      "v1",
    );
    expect(m.webLead.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ attemptedAt: timestamp }),
      }),
    );
    expect(m.update).toHaveBeenCalledWith({ status: "completed" });
    expect(
      m.call.updateMany.mock.calls.some(
        ([args]) => args.data.status === "CONNECTING",
      ),
    ).toBe(false);
  });
  it("does not report a cold-call pickup as an agent conversation before the bridge", async () => {
    m.call.findUnique.mockResolvedValue({
      ...call,
      direction: "OUTBOUND",
      workflow: "COLD",
      createdAt: new Date(),
    });
    await customerStatus({ CallSid: sid, CallStatus: "in-progress" }, "v1");
    expect(
      m.call.updateMany.mock.calls.some(
        ([args]) => args.data.status === "IN_PROGRESS",
      ),
    ).toBe(false);
    expect(
      m.call.updateMany.mock.calls.some(
        ([args]) => args.data.customerAnsweredAt instanceof Date,
      ),
    ).toBe(true);
  });
  it("does not confuse an inbound customer in a waiting room with an answered agent", async () => {
    await customerStatus({ CallSid: sid, CallStatus: "in-progress" }, "v1");
    expect(
      m.call.updateMany.mock.calls.some(
        ([args]) => args.data.status === "IN_PROGRESS",
      ),
    ).toBe(false);
  });
  it("rejects status events for an unrelated call leg", async () => {
    await customerStatus(
      { CallSid: "CAforeign", CallStatus: "completed" },
      "v1",
    );
    expect(m.end).not.toHaveBeenCalled();
    expect(m.call.updateMany).not.toHaveBeenCalled();
  });
  it("rejects conference events replayed against another conference", async () => {
    await conferenceEvent(
      {
        ConferenceSid: conference,
        FriendlyName: "crm_other",
        StatusCallbackEvent: "conference-end",
      },
      "v1",
    );
    expect(m.finish).not.toHaveBeenCalled();
  });
  it("denies a browser connection without a reserved participant", async () => {
    expect(
      await join(
        {
          From: `client:${identity("intruder")}`,
          VoiceCallId: "v1",
          CallSid: sid,
        },
        new URLSearchParams(),
        true,
      ),
    ).toContain("<Hangup/>");
    expect(m.participant.updateMany).not.toHaveBeenCalled();
  });
  it("does not accept a second browser leg for a reserved participant", async () => {
    m.call.findUnique.mockResolvedValue({
      ...call,
      participants: [{ ...call.participants[0], callSid: "CAoriginal" }],
    });
    expect(
      await join(
        { From: `client:${identity("u1")}`, VoiceCallId: "v1", CallSid: sid },
        new URLSearchParams(),
        true,
      ),
    ).toContain("<Hangup/>");
  });
  it("does not allow client parameters to upgrade an agent into a supervisor", async () => {
    const xml = await join(
      {
        From: `client:${identity("u1")}`,
        VoiceCallId: "v1",
        CallSid: sid,
        role: "MONITOR",
        mode: "WHISPER",
      },
      new URLSearchParams(),
      true,
    );
    expect(xml).toContain("<Conference");
    expect(xml).not.toContain("coach=");
    expect(xml).toContain('muted="false"');
  });
  it("prevents new audio from joining an ended call", async () => {
    m.call.findUnique.mockResolvedValue({ ...call, status: "COMPLETED" });
    expect(
      await join(
        { From: `client:${identity("u1")}`, VoiceCallId: "v1", CallSid: sid },
        new URLSearchParams(),
        true,
      ),
    ).toContain("<Hangup/>");
  });
  it("does not hang up the customer when the original agent leaves after a handoff", async () => {
    m.call.findUnique.mockResolvedValue({
      ...call,
      status: "IN_PROGRESS",
      participants: [{ ...call.participants[0], callSid: "CAagent" }],
    });
    m.call.findUniqueOrThrow.mockResolvedValue({
      ...call,
      status: "IN_PROGRESS",
      agentId: "u2",
    });
    await conferenceEvent(
      {
        ConferenceSid: conference,
        FriendlyName: "crm_v1",
        StatusCallbackEvent: "participant-leave",
        CallSid: "CAagent",
      },
      "v1",
    );
    expect(m.end).not.toHaveBeenCalled();
    expect(m.agent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1", activeCallId: "v1" } }),
    );
  });
});

it("keeps the customer and closer connected when the transferred opener leaves", async () => {
  const transferred = {
    ...call,
    status: "IN_PROGRESS",
    agentId: "closer",
    participants: [
      {
        id: "old-opener",
        userId: "opener",
        role: "TRANSFERRED",
        callSid: "CAopener",
        joinedAt: new Date(),
        endedAt: null,
      },
    ],
  };
  m.call.findUnique.mockResolvedValue(transferred);
  m.call.findUniqueOrThrow.mockResolvedValue(transferred);
  await conferenceEvent(
    {
      FriendlyName: "crm_v1",
      ConferenceSid: conference,
      StatusCallbackEvent: "participant-leave",
      CallSid: "CAopener",
    },
    "v1",
  );
  expect(m.end).not.toHaveBeenCalled();
  expect(m.agent.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { userId: "opener", activeCallId: "v1" },
    }),
  );
});
