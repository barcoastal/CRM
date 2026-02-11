import {
  CallSession,
  CallSessionStatus,
  CallStatusCallback,
  TelephonyProvider,
} from "./types";

function generateId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function randomDelay(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

export class MockTelephonyProvider implements TelephonyProvider {
  private activeCalls = new Map<string, CallSession>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private statusCallback?: CallStatusCallback;
  private holdState = new Map<string, boolean>();
  private muteState = new Map<string, boolean>();

  constructor(statusCallback?: CallStatusCallback) {
    this.statusCallback = statusCallback;
  }

  setStatusCallback(callback: CallStatusCallback): void {
    this.statusCallback = callback;
  }

  async makeCall(params: {
    to: string;
    from: string;
    agentId: string;
  }): Promise<CallSession> {
    const sid = `mock-call-${generateId()}`;
    const session: CallSession = {
      sid,
      status: "initiated",
      duration: 0,
      to: params.to,
      from: params.from,
      startedAt: new Date(),
    };

    this.activeCalls.set(sid, session);
    this.holdState.set(sid, false);
    this.muteState.set(sid, false);

    this.notifyStatus(sid, "initiated");

    // Simulate progression: initiated -> ringing after 1-2s
    const ringingDelay = randomDelay(1000, 2000);
    const ringingTimer = setTimeout(() => {
      const call = this.activeCalls.get(sid);
      if (!call || call.status === "completed") return;

      call.status = "ringing";
      this.notifyStatus(sid, "ringing");

      // After ringing for 2-4s, determine outcome
      const answerDelay = randomDelay(2000, 4000);
      const outcomeTimer = setTimeout(() => {
        const currentCall = this.activeCalls.get(sid);
        if (!currentCall || currentCall.status === "completed") return;

        const outcome = this.determineOutcome();
        currentCall.status = outcome;

        if (outcome === "in-progress") {
          currentCall.answeredAt = new Date();
        }

        this.notifyStatus(sid, outcome);

        // If not answered, clean up after a moment
        if (outcome !== "in-progress") {
          setTimeout(() => {
            this.activeCalls.delete(sid);
            this.holdState.delete(sid);
            this.muteState.delete(sid);
          }, 5000);
        }
      }, answerDelay);

      this.timers.set(`${sid}-outcome`, outcomeTimer);
    }, ringingDelay);

    this.timers.set(`${sid}-ringing`, ringingTimer);

    return { ...session };
  }

  async endCall(callSid: string): Promise<void> {
    const call = this.activeCalls.get(callSid);
    if (!call) return;

    // Calculate duration if the call was answered
    if (call.answeredAt) {
      call.duration = Math.floor(
        (Date.now() - call.answeredAt.getTime()) / 1000
      );
    }

    call.status = "completed";
    this.notifyStatus(callSid, "completed");

    // Clear any pending timers
    this.clearTimersForCall(callSid);

    // Clean up after a moment
    setTimeout(() => {
      this.activeCalls.delete(callSid);
      this.holdState.delete(callSid);
      this.muteState.delete(callSid);
    }, 5000);
  }

  async holdCall(callSid: string): Promise<void> {
    const call = this.activeCalls.get(callSid);
    if (!call || call.status !== "in-progress") {
      throw new Error("Call is not in progress");
    }
    this.holdState.set(callSid, true);
  }

  async resumeCall(callSid: string): Promise<void> {
    const call = this.activeCalls.get(callSid);
    if (!call || call.status !== "in-progress") {
      throw new Error("Call is not in progress");
    }
    this.holdState.set(callSid, false);
  }

  async muteCall(callSid: string): Promise<void> {
    const call = this.activeCalls.get(callSid);
    if (!call || call.status !== "in-progress") {
      throw new Error("Call is not in progress");
    }
    this.muteState.set(callSid, true);
  }

  async unmuteCall(callSid: string): Promise<void> {
    const call = this.activeCalls.get(callSid);
    if (!call || call.status !== "in-progress") {
      throw new Error("Call is not in progress");
    }
    this.muteState.set(callSid, false);
  }

  async getCallStatus(callSid: string): Promise<CallSession> {
    const call = this.activeCalls.get(callSid);
    if (!call) {
      throw new Error(`Call ${callSid} not found`);
    }

    // Recalculate duration for in-progress calls
    if (call.status === "in-progress" && call.answeredAt) {
      call.duration = Math.floor(
        (Date.now() - call.answeredAt.getTime()) / 1000
      );
    }

    return { ...call };
  }

  getRecordingUrl(callSid: string): string {
    return `https://mock-recordings.coastal-crm.dev/${callSid}/recording.mp3`;
  }

  private determineOutcome(): CallSessionStatus {
    const roll = Math.random();
    if (roll < 0.6) return "in-progress"; // 60% answered
    if (roll < 0.8) return "no-answer"; // 20% no answer
    if (roll < 0.9) return "busy"; // 10% busy
    return "voicemail"; // 10% voicemail
  }

  private notifyStatus(sid: string, status: CallSessionStatus): void {
    if (this.statusCallback) {
      try {
        this.statusCallback(sid, status);
      } catch {
        // Ignore callback errors
      }
    }
  }

  private clearTimersForCall(callSid: string): void {
    const ringingTimer = this.timers.get(`${callSid}-ringing`);
    if (ringingTimer) {
      clearTimeout(ringingTimer);
      this.timers.delete(`${callSid}-ringing`);
    }

    const outcomeTimer = this.timers.get(`${callSid}-outcome`);
    if (outcomeTimer) {
      clearTimeout(outcomeTimer);
      this.timers.delete(`${callSid}-outcome`);
    }
  }
}
