import { randomUUID } from "node:crypto";
import twilio from "twilio";
import { prisma } from "@/lib/prisma";
import type { AuthedSession } from "@/lib/api-auth";
import type { Prisma } from "@/generated/prisma/client";
import { hasPermission, loadEffectivePermissions } from "@/lib/permissions";
import { isSuppressed } from "@/lib/dnc";
import { isWithinCallingWindow } from "@/lib/ai-dialer/compliance";
import { phoneNumber, isTerminal, userFromIdentity } from "./model";
import {
  client,
  configuration,
  conferenceXml,
  hangupXml,
  webhookUrl,
} from "./twilio";
import {
  finishCall,
  freshSince,
  superviseScope,
  VoiceError,
  routeInbound,
  endConference,
} from "./service";
import {
  coldCapacity,
  machineAnswer,
  webDeadline,
  webSla,
} from "./outbound-policy";

type Tx = Prisma.TransactionClient;
const settingsId = "default";
const standbyWhere = {
  status: "AVAILABLE",
  activeCallId: null,
  standbyReady: true,
  standbySid: { not: null },
};
// Construct this at query time; module-load timestamps become stale on a long-running server.
function readyWhere() {
  return {
    ...standbyWhere,
    heartbeatAt: { gte: freshSince() },
    user: { isActive: true, isCloser: false, closerTier: null },
  };
}

