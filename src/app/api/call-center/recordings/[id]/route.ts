import { requireVoiceSession } from "@/lib/call-center/auth";
import { ownedCall } from "@/lib/call-center/service";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireVoiceSession("Call.ListenRecording");
  if ("response" in auth) return auth.response;
  try {
    const call = await ownedCall(auth.session, (await params).id, true);
    if (!call.recordingSid)
      return new Response("Recording not available", { status: 404 });
    const upstream = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Recordings/${call.recordingSid}.mp3`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_API_KEY}:${process.env.TWILIO_API_SECRET}`).toString("base64")}`,
        },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!upstream.ok)
      return new Response("Recording temporarily unavailable", { status: 502 });
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("Recording not accessible", { status: 403 });
  }
}
