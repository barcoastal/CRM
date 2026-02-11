import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTelephonyProvider } from "@/lib/telephony";

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
    await provider.endCall(callSid);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to end call";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
