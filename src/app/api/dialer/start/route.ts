import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { startSession, getNextContact } from "@/lib/dialer/dialer-engine";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { campaignId } = body;

    if (!campaignId) {
      return NextResponse.json(
        { error: "campaignId is required" },
        { status: 400 }
      );
    }

    const dialerSession = startSession(campaignId, session.user.id);
    const firstContact = await getNextContact(dialerSession.id);

    return NextResponse.json({
      session: dialerSession,
      contact: firstContact,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start dialer";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
