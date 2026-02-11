import { prisma } from "@/lib/prisma";
import { getTelephonyProvider } from "@/lib/telephony";
import type { CallSession } from "@/lib/telephony/types";
import { MockTelephonyProvider } from "@/lib/telephony/mock-provider";
import type { DialerSession, DialerContact } from "./types";

function generateSessionId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "ds-";
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const sessions = new Map<string, DialerSession>();
const sessionCallSids = new Map<string, string>(); // sessionId -> current callSid
const callSidToCallId = new Map<string, string>(); // telephony SID -> DB Call ID

export function startSession(
  campaignId: string,
  agentId: string
): DialerSession {
  const id = generateSessionId();
  const session: DialerSession = {
    id,
    campaignId,
    agentId,
    status: "active",
    stats: {
      callsMade: 0,
      connected: 0,
      noAnswer: 0,
      busy: 0,
      voicemail: 0,
      enrolled: 0,
      totalTalkTime: 0,
    },
    startedAt: new Date(),
  };

  sessions.set(id, session);
  return session;
}

export async function getNextContact(
  sessionId: string
): Promise<DialerContact | null> {
  const session = sessions.get(sessionId);
  if (!session || session.status !== "active") {
    return null;
  }

  const campaignContact = await prisma.campaignContact.findFirst({
    where: {
      campaignId: session.campaignId,
      OR: [
        { status: "PENDING" },
        {
          status: "IN_PROGRESS",
          attempts: { lt: 3 },
        },
      ],
    },
    orderBy: { priority: "desc" },
    include: {
      lead: true,
    },
  });

  if (!campaignContact) {
    return null;
  }

  session.currentContactId = campaignContact.id;

  return {
    id: campaignContact.id,
    leadId: campaignContact.lead.id,
    businessName: campaignContact.lead.businessName,
    contactName: campaignContact.lead.contactName,
    phone: campaignContact.lead.phone,
    totalDebtEst: campaignContact.lead.totalDebtEst,
    industry: campaignContact.lead.industry,
    score: campaignContact.lead.score,
    attempts: campaignContact.attempts,
    priority: campaignContact.priority,
  };
}

export async function initiateCall(
  sessionId: string,
  contactId: string
): Promise<{ callId: string; callSession: CallSession }> {
  const session = sessions.get(sessionId);
  if (!session || session.status !== "active") {
    throw new Error("Dialer session is not active");
  }

  const campaignContact = await prisma.campaignContact.findUnique({
    where: { id: contactId },
    include: { lead: true },
  });

  if (!campaignContact) {
    throw new Error("Campaign contact not found");
  }

  const provider = getTelephonyProvider();
  const callSession = await provider.makeCall({
    to: campaignContact.lead.phone,
    from: "+18005551234", // Default outbound number
    agentId: session.agentId,
  });

  // Create Call record in DB
  const call = await prisma.call.create({
    data: {
      direction: "OUTBOUND",
      status: "INITIATED",
      leadId: campaignContact.leadId,
      agentId: session.agentId,
      campaignId: session.campaignId,
      phoneNumber: campaignContact.lead.phone,
      startedAt: callSession.startedAt,
    },
  });

  // Update CampaignContact attempts and status
  await prisma.campaignContact.update({
    where: { id: contactId },
    data: {
      attempts: { increment: 1 },
      lastAttempt: new Date(),
      status: "IN_PROGRESS",
    },
  });

  // Track mappings
  sessionCallSids.set(sessionId, callSession.sid);
  callSidToCallId.set(callSession.sid, call.id);

  // Update session stats
  session.stats.callsMade++;
  session.currentContactId = contactId;

  // Set up status callback to update the DB Call record
  if (provider instanceof MockTelephonyProvider) {
    provider.setStatusCallback(async (sid: string, status: string) => {
      const dbCallId = callSidToCallId.get(sid);
      if (!dbCallId) return;

      const statusMap: Record<string, string> = {
        initiated: "INITIATED",
        ringing: "RINGING",
        "in-progress": "IN_PROGRESS",
        completed: "COMPLETED",
        "no-answer": "NO_ANSWER",
        busy: "BUSY",
        failed: "FAILED",
        voicemail: "VOICEMAIL",
      };

      const dbStatus = statusMap[status] || "INITIATED";

      try {
        const updateData: Record<string, unknown> = { status: dbStatus };

        if (status === "in-progress") {
          updateData.answeredAt = new Date();
          session.stats.connected++;
        } else if (status === "no-answer") {
          session.stats.noAnswer++;
        } else if (status === "busy") {
          session.stats.busy++;
        } else if (status === "voicemail") {
          session.stats.voicemail++;
        } else if (status === "completed") {
          const callData = await provider.getCallStatus(sid).catch(() => null);
          if (callData) {
            updateData.duration = callData.duration;
            updateData.endedAt = new Date();
            session.stats.totalTalkTime += callData.duration;

            // Generate mock recording URL
            updateData.recordingUrl = (
              provider as MockTelephonyProvider
            ).getRecordingUrl(sid);
          }
        }

        await prisma.call.update({
          where: { id: dbCallId },
          data: updateData,
        });
      } catch {
        // Ignore DB update errors in callback
      }
    });
  }

  return { callId: call.id, callSession };
}

