import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const call = await prisma.call.findUnique({
      where: { id },
      include: {
        lead: true,
        agent: { select: { id: true, name: true, email: true } },
        campaign: { select: { id: true, name: true } },
        transcript: true,
        feedback: true,
      },
    });

    if (!call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    // Non-managers can only see their own calls
    const userRole = session.user.role;
    const isManagerOrAdmin = userRole === "MANAGER" || userRole === "ADMIN";
    if (!isManagerOrAdmin && call.agentId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(call);
  } catch (error) {
    console.error("Call detail error:", error);
    return NextResponse.json(
      { error: "Failed to fetch call" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { notes } = body;

    if (typeof notes !== "string") {
      return NextResponse.json(
        { error: "Notes must be a string" },
        { status: 400 }
      );
    }

    // Check call exists and user has access
    const existingCall = await prisma.call.findUnique({
      where: { id },
      select: { agentId: true },
    });

    if (!existingCall) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    const userRole = session.user.role;
    const isManagerOrAdmin = userRole === "MANAGER" || userRole === "ADMIN";
    if (!isManagerOrAdmin && existingCall.agentId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updatedCall = await prisma.call.update({
      where: { id },
      data: { notes },
    });

    return NextResponse.json(updatedCall);
  } catch (error) {
    console.error("Call update error:", error);
    return NextResponse.json(
      { error: "Failed to update call" },
      { status: 500 }
    );
  }
}
