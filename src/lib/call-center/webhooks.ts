import twilio from "twilio";
import { prisma } from "@/lib/prisma";
import { isSuppressed } from "@/lib/dnc";
import {
  isTerminal,
  nextCallStatus,
  userFromIdentity,
  TERMINAL,
} from "./model";
import { client, conferenceXml, hangupXml, webhookUrl } from "./twilio";
import { endConference, finishCall, requeueInbound } from "./service";
import { noteAbandonment } from "./outbound";

export async function inbound(p: Record<string, string>) {
  if (!/^CA[a-fA-F0-9]{32}$/.test(p.CallSid || "")) return hangupXml();
  const queue = await prisma.voiceQueue.findUnique({
    where: { phoneNumber: p.To },
  });
  if (!queue?.enabled) {
    const xml = new twilio.twiml.VoiceResponse();
    xml.say(
      "We are unable to take your call at the moment. Please call again later.",
    );
    xml.hangup();
    return xml.toString();
  }
  // Exact normalized matching only; ambiguous matches stay unlinked.
  const digits = p.From.replace(/\D/g, "").slice(-10);
  const leads = await prisma.lead.findMany({
    where: { phone: { in: [p.From, digits, `1${digits}`] } },
    select: { id: true },
    take: 2,
  });
  const call = await prisma.voiceCall.upsert({
    where: { customerSid: p.CallSid },
    create: {
      direction: "INBOUND",
      status: "WAITING",
      phoneNumber: p.From,
      fromNumber: p.To,
      customerSid: p.CallSid,
      queueId: queue.id,
      leadId: leads.length === 1 ? leads[0].id : null,
    },
    update: {},
  });
  if (isTerminal(call.status)) return hangupXml();
  const xml = new twilio.twiml.VoiceResponse();
  xml.say(queue.greeting);
  // Conference parameters must match those emitted by conferenceXml.
  const conference = conferenceXml(call.id, "CUSTOMER")
    .replace(/^.*?<Response>/, "")
    .replace(/<\/Response>$/, "");
  return xml.toString().replace("</Response>", `${conference}</Response>`);
}
export async function join(
  p: Record<string, string>,
  query: URLSearchParams,
  browser: boolean,
) {
  const id = browser ? p.VoiceCallId : query.get("id");
  const userId = browser ? userFromIdentity(p.From || "") : query.get("userId");
  if (!id || !userId || !/^CA[a-fA-F0-9]{32}$/.test(p.CallSid || ""))
    return hangupXml();
  const call = await prisma.voiceCall.findUnique({
    where: { id },
    include: { participants: true },
  });
  const participant = call?.participants.find((row) => row.userId === userId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true },
  });
  if (
    !call ||
    !user?.isActive ||
    isTerminal(call.status) ||
    !participant ||
    participant.endedAt ||
    (participant.callSid && participant.callSid !== p.CallSid)
  )
    return hangupXml();
  if (participant.role === "AGENT" && call.agentId !== userId)
    return hangupXml();
  if (!["AGENT", "TRANSFER", "MONITOR"].includes(participant.role))
    return hangupXml();
  // Browser credentials cannot override the server-approved participant role/mode.
  const bound = await prisma.voiceParticipant.updateMany({
    where: {
      id: participant.id,
      endedAt: null,
      OR: [{ callSid: null }, { callSid: p.CallSid }],
    },
    data: { callSid: p.CallSid },
  });
  if (!bound.count) return hangupXml();
  const agent = call.participants.find(
    (row) => row.userId === call.agentId && row.joinedAt && !row.endedAt,
  );
  if (participant.mode === "WHISPER" && !agent?.callSid) return hangupXml();
  const seat = await prisma.voiceAgent.findUnique({ where: { userId } });
  const returnTo =
    seat?.standbyKey && seat.standbySid === p.CallSid
      ? webhookUrl("standby", { userId, key: seat.standbyKey })
      : undefined;
  return conferenceXml(
    id,
    participant.role as "AGENT" | "TRANSFER" | "MONITOR",
    participant.mode || undefined,
    agent?.callSid || undefined,
    returnTo,
  );
}
async function dialCustomer(id: string) {
  const call = await prisma.voiceCall.findUniqueOrThrow({ where: { id } });
  if (
    call.direction !== "OUTBOUND" ||
    !call.conferenceSid ||
    isTerminal(call.status)
  )
    return;
  const lead = call.leadId
    ? await prisma.lead.findUnique({
        where: { id: call.leadId },
        select: { status: true },
      })
    : null;
  if (lead?.status === "DNC" || (await isSuppressed(call.phoneNumber))) {
    await endConference(id, "FAILED");
    return;
  }
  const reserved = await prisma.voiceCall.updateMany({
    where: { id, customerDialStarted: false, status: { notIn: TERMINAL } },
    data: { customerDialStarted: true },
  });
  if (!reserved.count) return;
  try {
    const participant = await client()
      .conferences(call.conferenceSid)
      .participants.create({
        to: call.phoneNumber,
        from: call.fromNumber,
        label: "customer",
        endConferenceOnExit: true,
        startConferenceOnEnter: true,
        earlyMedia: true,
        beep: "false",
        timeout: 30,
        statusCallback: webhookUrl("customer-status", { id }),
        statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      });
    await prisma.voiceCall.updateMany({
      where: { id, customerSid: null },
      data: { customerSid: participant.callSid },
    });
    const latest = await prisma.voiceCall.findUniqueOrThrow({ where: { id } });
    if (isTerminal(latest.status))
      await client().calls(participant.callSid).update({ status: "completed" });
  } catch (error) {
    await prisma.voiceEvent.create({
      data: {
        voiceCallId: id,
        kind: "DIAL_ERROR",
        detail:
          error instanceof Error
            ? error.message.slice(0, 250)
            : "Carrier error",
      },
    });
    await endConference(id, "FAILED");
  }
}
export async function conferenceEvent(p: Record<string, string>, id: string) {
  const call = await prisma.voiceCall.findUnique({
    where: { id },
    include: { participants: true },
  });
  if (
    !call ||
    p.FriendlyName !== `crm_${id}` ||
    !/^CF[a-fA-F0-9]{32}$/.test(p.ConferenceSid || "") ||
    (call.conferenceSid && p.ConferenceSid !== call.conferenceSid)
  )
    return;
  await prisma.voiceCall.updateMany({
    where: { id, conferenceSid: null },
    data: { conferenceSid: p.ConferenceSid },
  });
  const event = p.StatusCallbackEvent;
  if (event === "conference-end") {
    await finishCall(
      id,
      call.answeredAt
        ? "COMPLETED"
        : call.direction === "INBOUND"
          ? "ABANDONED"
          : "NO_ANSWER",
    );
    return;
  }
  const participant = call.participants.find(
    (row) => row.callSid === p.CallSid,
  );
  const customer =
    p.CallSid === call.customerSid ||
    (p.ParticipantLabel === "customer" &&
      call.direction === "OUTBOUND" &&
      call.customerDialStarted);
  if (customer && !call.customerSid)
    await prisma.voiceCall.updateMany({
      where: { id, customerSid: null },
      data: { customerSid: p.CallSid },
    });
  if (isTerminal(call.status)) {
    if (event === "participant-join")
      await client().calls(p.CallSid).update({ status: "completed" });
    return;
  }
  if (event === "participant-join") {
    if (participant && !participant.endedAt)
      await prisma.voiceParticipant.updateMany({
        where: { id: participant.id, endedAt: null, joinedAt: null },
        data: { joinedAt: new Date() },
      });
    if (participant?.role === "AGENT" && call.direction === "OUTBOUND")
      await dialCustomer(id);
    if (call.workflow === "COLD") {
      if (customer)
        await prisma.voiceCall.updateMany({
          where: { id, customerJoinedAt: null, endedAt: null },
          data: { customerJoinedAt: new Date() },
        });
      const current = await prisma.voiceCall.findUniqueOrThrow({
        where: { id },
        include: { participants: true },
      });
      if (
        current.customerJoinedAt &&
        current.participants.some(
          (row) =>
            row.userId === current.agentId && row.joinedAt && !row.endedAt,
        )
      ) {
        await prisma.voiceCall.updateMany({
          where: { id, endedAt: null, bridgedAt: null },
          data: {
            status: "IN_PROGRESS",
            answeredAt: new Date(),
            bridgedAt: new Date(),
          },
        });
        if (current.callId)
          await prisma.call.updateMany({
            where: { id: current.callId, endedAt: null },
            data: { status: "IN_PROGRESS", answeredAt: new Date() },
          });
        if (
          current.customerAnsweredAt &&
          Date.now() - current.customerAnsweredAt.getTime() > 2000
        )
          await noteAbandonment(
            id,
            "Agent connection took more than two seconds after answer",
          );
      }
      return;
    }
    if (
      (customer && call.direction === "OUTBOUND") ||
      (participant?.role === "AGENT" && call.direction === "INBOUND")
    ) {
      await prisma.voiceCall.updateMany({
        where: { id, endedAt: null, answeredAt: null },
        data: { status: "IN_PROGRESS", answeredAt: new Date() },
      });
      if (call.callId)
        await prisma.call.updateMany({
          where: { id: call.callId, endedAt: null },
          data: { status: "IN_PROGRESS", answeredAt: new Date() },
        });
    }
  }
  if (event === "participant-leave") {
    if (participant)
      await prisma.voiceParticipant.update({
        where: { id: participant.id },
        data: { endedAt: new Date() },
      });
    const current = await prisma.voiceCall.findUniqueOrThrow({ where: { id } });
    if (customer)
      await endConference(id, current.answeredAt ? "COMPLETED" : "ABANDONED");
    else if (participant?.userId === current.agentId) await endConference(id);
    else if (participant)
      await prisma.voiceAgent.updateMany({
        where: { userId: participant.userId, activeCallId: id },
        data: { activeCallId: null, status: "PAUSED" },
      });
  }
}
export async function customerStatus(
  p: Record<string, string>,
  id?: string | null,
) {
  const call = id
    ? await prisma.voiceCall.findUnique({ where: { id } })
    : await prisma.voiceCall.findUnique({
        where: { customerSid: p.CallSid || "unknown" },
      });
  if (
    !call ||
    (call.customerSid && call.customerSid !== p.CallSid) ||
    (!call.customerSid && !call.customerDialStarted)
  )
    return;
  await prisma.voiceCall.updateMany({
    where: { id: call.id, customerSid: null },
    data: { customerSid: p.CallSid },
  });
  if (
    call.direction === "OUTBOUND" &&
    ["initiated", "ringing", "in-progress", "answered"].includes(p.CallStatus)
  ) {
    // Use the signed provider initiation timestamp when supplied; never use lead claim time.
    const reported = p.Timestamp ? new Date(p.Timestamp) : new Date();
    const started =
      !Number.isNaN(reported.getTime()) &&
      reported >= call.createdAt &&
      reported <= new Date()
        ? reported
        : new Date();
    await prisma.voiceCall.updateMany({
      where: {
        id: call.id,
        OR: [{ attemptStartedAt: null }, { attemptStartedAt: { gt: started } }],
      },
      data: { attemptStartedAt: started },
    });
    if (call.workflow === "WEB")
      await prisma.voiceWebLead.updateMany({
        where: {
          voiceCallId: call.id,
          OR: [{ attemptedAt: null }, { attemptedAt: { gt: started } }],
        },
        data: { attemptedAt: started, status: "DIALED", reason: null },
      });
  }
  if (isTerminal(call.status)) {
    if (
      ["initiated", "ringing", "in-progress", "answered"].includes(p.CallStatus)
    )
      await client()
        .calls(p.CallSid)
        .update({ status: "completed" })
        .catch((error) => {
          if (![20404, 21220].includes(Number(error?.code))) throw error;
        });
    return;
  }
  if (
    call.workflow === "COLD" &&
    !["completed", "failed", "busy", "no-answer", "canceled"].includes(
      p.CallStatus,
    )
  ) {
    if (["in-progress", "answered"].includes(p.CallStatus)) {
      await prisma.voiceCall.updateMany({
        where: { id: call.id, customerAnsweredAt: null, endedAt: null },
        data: { customerAnsweredAt: new Date() },
      });
    } else if (p.CallStatus === "ringing") {
      await prisma.voiceCall.updateMany({
        where: { id: call.id, status: "CONNECTING" },
        data: { status: "RINGING" },
      });
    }
    return;
  }
  if (
    call.direction === "INBOUND" &&
    !["completed", "failed", "busy", "no-answer", "canceled"].includes(
      p.CallStatus,
    )
  )
    return;
  const next = nextCallStatus(call.status, p.CallStatus);
  if (isTerminal(next)) {
    if (call.workflow === "COLD" && call.humanDetectedAt && !call.bridgedAt) {
      await noteAbandonment(
        call.id,
        "Answered caller disconnected before reaching an agent",
      );
      await endConference(call.id, "ABANDONED");
      return;
    }
    await endConference(
      call.id,
      next === "COMPLETED" && !call.answeredAt && call.direction === "INBOUND"
        ? "ABANDONED"
        : next,
    );
    return;
  }
  // Compare-and-swap means a delayed ringing webhook cannot regress connected state.
  await prisma.voiceCall.updateMany({
    where: { id: call.id, status: call.status },
    data: {
      status: next,
      ...(next === "IN_PROGRESS" && !call.answeredAt
        ? { answeredAt: new Date() }
        : {}),
    },
  });
  if (call.callId)
    await prisma.call.updateMany({
      where: {
        id: call.callId,
        endedAt: null,
        status: { in: ["INITIATED", "RINGING"] },
      },
      data: { status: next === "CONNECTING" ? "INITIATED" : next },
    });
}
export async function agentStatus(
  p: Record<string, string>,
  id: string,
  userId: string,
) {
  const part = await prisma.voiceParticipant.findUnique({
    where: { voiceCallId_userId: { voiceCallId: id, userId } },
    include: { voiceCall: true },
  });
  if (!part || (part.callSid && part.callSid !== p.CallSid) || part.endedAt)
    return;
  if (
    part.voiceCall.agentId === userId &&
    part.voiceCall.direction === "INBOUND" &&
    !part.joinedAt
  )
    await requeueInbound(id, userId);
  else if (part.role === "TRANSFER" || part.role === "MONITOR") {
    await prisma.voiceParticipant.update({
      where: { id: part.id },
      data: { endedAt: new Date() },
    });
    await prisma.voiceAgent.updateMany({
      where: { userId, activeCallId: id },
      data: { activeCallId: null, status: "PAUSED" },
    });
  } else if (
    !isTerminal(part.voiceCall.status) &&
    part.voiceCall.agentId === userId
  )
    await endConference(id);
}
export async function recording(p: Record<string, string>, id: string) {
  const call = await prisma.voiceCall.findUnique({ where: { id } });
  if (
    !call ||
    call.conferenceSid !== p.ConferenceSid ||
    !/^RE[a-fA-F0-9]{32}$/.test(p.RecordingSid || "") ||
    p.RecordingStatus !== "completed"
  )
    return;
  await prisma.voiceCall.update({
    where: { id },
    data: { recordingSid: p.RecordingSid },
  });
  if (call.callId)
    await prisma.call.update({
      where: { id: call.callId },
      data: { recordingUrl: `/api/call-center/recordings/${id}` },
    });
}
