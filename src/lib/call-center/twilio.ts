import twilio from "twilio";
import { identity } from "./model";

export const nativeDialerEnabled = () =>
  process.env.CRM_DIALER_MODE === "twilio";
const required = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_API_KEY",
  "TWILIO_API_SECRET",
  "TWILIO_TWIML_APP_SID",
  "TWILIO_OUTBOUND_NUMBER",
  "CALL_CENTER_PUBLIC_URL",
] as const;
export function configuration() {
  const missing = required.filter((key) => !process.env[key]?.trim());
  let validUrl = false;
  try {
    const u = new URL(process.env.CALL_CENTER_PUBLIC_URL || "");
    validUrl =
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      u.pathname === "/" &&
      !u.search &&
      !u.hash;
  } catch {}
  if (!validUrl && !missing.includes("CALL_CENTER_PUBLIC_URL"))
    missing.push("CALL_CENTER_PUBLIC_URL");
  return {
    enabled: nativeDialerEnabled(),
    ready: missing.length === 0,
    missing,
    recording: process.env.CALL_CENTER_RECORD_CALLS === "true",
  };
}
export function requireConfigured() {
  const config = configuration();
  if (!config.enabled || !config.ready)
    throw new Error(
      "Calling is not enabled. An administrator must finish Twilio setup.",
    );
}
export function client() {
  requireConfigured();
  return twilio(process.env.TWILIO_API_KEY!, process.env.TWILIO_API_SECRET!, {
    accountSid: process.env.TWILIO_ACCOUNT_SID!,
    timeout: 15000,
    autoRetry: false,
  });
}
export function webhookUrl(kind: string, params: Record<string, string> = {}) {
  const url = new URL(
    `/api/call-center/webhook/${kind}`,
    process.env.CALL_CENTER_PUBLIC_URL!,
  );
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, value);
  return url.toString();
}
export function tokenFor(userId: string) {
  requireConfigured();
  const token = new twilio.jwt.AccessToken(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_API_KEY!,
    process.env.TWILIO_API_SECRET!,
    { identity: identity(userId), ttl: 3600 },
  );
  token.addGrant(
    new twilio.jwt.AccessToken.VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID!,
      incomingAllow: true,
    }),
  );
  return token.toJwt();
}
export async function signedPayload(request: Request) {
  requireConfigured();
  const params = Object.fromEntries(new URLSearchParams(await request.text()));
  const incoming = new URL(request.url);
  const canonical = new URL(
    incoming.pathname + incoming.search,
    process.env.CALL_CENTER_PUBLIC_URL!,
  ).toString();
  if (
    !twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN!,
      request.headers.get("x-twilio-signature") || "",
      canonical,
      params,
    ) ||
    params.AccountSid !== process.env.TWILIO_ACCOUNT_SID
  )
    throw new Error("Invalid Twilio signature");
  return params;
}
export function conferenceXml(
  id: string,
  role: "CUSTOMER" | "AGENT" | "TRANSFER" | "MONITOR",
  mode?: string,
  coachSid?: string,
  returnTo?: string,
) {
  const response = new twilio.twiml.VoiceResponse();
  response
    .dial(returnTo ? { action: returnTo, method: "POST" } : {})
    .conference(
      {
        participantLabel: role === "CUSTOMER" ? "customer" : undefined,
        startConferenceOnEnter: role !== "CUSTOMER",
        endConferenceOnExit: role === "CUSTOMER",
        beep: "false",
        muted: mode === "LISTEN",
        coach: mode === "WHISPER" ? coachSid : undefined,
        statusCallback: webhookUrl("conference", { id }),
        statusCallbackMethod: "POST",
        statusCallbackEvent: ["start", "end", "join", "leave"],
        record: configuration().recording
          ? "record-from-start"
          : "do-not-record",
        recordingStatusCallback: webhookUrl("recording", { id }),
        recordingStatusCallbackEvent: ["completed"],
      },
      `crm_${id}`,
    );
  return response.toString();
}
export function hangupXml() {
  const response = new twilio.twiml.VoiceResponse();
  response.hangup();
  return response.toString();
}
