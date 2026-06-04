/**
 * Twilio Voice provider.
 *
 * Initiates an outbound call via Twilio's REST API. Twilio dials the
 * customer (To) first, then bridges them to the agent. The agent leg is
 * configured via the TwiML at /api/twilio/voice/agent-leg, which uses
 * <Dial> to ring the agent's softphone (Twilio Voice SDK client) or PSTN.
 *
 * Env:
 *   TWILIO_ACCOUNT_SID=AC...
 *   TWILIO_AUTH_TOKEN=...
 *   TWILIO_VOICE_FROM=+18005551234           (caller ID shown to customer)
 *   TWILIO_VOICE_AGENT_URL=https://crm.../api/twilio/voice/agent-leg
 *      → returns TwiML that dials the agent (your call center / browser softphone)
 *   TWILIO_VOICE_STATUS_URL=https://crm.../api/twilio/voice/status
 *      → status callbacks (ringing / in-progress / completed)
 *   TWILIO_VOICE_RECORDING_URL=https://crm.../api/twilio/voice/recording
 *      → recording-complete callbacks
 *   TWILIO_VOICE_RECORD=true | false         (record by default; default true)
 */

import type {
  CallSession,
  CallSessionStatus,
  TelephonyProvider,
} from "./types";

function getEnv() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_VOICE_FROM;
  const agentUrl = process.env.TWILIO_VOICE_AGENT_URL;
  if (!sid || !token || !from || !agentUrl) {
    throw new Error("Twilio Voice env missing — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VOICE_FROM, TWILIO_VOICE_AGENT_URL");
  }
  return {
    sid,
    token,
    from,
    agentUrl,
    statusUrl: process.env.TWILIO_VOICE_STATUS_URL ?? null,
    recordingUrl: process.env.TWILIO_VOICE_RECORDING_URL ?? null,
    record: (process.env.TWILIO_VOICE_RECORD ?? "true").toLowerCase() === "true",
  };
}

function toE164(raw: string): string {
  const t = raw.trim();
  if (t.startsWith("+")) return t.replace(/\s+/g, "");
  const d = t.replace(/[^0-9]/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return `+${d}`;
}

function mapTwilioStatus(s: string): CallSessionStatus {
  switch (s.toLowerCase()) {
    case "queued":
    case "initiated":
      return "initiated";
    case "ringing":
      return "ringing";
    case "in-progress":
    case "answered":
      return "in-progress";
    case "completed":
      return "completed";
    case "busy":
      return "busy";
    case "no-answer":
      return "no-answer";
    case "failed":
    case "canceled":
      return "failed";
    default:
      return "initiated";
  }
}

async function twilioApi(path: string, sid: string, token: string, init: { method: string; body?: URLSearchParams }) {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}${path}`, {
    method: init.method,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
    },
    body: init.body?.toString(),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.message as string) ?? `HTTP ${res.status}`;
    throw new Error(`Twilio: ${msg}`);
  }
  return data;
}

export class TwilioTelephonyProvider implements TelephonyProvider {
  async makeCall(params: { to: string; from: string; agentId: string }): Promise<CallSession> {
    const env = getEnv();
    const form = new URLSearchParams();
    form.set("To", toE164(params.to));
    form.set("From", toE164(params.from || env.from));
    // The agent-leg TwiML decides how to ring the agent (softphone client name,
    // PSTN number, etc.). We pass agentId as query so the TwiML can switch.
    form.set("Url", `${env.agentUrl}?agentId=${encodeURIComponent(params.agentId)}`);
    if (env.statusUrl) {
      form.set("StatusCallback", env.statusUrl);
      form.set("StatusCallbackMethod", "POST");
      ["initiated", "ringing", "answered", "completed"].forEach((e) => form.append("StatusCallbackEvent", e));
    }
    if (env.record) {
      form.set("Record", "true");
      form.set("RecordingChannels", "dual");
      if (env.recordingUrl) {
        form.set("RecordingStatusCallback", env.recordingUrl);
        form.set("RecordingStatusCallbackMethod", "POST");
      }
    }
    const data = await twilioApi(`/Calls.json`, env.sid, env.token, { method: "POST", body: form });

    return {
      sid: String(data.sid),
      status: mapTwilioStatus(String(data.status ?? "initiated")),
      duration: 0,
      to: String(data.to ?? params.to),
      from: String(data.from ?? params.from),
      startedAt: data.start_time ? new Date(String(data.start_time)) : new Date(),
    };
  }

  async getCallStatus(callSid: string): Promise<CallSession> {
    const env = getEnv();
    const data = await twilioApi(`/Calls/${callSid}.json`, env.sid, env.token, { method: "GET" });
    return {
      sid: String(data.sid),
      status: mapTwilioStatus(String(data.status ?? "initiated")),
      duration: Number(data.duration ?? 0),
      to: String(data.to ?? ""),
      from: String(data.from ?? ""),
      startedAt: data.start_time ? new Date(String(data.start_time)) : new Date(),
      answeredAt: data.start_time ? new Date(String(data.start_time)) : undefined,
    };
  }

  async endCall(callSid: string): Promise<void> {
    const env = getEnv();
    const form = new URLSearchParams();
    form.set("Status", "completed");
    await twilioApi(`/Calls/${callSid}.json`, env.sid, env.token, { method: "POST", body: form });
  }

  async holdCall(callSid: string): Promise<void> {
    // Hold = redirect customer leg to play hold music. We use the same
    // pattern Twilio recommends: <Play loop="0">https://demo.twilio.com/docs/classic.mp3</Play>
    const env = getEnv();
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Play loop="0">https://demo.twilio.com/docs/classic.mp3</Play></Response>`;
    const form = new URLSearchParams();
    form.set("Twiml", twiml);
    await twilioApi(`/Calls/${callSid}.json`, env.sid, env.token, { method: "POST", body: form });
  }

  async resumeCall(callSid: string): Promise<void> {
    // Redirect back to the agent-leg URL to re-bridge
    const env = getEnv();
    const form = new URLSearchParams();
    form.set("Url", env.agentUrl);
    await twilioApi(`/Calls/${callSid}.json`, env.sid, env.token, { method: "POST", body: form });
  }

  async muteCall(callSid: string): Promise<void> {
    // Twilio doesn't expose mute on REST for outbound calls — this is
    // handled on the agent's Voice SDK client. Server-side no-op.
    void callSid;
  }

  async unmuteCall(callSid: string): Promise<void> {
    void callSid;
  }
}