export async function lockPhone(tx: Tx, number: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`voice-phone:${number}`}))`;
  if (
    await tx.voiceCall.count({ where: { phoneNumber: number, endedAt: null } })
  )
    throw new VoiceError("This number already has an active call.", 409);
}

function admin(session: AuthedSession) {
  if (
    !["ADMIN", "SUPER_ADMIN"].includes(session.role) &&
    !session.permissions.includes("Modify.AllData")
  )
    throw new VoiceError(
      "An administrator must configure the shared web-lead team.",
      403,
    );
}
export async function saveWebSettings(
  session: AuthedSession,
  input: { enabled: boolean; members: string[]; ownerFirst: boolean },
) {
  admin(session);
  const members = [...new Set(input.members)];
  if (input.enabled && !members.length)
    throw new VoiceError("Assign at least one web-lead agent.");
  const count = await prisma.user.count({
    where: { id: { in: members }, isActive: true },
  });
  if (count !== members.length)
    throw new VoiceError("All assigned agents must be active.");
  const old = await prisma.voiceOutboundSettings.findUnique({
    where: { id: settingsId },
  });
  return prisma.voiceOutboundSettings.upsert({
    where: { id: settingsId },
    create: {
      id: settingsId,
      webEnabled: input.enabled,
      webEnabledAt: input.enabled ? new Date() : null,
      webMemberIds: members,
      ownerFirst: input.ownerFirst,
    },
    update: {
      webEnabled: input.enabled,
      webMemberIds: members,
      ownerFirst: input.ownerFirst,
      ...(input.enabled && !old?.webEnabled
        ? { webEnabledAt: new Date() }
        : {}),
    },
  });
}
export async function saveColdCampaign(
  session: AuthedSession,
  input: {
    campaignId: string;
    running: boolean;
    maxLines: number;
    lineScope: string;
  },
) {
  const scope = await superviseScope(session);
  const campaign = await prisma.campaign.findUnique({
    where: { id: input.campaignId },
    include: { agents: true },
  });
  if (
    !campaign ||
    campaign.dialerMode === "AI" ||
    campaign.aiEnabled ||
    campaign.status !== "ACTIVE"
  )
    throw new VoiceError("Choose an active human-agent campaign.");
  if (
    !campaign.agents.length ||
    campaign.agents.some((a) => !scope.includes(a.userId))
  )
    throw new VoiceError(
      "This campaign must have agents within your team.",
      403,
    );
  if (input.running && !overflowConfigured())
    throw new VoiceError(
      "Set the company name and callback number for unanswered-agent messages before starting parallel dialing.",
    );
  // A supervisor cannot clear the automatic stop simply by pressing Start again.
  const stats = await campaignStats(input.campaignId);
  if (
    input.running &&
    stats.abandoned > 0 &&
    stats.abandoned / Math.max(1, stats.answered) >= 0.02
  )
    throw new VoiceError(
      "Parallel dialing is stopped for this campaign after missed agent connections in the last 30 days. Use one-at-a-time calls while reviewing the pilot.",
    );
  return prisma.voiceDialingCampaign.upsert({
    where: { campaignId: input.campaignId },
    create: {
      campaignId: input.campaignId,
      status: input.running ? "RUNNING" : "PAUSED",
      maxLines: input.maxLines,
      lineScope: input.lineScope,
      startedAt: input.running ? new Date() : null,
    },
    update: {
      status: input.running ? "RUNNING" : "PAUSED",
      maxLines: input.maxLines,
      lineScope: input.lineScope,
      pauseReason: null,
      ...(input.running ? { startedAt: new Date() } : {}),
    },
  });
}

export async function startSeat(session: AuthedSession) {
  const key = randomUUID();
  const changed = await prisma.voiceAgent.updateMany({
    where: {
      userId: session.userId,
      activeCallId: null,
      standbySid: null,
      heartbeatAt: { gte: freshSince() },
      status: { in: ["PAUSED", "AVAILABLE"] },
    },
    data: { standbyKey: key, standbyReady: false, status: "AVAILABLE" },
  });
  if (!changed.count)
    throw new VoiceError(
      "Connect your phone and finish the current call first.",
      409,
    );
  return key;
}
export async function stopSeat(session: AuthedSession, key?: string) {
  const seat = await prisma.voiceAgent.findUnique({
    where: { userId: session.userId },
  });
  if (!seat || (key && seat.standbyKey !== key)) return;
  if (seat.activeCallId)
    throw new VoiceError(
      "Finish the current call and save its outcome before leaving automatic dialing.",
    );
  await prisma.voiceAgent.update({
    where: { userId: session.userId },
    data: {
      standbyKey: null,
      standbySid: null,
      standbyReady: false,
      status: "PAUSED",
    },
  });
  if (seat.standbySid)
    await client()
      .calls(seat.standbySid)
      .update({ status: "completed" })
      .catch(() => {});
}
export async function lostSeat(session: AuthedSession, key: string) {
  const seat = await prisma.voiceAgent.findUnique({
    where: { userId: session.userId },
  });
  if (!seat || seat.standbyKey !== key) return;
  await prisma.voiceAgent.updateMany({
    where: { userId: session.userId, standbyKey: key },
    data: {
      standbyKey: null,
      standbySid: null,
      standbyReady: false,
      ...(!seat.activeCallId ? { status: "PAUSED" } : {}),
    },
  });
  if (seat.activeCallId) await endConference(seat.activeCallId, "FAILED");
}

export function standbyXml(userId: string, key: string) {
  const xml = new twilio.twiml.VoiceResponse();
  xml.pause({ length: 60 });
  xml.redirect({ method: "POST" }, webhookUrl("standby", { userId, key }));
  return xml.toString();
}
export async function standbyVoice(
  p: Record<string, string>,
  query: URLSearchParams,
  browser = false,
) {
  const userId = browser ? userFromIdentity(p.From || "") : query.get("userId");
  const key = browser ? p.OutboundSeat : query.get("key");
  if (!userId || !key || !/^CA[a-fA-F0-9]{32}$/.test(p.CallSid || ""))
    return hangupXml();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true },
  });
  if (
    !user?.isActive ||
    !hasPermission([...(await loadEffectivePermissions(userId))], "Call.Log")
  )
    return hangupXml();
  const bound = await prisma.voiceAgent.updateMany({
    where: {
      userId,
      standbyKey: key,
      heartbeatAt: { gte: freshSince() },
      OR: [{ standbySid: null }, { standbySid: p.CallSid }],
    },
    data: { standbySid: p.CallSid, standbyReady: true },
  });
  return bound.count ? standbyXml(userId, key) : hangupXml();
}

// Agents explicitly join an open audio seat. Answered calls use that already-connected leg.
async function claimSeat(
  tx: Tx,
  ids: string[],
  callId: string,
  preferred?: string | null,
) {
  const seats = await tx.voiceAgent.findMany({
    where: { ...readyWhere(), userId: { in: ids } },
    orderBy: { updatedAt: "asc" },
  });
  if (preferred)
    seats.sort(
      (a, b) => Number(b.userId === preferred) - Number(a.userId === preferred),
    );
  for (const seat of seats) {
    const changed = await tx.voiceAgent.updateMany({
      where: {
        ...readyWhere(),
        userId: seat.userId,
        standbySid: seat.standbySid,
      },
      data: { activeCallId: callId, status: "BUSY", standbyReady: false },
    });
    if (changed.count) return seat;
  }
  return null;
}
async function eligibleAgents(ids: string[]) {
  const seats = await prisma.voiceAgent.findMany({
    where: { ...readyWhere(), userId: { in: ids } },
    select: { userId: true },
  });
  const allowed: string[] = [];
  for (const seat of seats)
    if (
      hasPermission(
        [...(await loadEffectivePermissions(seat.userId))],
        "Call.Log",
      )
    )
      allowed.push(seat.userId);
  return allowed;
}
async function connectSeat(
  id: string,
  seat: { userId: string; standbySid: string | null },
) {
  if (!seat.standbySid) throw new Error("Agent audio is disconnected");
  await client()
    .calls(seat.standbySid)
    .update({
      url: webhookUrl("join", { id, userId: seat.userId }),
      method: "POST",
    });
}

// Only fresh WEB records created after enabling the workflow enter this queue.
// Repeated scans and webhook retries are harmless; imported history is not replayed.
export async function captureWebLeads() {
  const settings = await prisma.voiceOutboundSettings.findUnique({
    where: { id: settingsId },
  });
  if (!settings?.webEnabled || !settings.webEnabledAt) return;
  const leads = await prisma.lead.findMany({
    where: {
      recordType: "WEB",
      status: "NEW",
      createdAt: { gte: settings.webEnabledAt },
      voiceWebLead: null,
    },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  if (leads.length)
    await prisma.voiceWebLead.createMany({
      data: leads.map((l) => ({
        leadId: l.id,
        receivedAt: l.createdAt,
        deadlineAt: webDeadline(l.createdAt),
      })),
      skipDuplicates: true,
    });
}
async function allowedLead(
  lead: {
    phone: string;
    status: string;
    state: string | null;
    nextFollowUpAt: Date | null;
    convertedAt: Date | null;
  },
  campaign?: {
    timezone: string;
    startTime: string | null;
    endTime: string | null;
  },
) {
  if (lead.status === "DNC" || (await isSuppressed(lead.phone)))
    return "Do Not Call";
  if (
    lead.convertedAt ||
    ["ENROLLED", "CONVERTED", "LOST", "UNQUALIFIED"].includes(lead.status)
  )
    return "Lead is closed";
  try {
    phoneNumber(lead.phone);
  } catch {
    return "Invalid phone number";
  }
  if (lead.nextFollowUpAt && lead.nextFollowUpAt > new Date())
    return "Callback is not due";
  if (
    !isWithinCallingWindow({
      state: lead.state,
      campaignTimezone: campaign?.timezone || "America/New_York",
      startTime: campaign?.startTime || "08:00",
      endTime: campaign?.endTime || "20:00",
    })
  )
    return "Outside calling hours";
  return null;
}
export async function dispatchWeb() {
  const settings = await prisma.voiceOutboundSettings.findUnique({
    where: { id: settingsId },
  });
  if (!settings?.webEnabled) return false;
  const ids = await eligibleAgents(settings.webMemberIds);
  const jobs = await prisma.voiceWebLead.findMany({
    where: { status: "WAITING", retryAt: { lte: new Date() } },
    include: { lead: true },
    orderBy: { deadlineAt: "asc" },
    take: 100,
  });
  for (const job of jobs) {
    const reason = await allowedLead(job.lead);
    if (reason) {
      await prisma.voiceWebLead.updateMany({
        where: { leadId: job.leadId, status: "WAITING" },
        data: {
          reason,
          retryAt: new Date(Date.now() + 60_000),
          ...(reason === "Do Not Call" ||
          reason === "Lead is closed" ||
          reason === "Invalid phone number"
            ? { status: "SKIPPED" }
            : {}),
        },
      });
      continue;
    }
    if (!ids.length) {
      await prisma.voiceWebLead.updateMany({
        where: { leadId: job.leadId, status: "WAITING" },
        data: { reason: "Waiting for an agent with connected audio" },
      });
      return false;
    }
    const result = await prisma
      .$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`web-lead:${job.leadId}`}))`;
        const current = await tx.voiceWebLead.findUnique({
          where: { leadId: job.leadId },
        });
        if (current?.status !== "WAITING") return null;
        const number = phoneNumber(job.lead.phone);
        // An existing manual attempt satisfies the first-attempt workflow; do not duplicate it.
        const prior = await tx.voiceCall.findFirst({
          where: {
            leadId: job.leadId,
            direction: "OUTBOUND",
            attemptStartedAt: { gte: job.receivedAt },
          },
          orderBy: { attemptStartedAt: "asc" },
        });
        if (prior) {
          await tx.voiceWebLead.update({
            where: { leadId: job.leadId },
            data: {
              status: "DIALED",
              attemptedAt: prior.attemptStartedAt,
              reason: "Already called in the CRM",
            },
          });
          return null;
        }
        await lockPhone(tx, number);
        const id = randomUUID();
        const seat = await claimSeat(
          tx,
          ids,
          id,
          settings.ownerFirst ? job.lead.assignedToId : null,
        );
        if (!seat) return null;
        const log = await tx.call.create({
          data: {
            direction: "OUTBOUND",
            agentId: seat.userId,
            leadId: job.leadId,
            phoneNumber: number,
          },
        });
        await tx.voiceCall.create({
          data: {
            id,
            callId: log.id,
            workflow: "WEB",
            direction: "OUTBOUND",
            agentId: seat.userId,
            leadId: job.leadId,
            phoneNumber: number,
            fromNumber: phoneNumber(process.env.TWILIO_OUTBOUND_NUMBER!),
            participants: {
              create: {
                userId: seat.userId,
                role: "AGENT",
                callSid: seat.standbySid,
              },
            },
          },
        });
        await tx.voiceWebLead.update({
          where: { leadId: job.leadId },
          data: { status: "CLAIMED", voiceCallId: id, reason: null },
        });
        await tx.lead.update({
          where: { id: job.leadId },
          data: { assignedToId: seat.userId, leadAssignmentDate: new Date() },
        });
        return { id, seat };
      })
      .catch((error) => {
        if (error instanceof VoiceError && error.status === 409) return null;
        throw error;
      });
    if (!result) continue;
    try {
      await connectSeat(result.id, result.seat);
    } catch {
      await failBeforeDial(result.id, "Agent audio could not be connected");
    }
    return true;
  }
  return false;
}
async function campaignStats(campaignId: string) {
  const where = {
    campaignId,
    workflow: "COLD",
    createdAt: { gte: new Date(Date.now() - 30 * 86400_000) },
  };
  const [attempts, answered, abandoned] = await Promise.all([
    prisma.voiceCall.count({
      where: { ...where, attemptStartedAt: { not: null } },
    }),
    prisma.voiceCall.count({
      where: { ...where, humanDetectedAt: { not: null } },
    }),
    prisma.voiceCall.count({ where: { ...where, abandonedAt: { not: null } } }),
  ]);
  return { attempts, answered, abandoned };
}
function overflowConfigured() {
  try {
    return (
      !!process.env.CALL_CENTER_COMPANY_NAME?.trim() &&
      !!phoneNumber(process.env.CALL_CENTER_CALLBACK_NUMBER || "")
    );
  } catch {
    return false;
  }
}
async function priorityWaiting(ids: string[]) {
  const settings = await prisma.voiceOutboundSettings.findUnique({
    where: { id: settingsId },
  });
  if (
    settings?.webEnabled &&
    settings.webMemberIds.some((id) => ids.includes(id))
  ) {
    const jobs = await prisma.voiceWebLead.findMany({
      where: { status: "WAITING", retryAt: { lte: new Date() } },
      include: { lead: true },
      orderBy: { deadlineAt: "asc" },
      take: 100,
    });
    for (const job of jobs) if (!(await allowedLead(job.lead))) return true;
  }
  return !!(await prisma.voiceCall.count({
    where: {
      status: "WAITING",
      direction: "INBOUND",
      queue: { enabled: true, members: { some: { userId: { in: ids } } } },
    },
  }));
}
export async function dispatchCold() {
  if (!overflowConfigured()) return false;
  const campaigns = await prisma.voiceDialingCampaign.findMany({
    where: {
      status: "RUNNING",
      campaign: {
        status: "ACTIVE",
        aiEnabled: false,
        dialerMode: { not: "AI" },
      },
    },
    include: { campaign: { include: { agents: true } } },
    orderBy: { updatedAt: "asc" },
  });
  for (const config of campaigns) {
    const ids = await eligibleAgents(
      config.campaign.agents.map((a) => a.userId),
    );
    if (!ids.length || (await priorityWaiting(ids))) continue;
    const stats = await campaignStats(config.campaignId);
    const inFlight = await prisma.voiceCall.count({
      where: { workflow: "COLD", endedAt: null },
    });
    if (
      !coldCapacity({
        readyAgents: ids.length,
        maxLines: config.maxLines,
        lineScope: config.lineScope,
        inFlight,
        ...stats,
        priorityWaiting: false,
      })
    )
      continue;
    const candidates = await prisma.campaignContact.findMany({
      where: {
        campaignId: config.campaignId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        attempts: { lt: 3 },
        OR: [
          { lastAttempt: null },
          { lastAttempt: { lt: new Date(Date.now() - 30 * 60_000) } },
        ],
        lead: {
          recordType: { in: ["LIST", "BUSINESS"] },
          assignedToId: { in: config.campaign.agents.map((a) => a.userId) },
        },
      },
      include: { lead: true },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: 100,
    });
    for (const contact of candidates) {
      if (await allowedLead(contact.lead, config.campaign)) continue;
      const number = phoneNumber(contact.lead.phone);
      const call = await prisma
        .$transaction(async (tx) => {
          // Serialize against manual claims and other campaign workers for this number.
          await lockPhone(tx, number);
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('voice-cold-capacity'))`;
          const current = await tx.voiceDialingCampaign.findUnique({
            where: { campaignId: config.campaignId },
          });
          if (current?.status !== "RUNNING") return null;
          const ready = await tx.voiceAgent.count({
            where: { ...readyWhere(), userId: { in: ids } },
          });
          const pending = await tx.voiceCall.count({
            where: { workflow: "COLD", endedAt: null },
          });
          if (
            !coldCapacity({
              readyAgents: ready,
              maxLines: current.maxLines,
              lineScope: "TEAM",
              inFlight: pending,
              ...stats,
              priorityWaiting: false,
            })
          )
            return null;
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
          if (!claimed.count) return null;
          return tx.voiceCall.create({
            data: {
              workflow: "COLD",
              direction: "OUTBOUND",
              phoneNumber: number,
              fromNumber: phoneNumber(process.env.TWILIO_OUTBOUND_NUMBER!),
              leadId: contact.leadId,
              campaignId: config.campaignId,
              campaignContactId: contact.id,
              customerDialStarted: true,
            },
          });
        })
        .catch((error) => {
          if (error instanceof VoiceError && error.status === 409) return null;
          throw error;
        });
      if (!call) continue;
      try {
        const currentLead = await prisma.lead.findUnique({
          where: { id: contact.leadId },
        });
        const currentCampaign = await prisma.voiceDialingCampaign.findUnique({
          where: { campaignId: config.campaignId },
        });
        if (
          !currentLead ||
          (await allowedLead(currentLead, config.campaign)) ||
          currentCampaign?.status !== "RUNNING"
        ) {
          await finishCall(call.id, "CANCELED");
          return true;
        }
        // Synchronous detection keeps machines out of agent audio; unknown is treated as a person.
        const leg = await client().calls.create({
          to: number,
          from: call.fromNumber,
          url: webhookUrl("cold-answer", { id: call.id }),
          method: "POST",
          machineDetection: "Enable",
          machineDetectionTimeout: 3,
          timeout: 30,
          statusCallback: webhookUrl("customer-status", { id: call.id }),
          statusCallbackEvent: [
            "initiated",
            "ringing",
            "answered",
            "completed",
          ],
        });
        await prisma.voiceCall.updateMany({
          where: { id: call.id, customerSid: null },
          data: { customerSid: leg.sid },
        });
        const latest = await prisma.voiceCall.findUniqueOrThrow({
          where: { id: call.id },
        });
        if (isTerminal(latest.status))
          await client().calls(leg.sid).update({ status: "completed" });
      } catch {
        // Never repeat an uncertain provider POST. Reconciliation waits for a status callback.
        await prisma.voiceEvent.create({
          data: {
            voiceCallId: call.id,
            kind: "DISPATCH_UNCERTAIN",
            detail:
              "Carrier create failed or timed out; automatic resend is disabled.",
          },
        });
        await prisma.voiceDialingCampaign.update({
          where: { campaignId: config.campaignId },
          data: {
            status: "PAUSED",
            pauseReason:
              "Carrier request failed; inspect the last attempt before resuming.",
          },
        });
      }
      await prisma.voiceDialingCampaign.update({
        where: { campaignId: config.campaignId },
        data: { updatedAt: new Date() },
      });
      return true;
    }
  }
  return false;
}

export async function coldAnswer(p: Record<string, string>, id: string) {
  if (!/^CA[a-fA-F0-9]{32}$/.test(p.CallSid || "")) return hangupXml();
  const call = await prisma.voiceCall.findUnique({ where: { id } });
  if (
    !call ||
    call.workflow !== "COLD" ||
    !call.customerDialStarted ||
    isTerminal(call.status) ||
    (call.customerSid && call.customerSid !== p.CallSid)
  )
    return hangupXml();
  const bound = await prisma.voiceCall.updateMany({
    where: { id, OR: [{ customerSid: null }, { customerSid: p.CallSid }] },
    data: { customerSid: p.CallSid },
  });
  if (!bound.count) return hangupXml();
  if (call.agentId) return coldReady(p, id);
  if (machineAnswer(p.AnsweredBy || "")) {
    await prisma.voiceCall.updateMany({
      where: { id, humanDetectedAt: null },
      data: { machineResult: p.AnsweredBy, disposition: "VOICEMAIL" },
    });
    await finishCall(id, "COMPLETED");
    return hangupXml();
  }
  const campaign = await prisma.campaign.findUnique({
    where: { id: call.campaignId || "" },
    include: { agents: true },
  });
  const ids = campaign
    ? await eligibleAgents(campaign.agents.map((a) => a.userId))
    : [];
  const seat = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "VoiceCall" WHERE id = ${id} FOR UPDATE`;
    const latest = await tx.voiceCall.findUniqueOrThrow({ where: { id } });
    if (latest.agentId || isTerminal(latest.status)) return null;
    await tx.voiceCall.update({
      where: { id },
      data: {
        machineResult: p.AnsweredBy || "unknown",
        humanDetectedAt: new Date(),
        customerAnsweredAt: latest.customerAnsweredAt || new Date(),
      },
    });
    const selected = await claimSeat(tx, ids, id);
    if (!selected) return null;
    const log = await tx.call.create({
      data: {
        direction: "OUTBOUND",
        agentId: selected.userId,
        leadId: call.leadId,
        campaignId: call.campaignId,
        phoneNumber: call.phoneNumber,
        startedAt: call.createdAt,
      },
    });
    await tx.voiceCall.update({
      where: { id },
      data: {
        agentId: selected.userId,
        callId: log.id,
        participants: {
          create: {
            userId: selected.userId,
            role: "AGENT",
            callSid: selected.standbySid,
          },
        },
      },
    });
    if (call.leadId)
      await tx.lead.update({
        where: { id: call.leadId },
        data: { assignedToId: selected.userId, leadAssignmentDate: new Date() },
      });
    return selected;
  });
  if (!seat) {
    const current = await prisma.voiceCall.findUniqueOrThrow({ where: { id } });
    if (current.agentId && !isTerminal(current.status)) return coldReady(p, id);
    if (isTerminal(current.status)) return hangupXml();
    return abandonCold(id, "No available agent at answer");
  }
  try {
    await connectSeat(id, seat);
  } catch {
    return abandonCold(id, "Agent audio connection failed");
  }
  return coldReady(p, id);
}
export async function coldReady(p: Record<string, string>, id: string) {
  const call = await prisma.voiceCall.findUnique({
    where: { id },
    include: { participants: true },
  });
  if (
    !call ||
    call.workflow !== "COLD" ||
    call.customerSid !== p.CallSid ||
    isTerminal(call.status)
  )
    return hangupXml();
  if (
    call.agentId &&
    call.conferenceSid &&
    call.participants.some(
      (part) => part.userId === call.agentId && part.joinedAt && !part.endedAt,
    )
  )
    return conferenceXml(id, "CUSTOMER");
  if (
    !call.humanDetectedAt ||
    Date.now() - call.humanDetectedAt.getTime() >= 2000
  )
    return abandonCold(
      id,
      "Agent did not connect within the answer handoff window",
    );
  const xml = new twilio.twiml.VoiceResponse();
  xml.pause({ length: 1 });
  xml.redirect({ method: "POST" }, webhookUrl("cold-ready", { id }));
  return xml.toString();
}
async function abandonCold(id: string, reason: string) {
  await noteAbandonment(id, reason);
  await finishCall(id, "ABANDONED");
  const seat = await prisma.voiceAgent.findFirst({
    where: {
      activeCallId: id,
      standbySid: { not: null },
      standbyKey: { not: null },
    },
  });
  if (seat?.standbySid && seat.standbyKey)
    await client()
      .calls(seat.standbySid)
      .update({
        url: webhookUrl("standby", {
          userId: seat.userId,
          key: seat.standbyKey,
        }),
        method: "POST",
      })
      .catch(() => {});
  const xml = new twilio.twiml.VoiceResponse();
  if (overflowConfigured())
    xml.say(
      `This is ${process.env.CALL_CENTER_COMPANY_NAME!.trim()}. We are unable to connect an agent. You can reach us at ${phoneNumber(process.env.CALL_CENTER_CALLBACK_NUMBER!).slice(1).split("").join(" ")}. Goodbye.`,
    );
  xml.hangup();
  return xml.toString();
}
export async function noteAbandonment(id: string, reason: string) {
  const call = await prisma.voiceCall.findUniqueOrThrow({ where: { id } });
  if (call.workflow !== "COLD") return;
  const changed = await prisma.voiceCall.updateMany({
    where: { id, abandonedAt: null },
    data: { abandonedAt: new Date() },
  });
  if (changed.count)
    await prisma.voiceEvent.create({
      data: {
        voiceCallId: id,
        kind: "MISSED_AGENT_CONNECTION",
        detail: reason,
      },
    });
  if (call.campaignId)
    await prisma.voiceDialingCampaign.updateMany({
      where: { campaignId: call.campaignId },
      data: { status: "PAUSED", pauseReason: reason },
    });
}
export async function failBeforeDial(id: string, reason: string) {
  const call = await prisma.voiceCall.findUniqueOrThrow({ where: { id } });
  await finishCall(id, "FAILED");
  if (call.workflow === "WEB" && !call.customerDialStarted) {
    await prisma.voiceWebLead.updateMany({
      where: { voiceCallId: id, attemptedAt: null },
      data: { status: "WAITING", voiceCallId: null, reason },
    });
    await prisma.voiceAgent.updateMany({
      where: { activeCallId: id },
      data: { activeCallId: null, status: "PAUSED", standbyReady: false },
    });
  }
}
let dispatching = false;
export async function dispatchOutbound() {
  if (dispatching || !configuration().enabled || !configuration().ready) return;
  dispatching = true;
  try {
    const budget = await prisma.$transaction(async (tx) => {
      await tx.voiceDialerLease.upsert({
        where: { id: "dispatch" },
        create: { id: "dispatch", expiresAt: new Date(0) },
        update: {},
      });
      const claimed = await tx.voiceDialerLease.updateMany({
        where: { id: "dispatch", expiresAt: { lte: new Date() } },
        data: { expiresAt: new Date(Date.now() + 1000) },
      });
      return claimed.count;
    });
    if (!budget) return;
    await captureWebLeads();
    const cps = Math.max(
      1,
      Math.min(5, Number(process.env.CALL_CENTER_CALLS_PER_SECOND) || 1),
    );
    for (let i = 0; i < cps; i++) {
      if (await dispatchWeb()) continue;
      const seats = await prisma.voiceAgent.findMany({
        where: readyWhere(),
        select: { userId: true },
      });
      for (const seat of seats) await routeInbound(seat.userId);
      if (!(await dispatchCold())) break;
    }
  } finally {
    dispatching = false;
  }
}

export async function outboundOverview(
  session: AuthedSession,
  ids: string[],
  supervisor: boolean,
) {
  const settings = await prisma.voiceOutboundSettings.findUnique({
    where: { id: settingsId },
  });
  const webVisible =
    supervisor || settings?.webMemberIds.includes(session.userId);
  const webScope: Prisma.VoiceWebLeadWhereInput =
    supervisor &&
    !["ADMIN", "SUPER_ADMIN"].includes(session.role) &&
    !session.permissions.includes("Modify.AllData")
      ? { lead: { assignedToId: { in: ids } } }
      : {};
  const pendingScope: Prisma.VoiceWebLeadWhereInput = {
    ...webScope,
    status: { in: ["WAITING", "CLAIMED", "FAILED"] },
    attemptedAt: null,
  };
  const jobs = webVisible
    ? await prisma.voiceWebLead.findMany({
        where: pendingScope,
        include: {
          lead: { select: { contactName: true, businessName: true } },
        },
        orderBy: { deadlineAt: "asc" },
        take: 50,
      })
    : [];
  const campaigns = await prisma.voiceDialingCampaign.findMany({
    where: { campaign: { agents: { some: { userId: { in: ids } } } } },
    include: { campaign: { select: { name: true } } },
  });
  return {
    webCounts: webVisible
      ? {
          waiting: await prisma.voiceWebLead.count({ where: pendingScope }),
          overdue: await prisma.voiceWebLead.count({
            where: { ...pendingScope, deadlineAt: { lt: new Date() } },
          }),
        }
      : { waiting: 0, overdue: 0 },
    settings: webVisible ? settings : null,
    canConfigureWeb:
      ["ADMIN", "SUPER_ADMIN"].includes(session.role) ||
      session.permissions.includes("Modify.AllData"),
    webLeads: jobs.map((job) => ({
      ...job,
      sla: webSla(job.receivedAt, job.attemptedAt),
    })),
    coldCampaigns: await Promise.all(
      campaigns.map(async (c) => ({
        ...c,
        ...(await campaignStats(c.campaignId)),
        inFlight: await prisma.voiceCall.count({
          where: {
            campaignId: c.campaignId,
            workflow: "COLD",
            endedAt: null,
          },
        }),
      })),
    ),
  };
}
