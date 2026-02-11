import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { submitDisposition } from "@/lib/dialer/dialer-engine";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { callId, disposition, notes, nextFollowUp } = body;

    if (!callId || !disposition) {
      return NextResponse.json(
        { error: "callId and disposition are required" },
        { status: 400 }
      );
    }

    await submitDisposition(callId, disposition, notes || null, nextFollowUp);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to submit disposition";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
