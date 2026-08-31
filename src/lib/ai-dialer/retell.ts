import crypto from "node:crypto";

const API_BASE = "https://api.retellai.com";

export type RetellCall = {
  call_id: string;
  call_status?: string;
  agent_id?: string;
  from_number?: string;
  to_number?: string;
  start_timestamp?: number;
  end_timestamp?: number;
  duration_ms?: number;
  disconnection_reason?: string;
  transcript?: string;
  metadata?: Record<string, unknown>;
  call_analysis?: Record<string, unknown>;
};

export async function createRetellCall(args: {
  fromNumber: string;
  toNumber: string;
  agentId: string;
  metadata: Record<string, string>;
  dynamicVariables: Record<string, string>;
}): Promise<RetellCall> {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) throw new Error("RETELL_API_KEY is not configured");
  const response = await fetch(`${API_BASE}/v2/create-phone-call`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from_number: args.fromNumber,
      to_number: args.toNumber,
      override_agent_id: args.agentId,
      override_agent_version: "latest_published",
      metadata: args.metadata,
      retell_llm_dynamic_variables: args.dynamicVariables,
    }),
  });
  const data = await response.json().catch(() => ({})) as RetellCall & { message?: string };
  if (!response.ok) throw new Error(`Retell: ${data.message ?? `HTTP ${response.status}`}`);
  if (!data.call_id) throw new Error("Retell did not return a call_id");
  return data;
}

export function verifyRetellWebhook(rawBody: string, signature: string | null): boolean {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey || !signature) return false;
  const match = signature.match(/^v=(\d+),d=([a-fA-F0-9]+)$/);
  if (!match || Math.abs(Date.now() - Number(match[1])) > 5 * 60_000) return false;
  const expected = crypto.createHmac("sha256", apiKey).update(rawBody + match[1]).digest("hex");
  const received = match[2].toLowerCase();
  return expected.length === received.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

export function outcomeFromRetell(call: RetellCall): string | null {
  const analysis = call.call_analysis ?? {};
  const custom = (analysis.custom_analysis_data ?? {}) as Record<string, unknown>;
  if (custom.do_not_call === true) return "DNC";
  if (custom.meeting_booked === true) return "MEETING_BOOKED";
  if (custom.transferred === true) return "TRANSFERRED";
  if (custom.qualified === true) return "QUALIFIED";
  if (custom.qualified === false) return "NOT_QUALIFIED";
  const reason = call.disconnection_reason ?? "";
  if (reason.includes("no_answer")) return "NO_ANSWER";
  if (reason.includes("voicemail")) return "VOICEMAIL";
  return null;
}
