import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getNextContact } from "@/lib/dialer/dialer-engine";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    const contact = await getNextContact(sessionId);

    return NextResponse.json({ contact });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to get next contact";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
