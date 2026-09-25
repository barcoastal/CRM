import { prisma } from "@/lib/prisma";
import { client, configuration } from "./twilio";
import { endConference, finishCall } from "./service";
import { dispatchOutbound, failBeforeDial, noteAbandonment } from "./outbound";

let running = false;
export async function reconcileCalls() {
  if (running || !configuration().enabled || !configuration().ready) return;
  running = true;
  try {
    const calls = await prisma.voiceCall.findMany({
      where: { endedAt: null },
      include: { queue: true, participants: true },
      orderBy: { updatedAt: "asc" },
      take: 100,
    });
    for (const call of calls) {
      try {
        const age = (Date.now() - call.createdAt.getTime()) / 1000;
        if (
          call.workflow === "WEB" &&
          !call.customerDialStarted &&
          age > 15 &&
          !call.endedAt
        ) {
          await endConference(call.id, "FAILED");
          await failBeforeDial(
            call.id,
            "Agent audio was not ready; returned to the priority queue",
          );
          continue;
        }
        if (
          call.workflow === "COLD" &&
          call.humanDetectedAt &&
          !call.bridgedAt &&
          age > 45
        ) {
          await noteAbandonment(
            call.id,
            "Answered call never reached an agent",
          );
          await endConference(call.id, "ABANDONED");
          continue;
        }
        if (
          call.direction === "INBOUND" &&
          !call.answeredAt &&
          age > (call.queue?.maxWaitSeconds || 180)
        ) {
          await endConference(call.id, "ABANDONED");
        } else if (
          call.status === "CONNECTING" &&
          age > 90 &&
          !call.answeredAt
        ) {
          await endConference(call.id, "FAILED");
        } else if (call.conferenceSid) {
          const conference = await client()
            .conferences(call.conferenceSid)
            .fetch();
          if (conference.status === "completed")
            await finishCall(
              call.id,
              call.answeredAt ? "COMPLETED" : "NO_ANSWER",
            );
        } else if (call.customerSid) {
          const customer = await client().calls(call.customerSid).fetch();
          if (
            ["completed", "failed", "busy", "no-answer", "canceled"].includes(
              customer.status,
            )
          )
            await endConference(
              call.id,
              call.answeredAt ? "COMPLETED" : "ABANDONED",
            );
        }
        await prisma.voiceCall.update({
          where: { id: call.id },
          data: { updatedAt: new Date() },
        });
      } catch (error) {
        console.error(
          "Voice reconciliation failed",
          call.id,
          error instanceof Error ? error.message : "Unknown error",
        );
      }
    }
  } finally {
    running = false;
  }
}
const globalVoice = globalThis as unknown as {
  voiceTimer?: ReturnType<typeof setInterval>;
  outboundTimer?: ReturnType<typeof setInterval>;
};
export function scheduleVoiceReconciliation() {
  if (
    globalVoice.voiceTimer ||
    !configuration().enabled ||
    !configuration().ready
  )
    return;
  globalVoice.voiceTimer = setInterval(() => {
    void reconcileCalls().catch((error) =>
      console.error("Voice reconciliation", error),
    );
  }, 15_000);
  globalVoice.voiceTimer.unref();
  globalVoice.outboundTimer = setInterval(() => {
    void dispatchOutbound().catch((error) =>
      console.error(
        "Outbound dispatch",
        error instanceof Error ? error.message : "Unknown error",
      ),
    );
  }, 1000);
  globalVoice.outboundTimer.unref();
}