export async function submitDisposition(
  callId: string,
  disposition: string,
  notes: string | null,
  nextFollowUp?: string | null
): Promise<void> {
  const call = await prisma.call.findUnique({
    where: { id: callId },
  });

  if (!call) {
    throw new Error("Call not found");
  }

  // Update Call record
  await prisma.call.update({
    where: { id: callId },
    data: {
      disposition,
      notes,
      status: "COMPLETED",
      endedAt: call.endedAt || new Date(),
    },
  });

  // Update Lead status based on disposition
  if (call.leadId) {
    const leadStatusMap: Record<string, string> = {
      ENROLLED: "ENROLLED",
      DNC: "DNC",
      CALLBACK: "CALLBACK",
      NOT_INTERESTED: "LOST",
      NOT_QUALIFIED: "UNQUALIFIED",
      INTERESTED: "QUALIFIED",
    };

    const newLeadStatus = leadStatusMap[disposition];

    const leadUpdateData: Record<string, unknown> = {
      lastContactedAt: new Date(),
    };

    if (newLeadStatus) {
      leadUpdateData.status = newLeadStatus;
    }

    if (nextFollowUp) {
      leadUpdateData.nextFollowUpAt = new Date(nextFollowUp);
    }

    await prisma.lead.update({
      where: { id: call.leadId },
      data: leadUpdateData,
    });
  }

  // Update CampaignContact status to COMPLETED
  if (call.campaignId && call.leadId) {
    const campaignContact = await prisma.campaignContact.findFirst({
      where: {
        campaignId: call.campaignId,
        leadId: call.leadId,
      },
    });

    if (campaignContact) {
      // Mark as completed unless it's a callback (keep in progress for retry)
      const contactStatus =
        disposition === "CALLBACK" ? "IN_PROGRESS" : "COMPLETED";
      await prisma.campaignContact.update({
        where: { id: campaignContact.id },
        data: { status: contactStatus },
      });
    }
  }

  // Update session stats for enrollment
  if (disposition === "ENROLLED") {
    // Find the session that owns this call
    for (const session of sessions.values()) {
      if (
        session.campaignId === call.campaignId &&
        session.agentId === call.agentId
      ) {
        session.stats.enrolled++;
        break;
      }
    }
  }
}

export function stopSession(sessionId: string): DialerSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  session.status = "stopped";
  return session;
}

export function getSession(sessionId: string): DialerSession | null {
  return sessions.get(sessionId) || null;
}

export function getCallIdFromSid(callSid: string): string | undefined {
  return callSidToCallId.get(callSid);
}
