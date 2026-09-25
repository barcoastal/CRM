import { hasPermission, loadEffectivePermissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { AuthedSession } from "@/lib/api-auth";
import type { Prisma } from "@/generated/prisma/client";
import {
  canAccessRecord,
  recordScope,
  teamOwnerIds,
} from "@/lib/record-access";
import { isSuppressed, normalizePhone } from "@/lib/dnc";
import { isWithinCallingWindow } from "@/lib/ai-dialer/compliance";
import {
  canSupervise,
  DISPOSITIONS,
  identity,
  isTerminal,
  phoneNumber,
  TERMINAL,
} from "./model";
import { client, configuration, requireConfigured, webhookUrl } from "./twilio";
import { lockPhone, outboundOverview } from "./outbound";
import { debtRouting, salesOverview, validateCloserTransfer } from "./sales";
import { leadProvenance } from "./qualification";
import { tierForDebt } from "@/lib/closer-tier-config";

export class VoiceError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const freshSince = () => new Date(Date.now() - 45_000);
const includeCall = {
  participants: true,
  call: {
    include: {
      lead: {
        select: {
          id: true,
          contactName: true,
          businessName: true,
          totalDebtEst: true,
          numberOfLenders: true,
          source: true,
          brand: true,
          sfId: true,
          sfDataJson: true,
          debts: {
            where: { status: { in: ["ACTIVE", "DEFAULTED", "DISPUTED"] } },
            select: { id: true, creditorName: true, amount: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  },
  queue: { select: { name: true } },
} satisfies Prisma.VoiceCallInclude;
export async function superviseScope(
  session: AuthedSession,
): Promise<string[]> {
  if (!canSupervise(session.role, session.permissions))
    throw new VoiceError("Supervisor access required", 403);
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, managerId: true },
  });
  return ["ADMIN", "SUPER_ADMIN"].includes(session.role) ||
    session.permissions.includes("Modify.AllData")
    ? users.map((u) => u.id)
    : teamOwnerIds(session.userId, users);
}
export async function overview(session: AuthedSession) {
  const setup = configuration();
  const supervisor = canSupervise(session.role, session.permissions);
  const ids = supervisor ? await superviseScope(session) : [session.userId];
  const [me, agents, queues, campaigns, users] = await Promise.all([
    prisma.voiceAgent.findUnique({ where: { userId: session.userId } }),
    prisma.voiceAgent.findMany({
      where: { userId: { in: ids } },
      include: { user: { select: { name: true } } },
    }),
    prisma.voiceQueue.findMany({
      where: supervisor
        ? {}
        : { members: { some: { userId: session.userId } } },
      include: {
        members: { select: { userId: true } },
        _count: { select: { calls: { where: { status: "WAITING" } } } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.campaign.findMany({
      where: {
        status: "ACTIVE",
        dialerMode: { not: "AI" },
        ...(supervisor
          ? { agents: { some: { userId: { in: ids } } } }
          : { agents: { some: { userId: session.userId } } }),
      },
      select: {
        id: true,
        name: true,
        script: true,
        dialerMode: true,
        _count: {
          select: {
            contacts: { where: { status: { in: ["PENDING", "IN_PROGRESS"] } } },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        ...(supervisor
          ? { id: { in: ids } }
          : {
              voiceAgent: {
                status: "AVAILABLE",
                heartbeatAt: { gte: freshSince() },
              },
            }),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const scope: Prisma.VoiceCallWhereInput = {
    OR: [
      ...(supervisor
        ? [{ workflow: "COLD", campaignId: { in: campaigns.map((c) => c.id) } }]
        : []),
      { agentId: { in: ids } },
      {
        transferTargetId: session.userId,
        status: "IN_PROGRESS",
        salesStage: {
          in: ["PENDING_CLOSER", "CLOSER_READY", "TRANSFER_PENDING"],
        },
      },
      { participants: { some: { userId: session.userId } } },
      {
        status: "WAITING",
        queue: { members: { some: { userId: session.userId } } },
      },
    ],
  };
  const recent = await prisma.voiceCall.findMany({
    where: scope,
    include: includeCall,
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  const active = await prisma.voiceCall.findMany({
    where: {
      AND: [scope],
      OR: [{ endedAt: null }, { id: me?.activeCallId || "" }],
    },
    include: includeCall,
  });
  const calls = [
    ...active,
    ...recent.filter((c) => !active.some((a) => a.id === c.id)),
  ];
  return {
    setup: {
      enabled: setup.enabled,
      ready: setup.ready,
      recording: setup.recording,
      ...(supervisor ? { missing: setup.missing } : {}),
    },
    supervisor,
    me,
    agents: agents.map((a) => ({
      userId: a.userId,
      activeCallId: a.activeCallId,
      heartbeatAt: a.heartbeatAt,
      user: a.user,
      standbyReady: a.standbyReady,
      status:
        a.heartbeatAt < freshSince() && !a.activeCallId ? "OFFLINE" : a.status,
    })),
    queues,
    calls: calls.map((voice) => {
      const lead = voice.call?.lead;
      if (!lead) return voice;
      const { sfDataJson: _snapshot, ...safe } = lead;
      void _snapshot;
      return {
        ...voice,
        call: { ...voice.call, lead: { ...safe, ...leadProvenance(lead) } },
      };
    }),
    campaigns,
    users,
    userId: session.userId,
    outbound: await outboundOverview(session, ids, supervisor),
    sales: await salesOverview(session, ids, supervisor),
  };
}
export async function reserveAgent(
  tx: Prisma.TransactionClient,
  userId: string,
  id: string,
  availableOnly = false,
  closerOnly = false,
) {
  const claimed = await tx.voiceAgent.updateMany({
    where: {
      userId,
      activeCallId: null,
      status: { in: availableOnly ? ["AVAILABLE"] : ["AVAILABLE", "PAUSED"] },
      heartbeatAt: { gte: freshSince() },
      ...(closerOnly ? { closerOpen: true, user: { isActive: true } } : {}),
    },
    data: { activeCallId: id, status: "BUSY" },
  });
  if (!claimed.count)
    throw new VoiceError(
      "Connect your phone and finish your current call before dialing.",
      409,
    );
}
export async function heartbeat(session: AuthedSession, status?: string) {
  requireConfigured();
  await prisma.voiceAgent.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId },
    update: { heartbeatAt: new Date() },
  });
  if (status)
    await prisma.voiceAgent.updateMany({
      where: { userId: session.userId, activeCallId: null },
      data: { status, heartbeatAt: new Date() },
    });
  const agent = await prisma.voiceAgent.findUniqueOrThrow({
    where: { userId: session.userId },
  });
  if (agent.status === "AVAILABLE" && !agent.activeCallId)
    if (!agent.standbyKey) await routeInbound(session.userId);
}
export async function prepareOutbound(
  session: AuthedSession,
  input: {
    phone?: string;
    leadId?: string;
    campaignId?: string;
    accountId?: string;
    opportunityId?: string;
  },
) {
  requireConfigured();
  for (const [entity, id] of [
    ["account", input.accountId],
    ["opportunity", input.opportunityId],
  ] as const)
    if (id && !(await canAccessRecord(entity, id)))
      throw new VoiceError("Record is not accessible", 403);
  const scope = await recordScope("lead");
  let contact: Awaited<ReturnType<typeof prisma.campaignContact.findFirst>> =
    null;
  let lead = input.leadId
    ? await prisma.lead.findFirst({ where: { id: input.leadId, AND: [scope] } })
    : null;
  let campaign = null;
  if (input.leadId && !lead)
    throw new VoiceError("Lead is not accessible", 403);
  if (input.campaignId) {
    campaign = await prisma.campaign.findFirst({
      where: {
        id: input.campaignId,
        status: "ACTIVE",
        dialerMode: { not: "AI" },
        ...(canSupervise(session.role, session.permissions)
          ? {}
          : { agents: { some: { userId: session.userId } } }),
      },
    });
    if (!campaign)
      throw new VoiceError("This campaign is not assigned or active", 403);
    const candidates = await prisma.campaignContact.findMany({
      where: {
        campaignId: campaign.id,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        attempts: { lt: 3 },
        OR: [
          { lastAttempt: null },
          { lastAttempt: { lt: new Date(Date.now() - 30 * 60_000) } },
        ],
        lead: {
          AND: [scope],
          status: { not: "DNC" },
          OR: [
            { nextFollowUpAt: null },
            { nextFollowUpAt: { lte: new Date() } },
          ],
        },
      },
      include: { lead: true },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: 100,
    });
    for (const candidate of candidates) {
      if (
        !isWithinCallingWindow({
          state: candidate.lead.state,
          campaignTimezone: campaign.timezone,
          startTime: campaign.startTime,
          endTime: campaign.endTime,
        })
      )
        continue;
      if (await isSuppressed(candidate.lead.phone)) continue;
      try {
        phoneNumber(candidate.lead.phone);
      } catch {
        continue;
      }
      contact = candidate;
      lead = candidate.lead;
      break;
    }
    if (!contact)
      throw new VoiceError(
        "No eligible leads are ready. Check calling hours, callbacks, and assignments.",
      );
  }
  const number = phoneNumber(lead?.phone || input.phone || "");
  if (lead?.status === "DNC" || (await isSuppressed(number)))
    throw new VoiceError("This number is on the Do Not Call list.");
  if (
    lead &&
    !isWithinCallingWindow({
      state: lead.state,
      campaignTimezone: campaign?.timezone || "America/New_York",
      startTime: campaign?.startTime || "08:00",
      endTime: campaign?.endTime || "21:00",
    })
  )
    throw new VoiceError("This lead is outside the configured calling hours.");
  return prisma.$transaction(async (tx) => {
    await lockPhone(tx, number);
    if (contact) {
      const claimed = await tx.campaignContact.updateMany({
        where: {
          id: contact.id,
          attempts: contact.attempts,
          lastAttempt: contact.lastAttempt,
        },
        data: {
          attempts: { increment: 1 },
          status: "IN_PROGRESS",
          lastAttempt: new Date(),
        },
      });
      if (!claimed.count)
        throw new VoiceError(
          "Another agent claimed this lead. Try again.",
          409,
        );
    }
    const log = await tx.call.create({
      data: {
        direction: "OUTBOUND",
        agentId: session.userId,
        leadId: lead?.id,
        campaignId: campaign?.id,
        phoneNumber: number,
      },
    });
    const call = await tx.voiceCall.create({
      data: {
        callId: log.id,
        direction: "OUTBOUND",
        phoneNumber: number,
        fromNumber: phoneNumber(process.env.TWILIO_OUTBOUND_NUMBER!),
        agentId: session.userId,
        leadId: lead?.id,
        campaignId: campaign?.id,
        campaignContactId: contact?.id,
        participants: { create: { userId: session.userId, role: "AGENT" } },
      },
    });
    await reserveAgent(tx, session.userId, call.id);
    await tx.voiceEvent.create({
      data: {
        voiceCallId: call.id,
        actorId: session.userId,
        kind: "OUTBOUND_PREPARED",
      },
    });
    return call;
  });
}
export async function ownedCall(
  session: AuthedSession,
  id: string,
  supervisorAllowed = false,
) {
  const call = await prisma.voiceCall.findUnique({
    where: { id },
    include: { participants: true },
  });
  if (!call) throw new VoiceError("Call not found", 404);
  if (
    call.agentId !== session.userId &&
    !(
      supervisorAllowed &&
      call.agentId &&
      (await superviseScope(session)).includes(call.agentId)
    )
  )
    throw new VoiceError("This call belongs to another agent", 403);
  return call;
}
export async function finishCall(
  id: string,
  status = "COMPLETED",
  duration?: number,
) {
  return prisma.$transaction(async (tx) => {
    const done = await tx.voiceCall.updateMany({
      where: { id, status: { notIn: TERMINAL } },
      data: { status, endedAt: new Date(), held: false },
    });
    if (!done.count) return;
    const call = await tx.voiceCall.findUniqueOrThrow({ where: { id } });
    if (call.workflow === "COLD" && !call.agentId && call.campaignContactId) {
      const contact = await tx.campaignContact.findUnique({
        where: { id: call.campaignContactId },
      });
      if (contact)
        await tx.campaignContact.update({
          where: { id: contact.id },
          data: { status: contact.attempts >= 3 ? "MAX_ATTEMPTS" : "PENDING" },
        });
    }
    if (call.workflow === "WEB" && !call.attemptStartedAt) {
      await tx.voiceWebLead.updateMany({
        where: { voiceCallId: id, attemptedAt: null },
        data: {
          status: "FAILED",
          reason: "Call did not start. Review the failed attempt.",
        },
      });
    }
    await tx.voiceAgent.updateMany({
      where: { activeCallId: id, userId: call.agentId || "" },
      data: { status: "WRAP_UP" },
    });
    await tx.voiceAgent.updateMany({
      where: { activeCallId: id, userId: { not: call.agentId || "" } },
      data: { status: "PAUSED", activeCallId: null },
    });
    if (call.callId)
      await tx.call.update({
        where: { id: call.callId },
        data: {
          status: ["ABANDONED", "CANCELED"].includes(status)
            ? "NO_ANSWER"
            : status,
          endedAt: new Date(),
          duration:
            duration ??
            (call.answeredAt
              ? Math.max(
                  0,
                  Math.round((Date.now() - call.answeredAt.getTime()) / 1000),
                )
              : 0),
        },
      });
    await tx.voiceEvent.create({ data: { voiceCallId: id, kind: status } });
  });
}
export async function endConference(id: string, status = "COMPLETED") {
  const call = await prisma.voiceCall.findUniqueOrThrow({
    where: { id },
    include: { participants: true },
  });
  const api = client();
  const seats = await prisma.voiceAgent.findMany({
    where: { activeCallId: id, standbySid: { not: null } },
    select: { standbySid: true, standbyKey: true, userId: true },
  });
  const seatSids = new Set(seats.map((s) => s.standbySid));
  // End every known leg, including ringing legs which have not joined a conference.
  const results = await Promise.allSettled([
    ...(call.conferenceSid
      ? [api.conferences(call.conferenceSid).update({ status: "completed" })]
      : []),
    ...[
      call.customerSid,
      ...call.participants
        .filter((p) => !p.endedAt && !seatSids.has(p.callSid))
        .map((p) => p.callSid),
    ]
      .filter((s): s is string => !!s)
      .map((sid) => api.calls(sid).update({ status: "completed" })),
  ]);
  const failure = results.find(
    (r) =>
      r.status === "rejected" &&
      ![20404, 21220].includes(Number(r.reason?.code)),
  );
  if (failure?.status === "rejected")
    throw new VoiceError(
      "Could not confirm the call ended. Retry hang up.",
      502,
    );
  if (!call.conferenceSid) {
    for (const seat of seats)
      if (seat.standbySid && seat.standbyKey)
        await api
          .calls(seat.standbySid)
          .update({
            url: webhookUrl("standby", {
              userId: seat.userId,
              key: seat.standbyKey,
            }),
            method: "POST",
          })
          .catch(() => {});
  }
  await finishCall(id, status);
}
export async function routeInbound(userId: string) {
  const waiting = await prisma.voiceCall.findFirst({
    where: {
      status: "WAITING",
      queue: { enabled: true, members: { some: { userId } } },
    },
    orderBy: { createdAt: "asc" },
  });
  if (!waiting) return;
  const claimed = await prisma.$transaction(async (tx) => {
    const agent = await tx.voiceAgent.updateMany({
      where: {
        userId,
        activeCallId: null,
        status: "AVAILABLE",
        heartbeatAt: { gte: freshSince() },
      },
      data: { activeCallId: waiting.id, status: "BUSY" },
    });
    if (!agent.count) return false;
    const claim = await tx.voiceCall.updateMany({
      where: { id: waiting.id, status: "WAITING" },
      data: { agentId: userId, status: "CONNECTING" },
    });
    if (!claim.count) throw new VoiceError("Queue changed", 409);
    const log = waiting.callId
      ? await tx.call.update({
          where: { id: waiting.callId },
          data: { agentId: userId },
        })
      : await tx.call.create({
          data: {
            direction: "INBOUND",
            agentId: userId,
            phoneNumber: waiting.phoneNumber,
            leadId: waiting.leadId,
          },
        });
    await tx.voiceCall.update({
      where: { id: waiting.id },
      data: { callId: log.id },
    });
    await tx.voiceParticipant.upsert({
      where: { voiceCallId_userId: { voiceCallId: waiting.id, userId } },
      create: { voiceCallId: waiting.id, userId, role: "AGENT" },
      update: { role: "AGENT", callSid: null, joinedAt: null, endedAt: null },
    });
    return true;
  });
  if (!claimed) return;
  try {
    await ringAgent(waiting.id, userId);
  } catch {
    await requeueInbound(waiting.id, userId);
  }
}
export async function ringAgent(id: string, userId: string) {
  const seat = await prisma.voiceAgent.findUnique({ where: { userId } });
  if (seat?.standbySid && seat.standbyReady) {
    await prisma.voiceAgent.updateMany({
      where: { userId, activeCallId: id },
      data: { standbyReady: false },
    });
    await prisma.voiceParticipant.updateMany({
      where: { voiceCallId: id, userId },
      data: { callSid: seat.standbySid },
    });
    await client()
      .calls(seat.standbySid)
      .update({ url: webhookUrl("join", { id, userId }), method: "POST" });
    return seat.standbySid;
  }
  const leg = await client().calls.create({
    to: `client:${identity(userId)}`,
    from: process.env.TWILIO_OUTBOUND_NUMBER!,
    url: webhookUrl("join", { id, userId }),
    statusCallback: webhookUrl("agent-status", { id, userId }),
    statusCallbackEvent: ["completed"],
    timeout: 25,
  });
  // A webhook can arrive before the REST response; only bind an unbound leg.
  await prisma.voiceParticipant.updateMany({
    where: { voiceCallId: id, userId, callSid: null },
    data: { callSid: leg.sid },
  });
  return leg.sid;
}
export async function requeueInbound(id: string, userId: string) {
  await prisma.$transaction(async (tx) => {
    const call = await tx.voiceCall.findUnique({ where: { id } });
    if (
      !call ||
      call.direction !== "INBOUND" ||
      call.status !== "CONNECTING" ||
      call.agentId !== userId
    )
      return;
    await tx.voiceCall.update({
      where: { id },
      data: { agentId: null, status: "WAITING" },
    });
    await tx.voiceAgent.updateMany({
      where: { userId, activeCallId: id },
      data: { activeCallId: null, status: "PAUSED" },
    });
    await tx.voiceParticipant.updateMany({
      where: { voiceCallId: id, userId },
      data: { endedAt: new Date() },
    });
  });
}
export async function holdCall(
  session: AuthedSession,
  id: string,
  held: boolean,
) {
  const call = await ownedCall(session, id);
  if (isTerminal(call.status) || !call.conferenceSid || !call.customerSid)
    throw new VoiceError("The customer is not connected yet.");
  await client()
    .conferences(call.conferenceSid)
    .participants(call.customerSid)
    .update({ hold: held });
  await prisma.voiceCall.update({
    where: { id },
    data: {
      held,
      events: {
        create: { actorId: session.userId, kind: held ? "HOLD" : "RESUME" },
      },
    },
  });
}
export async function transfer(
  session: AuthedSession,
  id: string,
  target: string,
) {
  const call = await ownedCall(session, id);
  if (target === session.userId || call.status !== "IN_PROGRESS")
    throw new VoiceError(
      "Choose another available agent during a connected call.",
    );
  if (call.participants.some((p) => p.role === "TRANSFER" && !p.endedAt))
    throw new VoiceError("A transfer is already in progress.", 409);
  const user = await prisma.user.findUnique({
    where: { id: target },
    select: { isActive: true },
  });
  if (!user?.isActive) throw new VoiceError("The agent is not active.");
  if (!hasPermission([...(await loadEffectivePermissions(target))], "Call.Log"))
    throw new VoiceError("The receiving agent lacks calling permission.", 403);
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "VoiceCall" WHERE "id" = ${id} FOR UPDATE`;
    const currentCall = await tx.voiceCall.findUniqueOrThrow({ where: { id } });
    if (
      currentCall.agentId !== session.userId ||
      currentCall.status !== "IN_PROGRESS"
    )
      throw new VoiceError("Call changed. Refresh before transferring.", 409);
    const inProgress = await tx.voiceParticipant.count({
      where: { voiceCallId: id, role: "TRANSFER", endedAt: null },
    });
    if (inProgress)
      throw new VoiceError("A transfer is already in progress.", 409);
    const closer = await validateCloserTransfer(tx, id, target);
    if (closer) {
      const claimed = await tx.voiceAgent.updateMany({
        where: {
          userId: target,
          activeCallId: id,
          status: "RESERVED",
          closerOpen: true,
          heartbeatAt: { gte: freshSince() },
        },
        data: { status: "BUSY" },
      });
      if (!claimed.count)
        throw new VoiceError("The closer is no longer ready.", 409);
    } else await reserveAgent(tx, target, id, true);
    if (closer)
      await tx.voiceCall.update({
        where: { id },
        data: { salesStage: "TRANSFER_PENDING" },
      });
    await tx.voiceParticipant.upsert({
      where: { voiceCallId_userId: { voiceCallId: id, userId: target } },
      create: { voiceCallId: id, userId: target, role: "TRANSFER" },
      update: {
        role: "TRANSFER",
        endedAt: null,
        joinedAt: null,
        callSid: null,
      },
    });
    await tx.voiceEvent.create({
      data: {
        voiceCallId: id,
        actorId: session.userId,
        kind: "TRANSFER_STARTED",
        detail: target,
      },
    });
  });
  try {
    // Approved sales handoffs are a three-way introduction with the client present.
    await holdCall(session, id, !call.transferReviewedAt);
    await ringAgent(id, target);
  } catch (error) {
    await prisma.voiceAgent.updateMany({
      where: { userId: target, activeCallId: id },
      data: { activeCallId: null, status: "PAUSED" },
    });
    await prisma.voiceParticipant.updateMany({
      where: { voiceCallId: id, userId: target, joinedAt: null },
      data: { endedAt: new Date() },
    });
    await holdCall(session, id, false).catch(() => {});
    await prisma.voiceCall.updateMany({
      where: { id, salesStage: "TRANSFER_PENDING", closerHandoffId: null },
      data: {
        salesStage: call.transferReviewedAt ? "PENDING_CLOSER" : "QUALIFIED",
        transferReadyAt: null,
      },
    });
    throw error;
  }
}
export async function completeTransfer(session: AuthedSession, id: string) {
  const call = await ownedCall(session, id);
  const target = call.participants.find(
    (p) => p.role === "TRANSFER" && p.joinedAt && !p.endedAt,
  );
  if (!target || isTerminal(call.status))
    throw new VoiceError("Wait for the receiving agent to answer.");
  await holdCall(session, id, false);
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "VoiceCall" WHERE "id" = ${id} FOR UPDATE`;
    const ready = await tx.voiceParticipant.findFirst({
      where: {
        id: target.id,
        role: "TRANSFER",
        endedAt: null,
        joinedAt: { not: null },
      },
    });
    if (!ready)
      throw new VoiceError("The receiving agent is no longer connected.", 409);
    const current = await tx.voiceCall.findUniqueOrThrow({ where: { id } });
    if (
      current.qualifiedAt &&
      (current.salesStage !== "TRANSFER_PENDING" ||
        current.transferTargetId !== target.userId ||
        !current.transferReviewedAt)
    )
      throw new VoiceError("The approved handoff has changed.", 409);
    const changed = await tx.voiceCall.updateMany({
      where: { id, agentId: session.userId, status: "IN_PROGRESS" },
      data: { agentId: target.userId },
    });
    if (!changed.count)
      throw new VoiceError("Call changed. Refresh before transferring.", 409);
    await tx.voiceParticipant.update({
      where: { id: target.id },
      data: { role: "AGENT" },
    });
    await tx.voiceParticipant.updateMany({
      where: { voiceCallId: id, userId: session.userId },
      data: { role: "TRANSFERRED" },
    });
    await tx.voiceAgent.updateMany({
      where: { userId: session.userId, activeCallId: id },
      data: { activeCallId: null, status: "PAUSED" },
    });
    if (call.callId)
      await tx.call.update({
        where: { id: call.callId },
        data: { agentId: target.userId },
      });
    if (
      current.salesStage === "TRANSFER_PENDING" &&
      current.qualifiedDebt &&
      current.openerId &&
      !current.closerHandoffId
    ) {
      const lead = current.leadId
        ? await tx.lead.findUnique({
            where: { id: current.leadId },
            select: { contactName: true },
          })
        : null;
      const handoff = await tx.closerHandoff.create({
        data: {
          fronterId: current.openerId,
          closerId: target.userId,
          assignedById: current.transferManagerId || session.userId,
          assignedAt: new Date(),
          leadId: current.leadId,
          clientName: lead?.contactName,
          debt: current.qualifiedDebt,
          debtLabel: `$${current.qualifiedDebt.toLocaleString("en-US")}`,
          tier: tierForDebt(current.qualifiedDebt, await debtRouting(tx)),
          status: "ASSIGNED",
        },
      });
      await tx.voiceCall.update({
        where: { id },
        data: { salesStage: "CLOSING", closerHandoffId: handoff.id },
      });
      if (current.leadId)
        await tx.lead.update({
          where: { id: current.leadId },
          data: { assignedToId: target.userId, leadAssignmentDate: new Date() },
        });
    }
    await tx.voiceEvent.create({
      data: {
        voiceCallId: id,
        actorId: session.userId,
        kind: "TRANSFER_COMPLETED",
        detail: target.userId,
      },
    });
  });
  const original = call.participants.find((p) => p.userId === session.userId);
  if (original?.callSid) {
    const seat = await prisma.voiceAgent.findUnique({
      where: { userId: session.userId },
    });
    if (seat?.standbyKey && seat.standbySid === original.callSid) {
      await client()
        .calls(original.callSid)
        .update({
          url: webhookUrl("standby", {
            userId: session.userId,
            key: seat.standbyKey,
          }),
          method: "POST",
        });
      await prisma.voiceAgent.updateMany({
        where: {
          userId: session.userId,
          activeCallId: null,
          standbyKey: seat.standbyKey,
        },
        data: { status: "AVAILABLE" },
      });
    } else
      await client().calls(original.callSid).update({ status: "completed" });
  }
}
export async function cancelTransfer(session: AuthedSession, id: string) {
  await ownedCall(session, id);
  const call = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "VoiceCall" WHERE id=${id} FOR UPDATE`;
    const current = await tx.voiceCall.findUniqueOrThrow({
      where: { id },
      include: { participants: true },
    });
    if (current.agentId !== session.userId || current.closerHandoffId)
      throw new VoiceError("The handoff is already complete.", 409);
    if (
      current.qualifiedAt &&
      !["TRANSFER_PENDING", "TRANSFER_CANCELING"].includes(current.salesStage)
    )
      throw new VoiceError(
        "Cancel the approval request from the opener desk.",
        409,
      );
    if (current.qualifiedAt)
      await tx.voiceCall.update({
        where: { id },
        data: { salesStage: "TRANSFER_CANCELING" },
      });
    return current;
  });
  const target = call.participants.find(
    (person) => person.role === "TRANSFER" && !person.endedAt,
  );
  if (target?.callSid)
    await client().calls(target.callSid).update({ status: "completed" });
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "VoiceCall" WHERE id=${id} FOR UPDATE`;
    if (target) {
      await tx.voiceParticipant.update({
        where: { id: target.id },
        data: { endedAt: new Date() },
      });
      await tx.voiceAgent.updateMany({
        where: { userId: target.userId, activeCallId: id },
        data: { activeCallId: null, status: "PAUSED" },
      });
    }
    await tx.voiceCall.updateMany({
      where: {
        id,
        salesStage: { in: ["TRANSFER_PENDING", "TRANSFER_CANCELING"] },
        closerHandoffId: null,
      },
      data: {
        salesStage: "QUALIFIED",
        transferReadyAt: null,
        transferRequestKey: null,
        transferTargetId: null,
        transferManagerId: null,
        transferReviewedAt: null,
        transferRequestedAt: null,
        transferReason: null,
      },
    });
  });
  if (!isTerminal(call.status)) await holdCall(session, id, false);
}
export async function monitor(
  session: AuthedSession,
  id: string,
  mode: string,
) {
  const call = await ownedCall(session, id, true);
  await superviseScope(session);
  if (call.agentId === session.userId || call.status !== "IN_PROGRESS")
    throw new VoiceError("Choose another agent's connected call.");
  if (!["LISTEN", "WHISPER", "BARGE"].includes(mode))
    throw new VoiceError("Unknown monitor mode");
  await prisma.$transaction(async (tx) => {
    await reserveAgent(tx, session.userId, id);
    await tx.voiceParticipant.upsert({
      where: {
        voiceCallId_userId: { voiceCallId: id, userId: session.userId },
      },
      create: {
        voiceCallId: id,
        userId: session.userId,
        role: "MONITOR",
        mode,
      },
      update: {
        role: "MONITOR",
        mode,
        joinedAt: null,
        endedAt: null,
        callSid: null,
      },
    });
    await tx.voiceEvent.create({
      data: {
        voiceCallId: id,
        actorId: session.userId,
        kind: `MONITOR_${mode}`,
      },
    });
  });
  return call;
}
export async function disposition(
  session: AuthedSession,
  id: string,
  value: string,
  notes: string,
  callbackAt?: string,
) {
  if (!(DISPOSITIONS as readonly string[]).includes(value))
    throw new VoiceError("Choose a call outcome.");
  if (
    value === "CALLBACK" &&
    (!callbackAt ||
      !Number.isFinite(Date.parse(callbackAt)) ||
      Date.parse(callbackAt) < Date.now())
  )
    throw new VoiceError("Choose a future callback time.");
  const call = await ownedCall(session, id);
  if (!isTerminal(call.status))
    throw new VoiceError("End the call before saving its outcome.");
  await prisma.$transaction(async (tx) => {
    // The first disposition releases the agent; duplicate form submissions are harmless.
    const saved = await tx.voiceCall.updateMany({
      where: { id, disposition: null },
      data: { disposition: value, notes },
    });
    if (!saved.count) return;
    if (call.callId)
      await tx.call.update({
        where: { id: call.callId },
        data: { disposition: value, notes },
      });
    if (call.leadId)
      await tx.lead.update({
        where: { id: call.leadId },
        data: {
          lastContactedAt: new Date(),
          ...(value === "DNC" ? { status: "DNC" } : {}),
          ...(value === "CALLBACK"
            ? { nextFollowUpAt: new Date(callbackAt!) }
            : {}),
        },
      });
    if (value === "DNC")
      await tx.suppressionEntry.upsert({
        where: { phone: normalizePhone(call.phoneNumber) },
        create: {
          phone: normalizePhone(call.phoneNumber),
          reason: "Do not call request",
          source: "CRM call center",
          leadId: call.leadId,
          addedById: session.userId,
        },
        update: { expiresAt: null, reason: "Do not call request" },
      });
    if (call.campaignContactId)
      await tx.campaignContact.update({
        where: { id: call.campaignContactId },
        data: {
          status: ["CALLBACK", "NO_ANSWER", "VOICEMAIL"].includes(value)
            ? "IN_PROGRESS"
            : "COMPLETED",
        },
      });
    if (
      call.closerHandoffId &&
      ["ENROLLED", "NOT_INTERESTED", "NOT_QUALIFIED", "DNC"].includes(value)
    ) {
      const won = value === "ENROLLED";
      await tx.closerHandoff.update({
        where: { id: call.closerHandoffId },
        data: {
          status: won ? "CLOSED" : "LOST",
          closedDebt: won ? call.qualifiedDebt : null,
        },
      });
      await tx.voiceCall.update({
        where: { id },
        data: { salesStage: won ? "CLOSED" : "LOST" },
      });
    }
    await tx.voiceAgent.updateMany({
      where: { activeCallId: id },
      data: { activeCallId: null, status: "PAUSED" },
    });
    await tx.voiceAgent.updateMany({
      where: {
        userId: session.userId,
        activeCallId: null,
        heartbeatAt: { gte: freshSince() },
        OR: [
          { standbyKey: { not: null } },
          {
            closerOpen: true,
            user: { isActive: true, closerTier: { not: null } },
          },
        ],
      },
      data: { status: "AVAILABLE" },
    });
    await tx.voiceEvent.create({
      data: {
        voiceCallId: id,
        actorId: session.userId,
        kind: "DISPOSITION",
        detail: value,
      },
    });
  });
}
export async function saveQueue(
  session: AuthedSession,
  input: {
    id?: string;
    name: string;
    phone: string;
    members: string[];
    enabled: boolean;
    greeting: string;
    maxWaitSeconds: number;
  },
) {
  const ids = await superviseScope(session);
  if (!input.members.every((id) => ids.includes(id)))
    throw new VoiceError("Queue members must be in your team.", 403);
  const number = phoneNumber(input.phone);
  // Verify number ownership before allowing it to route incoming callers.
  const numbers = await client().incomingPhoneNumbers.list({
    phoneNumber: number,
    limit: 1,
  });
  if (!numbers.length)
    throw new VoiceError(
      "This number is not owned by the configured Twilio account.",
    );
  if (input.id && !["ADMIN", "SUPER_ADMIN"].includes(session.role)) {
    const existing = await prisma.voiceQueue.findUnique({
      where: { id: input.id },
      include: { members: true },
    });
    if (existing?.members.some((m) => !ids.includes(m.userId)))
      throw new VoiceError(
        "This queue includes agents outside your team.",
        403,
      );
  }
  return prisma.voiceQueue.upsert({
    where: { id: input.id || "new" },
    create: {
      name: input.name,
      phoneNumber: number,
      enabled: input.enabled,
      greeting: input.greeting,
      maxWaitSeconds: input.maxWaitSeconds,
      members: { create: input.members.map((userId) => ({ userId })) },
    },
    update: {
      name: input.name,
      phoneNumber: number,
      enabled: input.enabled,
      greeting: input.greeting,
      maxWaitSeconds: input.maxWaitSeconds,
      members: {
        deleteMany: {},
        create: input.members.map((userId) => ({ userId })),
      },
    },
  });
}
export async function leaveCall(session: AuthedSession, id: string) {
  const call = await prisma.voiceCall.findUnique({
    where: { id },
    include: { participants: true },
  });
  if (!call || call.agentId === session.userId)
    throw new VoiceError("Use End call for your own call.");
  const participant = call.participants.find(
    (p) => p.userId === session.userId && !p.endedAt,
  );
  if (!participant) throw new VoiceError("You are not in this call", 403);
  if (participant.callSid)
    await client().calls(participant.callSid).update({ status: "completed" });
  await prisma.voiceParticipant.update({
    where: { id: participant.id },
    data: { endedAt: new Date() },
  });
  await prisma.voiceAgent.updateMany({
    where: { userId: session.userId, activeCallId: id },
    data: { activeCallId: null, status: "PAUSED" },
  });
}
