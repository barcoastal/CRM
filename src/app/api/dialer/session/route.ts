import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSession } from "@/lib/dialer/dialer-engine";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sessionId = request.nextUrl.searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId query parameter is required" },
        { status: 400 }
      );
    }

    const dialerSession = getSession(sessionId);

    if (!dialerSession) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ session: dialerSession });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to get session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
