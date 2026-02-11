import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { initiateCall } from "@/lib/dialer/dialer-engine";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { sessionId, contactId } = body;

    if (!sessionId || !contactId) {
      return NextResponse.json(
        { error: "sessionId and contactId are required" },
        { status: 400 }
      );
    }

    const result = await initiateCall(sessionId, contactId);

    return NextResponse.json({
      callId: result.callId,
      callSid: result.callSession.sid,
      status: result.callSession.status,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to initiate call";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
