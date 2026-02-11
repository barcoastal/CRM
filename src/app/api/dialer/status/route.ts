import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTelephonyProvider } from "@/lib/telephony";
import { getCallIdFromSid } from "@/lib/dialer/dialer-engine";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { callSid } = body;

    if (!callSid) {
      return NextResponse.json(
        { error: "callSid is required" },
        { status: 400 }
      );
    }

    const provider = getTelephonyProvider();
    const callStatus = await provider.getCallStatus(callSid);
    const callId = getCallIdFromSid(callSid);

    return NextResponse.json({
      callId,
      sid: callStatus.sid,
      status: callStatus.status,
      duration: callStatus.duration,
      to: callStatus.to,
      from: callStatus.from,
      startedAt: callStatus.startedAt,
      answeredAt: callStatus.answeredAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to get call status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
