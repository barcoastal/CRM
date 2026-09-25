import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVoiceSession } from "@/lib/call-center/auth";
import { tokenFor, requireConfigured } from "@/lib/call-center/twilio";
import {
  overview,
  heartbeat,
  prepareOutbound,
  ownedCall,
  endConference,
  holdCall,
  transfer,
  completeTransfer,
  cancelTransfer,
  monitor,
  disposition,
  saveQueue,
  leaveCall,
  VoiceError,
} from "@/lib/call-center/service";
import {
  saveWebSettings,
  saveColdCampaign,
  startSeat,
  stopSeat,
  lostSeat,
} from "@/lib/call-center/outbound";
import {
  qualifyCall,
  setCloserOpen,
  transferQualified,
  requestTransfer,
  reviewTransfer,
  closerReady,
  cancelTransferRequest,
} from "@/lib/call-center/sales";
export const runtime = "nodejs";
import { debtRowSchema } from "@/lib/call-center/qualification";
const id = z.string().min(1).max(100);
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("closer-open"), open: z.boolean() }),
  z.object({
    action: z.literal("qualify"),
    id,
    debts: z.array(debtRowSchema).min(1).max(100),
    removedDebtIds: z.array(id).max(100).default([]),
    notes: z.string().trim().min(1).max(10000),
  }),
  z.object({
    action: z.literal("qualified-transfer"),
    id,
    target: id.optional(),
  }),
  z.object({ action: z.literal("request-transfer"), id }),
  z.object({ action: z.literal("cancel-transfer-request"), id }),
  z.object({
    action: z.literal("review-transfer"),
    id,
    requestKey: id,
    approve: z.boolean(),
    target: id.optional(),
    reason: z.string().trim().max(1000).optional(),
  }),
  z.object({ action: z.literal("closer-ready"), id, requestKey: id }),
  z.object({ action: z.literal("token") }),
  z.object({ action: z.literal("join-outbound") }),
  z.object({ action: z.literal("seat-lost"), key: id }),
  z.object({
    action: z.literal("leave-outbound"),
    key: z.string().max(100).optional(),
  }),
  z.object({
    action: z.literal("web-routing"),
    enabled: z.boolean(),
    members: z.array(id).max(200),
    ownerFirst: z.boolean(),
  }),
  z.object({
    action: z.literal("cold-campaign"),
    campaignId: id,
    running: z.boolean(),
    maxLines: z.number().int().min(1).max(100),
    lineScope: z.literal("TEAM").default("TEAM"),
  }),
  z.object({
    action: z.literal("heartbeat"),
    status: z.enum(["AVAILABLE", "PAUSED", "OFFLINE"]).optional(),
  }),
  z.object({
    action: z.literal("dial"),
    phone: z.string().max(40).optional(),
    leadId: id.optional(),
    accountId: id.optional(),
    opportunityId: id.optional(),
    campaignId: id.optional(),
  }),
  z.object({ action: z.literal("hangup"), id }),
  z.object({ action: z.literal("leave"), id }),
  z.object({ action: z.literal("hold"), id, held: z.boolean() }),
  z.object({ action: z.literal("transfer"), id, target: id }),
  z.object({ action: z.literal("complete-transfer"), id }),
  z.object({ action: z.literal("cancel-transfer"), id }),
  z.object({
    action: z.literal("monitor"),
    id,
    mode: z.enum(["LISTEN", "WHISPER", "BARGE"]),
  }),
  z.object({
    action: z.literal("disposition"),
    id,
    value: z.string().max(40),
    notes: z.string().max(10000),
    callbackAt: z.string().max(50).optional(),
  }),
  z.object({
    action: z.literal("queue"),
    id: id.optional(),
    name: z.string().trim().min(1).max(80),
    phone: z.string().max(40),
    members: z.array(id).max(200),
    enabled: z.boolean(),
    greeting: z.string().min(1).max(500),
    maxWaitSeconds: z.number().int().min(30).max(900),
  }),
]);
export async function GET() {
  const auth = await requireVoiceSession();
  if ("response" in auth) return auth.response;
  try {
    return NextResponse.json(await overview(auth.session), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Call center overview", error);
    return NextResponse.json(
      {
        error:
          "Call center is unavailable. Check the database migration and configuration.",
      },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  const auth = await requireVoiceSession();
  if ("response" in auth) return auth.response;
  const origin = request.headers.get("origin");
  if (
    origin &&
    origin !== new URL(request.url).origin &&
    origin !== process.env.CALL_CENTER_PUBLIC_URL?.replace(/\/$/, "")
  )
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const input = schema.parse(await request.json());
    const s = auth.session;
    requireConfigured();
    if (input.action === "closer-open") await setCloserOpen(s, input.open);
    if (input.action === "qualify") await qualifyCall(s, input);
    if (input.action === "request-transfer") await requestTransfer(s, input.id);
    if (input.action === "cancel-transfer-request")
      await cancelTransferRequest(s, input.id);
    if (input.action === "review-transfer") await reviewTransfer(s, input);
    if (input.action === "closer-ready")
      await closerReady(s, input.id, input.requestKey);
    if (input.action === "qualified-transfer")
      await transferQualified(s, input.id, input.target);
    if (input.action === "join-outbound")
      return NextResponse.json({ standbyKey: await startSeat(s) });
    if (input.action === "leave-outbound") await stopSeat(s, input.key);
    if (input.action === "seat-lost") await lostSeat(s, input.key);
    if (input.action === "web-routing") await saveWebSettings(s, input);
    if (input.action === "cold-campaign") await saveColdCampaign(s, input);
    if (input.action === "token")
      return NextResponse.json(
        { token: tokenFor(s.userId) },
        { headers: { "Cache-Control": "no-store" } },
      );
    if (input.action === "heartbeat") await heartbeat(s, input.status);
    if (input.action === "dial")
      return NextResponse.json({ call: await prepareOutbound(s, input) });
    if (input.action === "hangup") {
      await ownedCall(s, input.id);
      await endConference(input.id);
    }
    if (input.action === "leave") await leaveCall(s, input.id);
    if (input.action === "hold") await holdCall(s, input.id, input.held);
    if (input.action === "transfer") await transfer(s, input.id, input.target);
    if (input.action === "complete-transfer")
      await completeTransfer(s, input.id);
    if (input.action === "cancel-transfer") await cancelTransfer(s, input.id);
    if (input.action === "monitor")
      return NextResponse.json({
        call: await monitor(s, input.id, input.mode),
      });
    if (input.action === "disposition")
      await disposition(
        s,
        input.id,
        input.value,
        input.notes,
        input.callbackAt,
      );
    if (input.action === "queue")
      return NextResponse.json({ queue: await saveQueue(s, input) });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return NextResponse.json(
        { error: "Invalid request. Check all required fields." },
        { status: 400 },
      );
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Call center request failed",
      },
      { status: error instanceof VoiceError ? error.status : 503 },
    );
  }
}
