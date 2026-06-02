import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startSession, getNextContact } from "@/lib/dialer/dialer-engine";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Defend against stale JWTs (e.g. after a DB reseed) — the user.id in the
  // token may no longer exist in the DB, which would later FK-violate when we
  // try to write a Call.
  const userExists = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });
  if (!userExists) {
    return NextResponse.json(
      { error: "Your session is stale (user no longer exists). Please log out and log back in." },
      { status: 401 },
    );
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
