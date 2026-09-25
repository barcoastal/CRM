import { signedPayload, hangupXml } from "@/lib/call-center/twilio";
import {
  inbound,
  join,
  conferenceEvent,
  customerStatus,
  agentStatus,
  recording,
} from "@/lib/call-center/webhooks";
import {
  coldAnswer,
  coldReady,
  standbyVoice,
} from "@/lib/call-center/outbound";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const { kind } = await params;
  let payload: Record<string, string>;
  try {
    payload = await signedPayload(request);
  } catch {
    return new Response("Forbidden", { status: 403 });
  }
  const query = new URL(request.url).searchParams;
  const id = query.get("id") || "";
  try {
    let xml: string | undefined;
    if (kind === "inbound") xml = await inbound(payload);
    else if (kind === "standby" || (kind === "voice" && payload.OutboundSeat))
      xml = await standbyVoice(payload, query, kind === "voice");
    else if (kind === "cold-answer") xml = await coldAnswer(payload, id);
    else if (kind === "cold-ready") xml = await coldReady(payload, id);
    else if (kind === "voice" || kind === "join")
      xml = await join(payload, query, kind === "voice");
    else if (kind === "conference") await conferenceEvent(payload, id);
    else if (kind === "customer-status")
      await customerStatus(payload, query.get("id"));
    else if (kind === "agent-status")
      await agentStatus(payload, id, query.get("userId") || "");
    else if (kind === "recording") await recording(payload, id);
    else return new Response("Not found", { status: 404 });
    return new Response(xml || "", {
      status: xml ? 200 : 204,
      headers: { "Content-Type": xml ? "text/xml" : "text/plain" },
    });
  } catch (error) {
    console.error(
      "Call center webhook failed",
      kind,
      error instanceof Error ? error.message : "Unknown failure",
    );
    if (
      [
        "voice",
        "join",
        "inbound",
        "standby",
        "cold-answer",
        "cold-ready",
      ].includes(kind)
    )
      return new Response(hangupXml(), {
        headers: { "Content-Type": "text/xml" },
      });
    return new Response("Retry", { status: 503 });
  }
}
