import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTranscriptionService } from "@/lib/ai";

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
      select: { agentId: true },
    });

    if (!call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    const userRole = session.user.role;
    const isManagerOrAdmin = userRole === "MANAGER" || userRole === "ADMIN";
    if (!isManagerOrAdmin && call.agentId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const transcript = await prisma.transcript.findUnique({
      where: { callId: id },
    });

    if (!transcript) {
      return NextResponse.json(
        { error: "Transcript not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: transcript.id,
      callId: transcript.callId,
      entries: JSON.parse(transcript.content),
      summary: transcript.summary,
      keywords: transcript.keywords ? JSON.parse(transcript.keywords) : [],
      sentiment: transcript.sentiment,
      createdAt: transcript.createdAt,
    });
  } catch (error) {
    console.error("Transcript GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transcript" },
      { status: 500 }
    );
  }
}

export async function POST(
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
      select: { agentId: true, duration: true },
    });

    if (!call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    const userRole = session.user.role;
    const isManagerOrAdmin = userRole === "MANAGER" || userRole === "ADMIN";
    if (!isManagerOrAdmin && call.agentId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if transcript already exists
    const existing = await prisma.transcript.findUnique({
      where: { callId: id },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Transcript already exists for this call" },
        { status: 409 }
      );
    }

    // Generate mock transcript
    const duration = call.duration || 180; // default 3 minutes
    const transcriptionService = createTranscriptionService();
    const entries = transcriptionService.getTranscriptForCall(duration);

    // Extract keywords from the transcript
    const allText = entries.map((e) => e.text).join(" ").toLowerCase();
    const keywordCandidates = [
      "debt", "settlement", "payment", "creditor", "balance",
      "interest", "collection", "enrollment", "analysis", "fee",
    ];
    const keywords = keywordCandidates.filter((kw) => allText.includes(kw));

    // Simple sentiment analysis based on outcome
    const leadTexts = entries
      .filter((e) => e.speaker === "lead")
      .map((e) => e.text.toLowerCase())
      .join(" ");
    let sentiment: string = "neutral";
    if (
      leadTexts.includes("let's do it") ||
      leadTexts.includes("sounds good") ||
      leadTexts.includes("interested") ||
      leadTexts.includes("move forward")
    ) {
      sentiment = "positive";
    } else if (
      leadTexts.includes("not interested") ||
      leadTexts.includes("don't call") ||
      leadTexts.includes("stop calling")
    ) {
      sentiment = "negative";
    }

    // Generate summary from first and last entries
    const summary = `Call transcript with ${entries.length} exchanges over ${Math.round(duration / 60)} minutes. ${
      sentiment === "positive"
        ? "The lead showed interest in the debt settlement program."
        : sentiment === "negative"
          ? "The lead declined the offer."
          : "The conversation covered the debt settlement program overview."
    }`;

    const transcript = await prisma.transcript.create({
      data: {
        callId: id,
        content: JSON.stringify(entries),
        summary,
        keywords: JSON.stringify(keywords),
        sentiment,
      },
    });

    return NextResponse.json(
      {
        id: transcript.id,
        callId: transcript.callId,
        entries,
        summary: transcript.summary,
        keywords,
        sentiment: transcript.sentiment,
        createdAt: transcript.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Transcript POST error:", error);
    return NextResponse.json(
      { error: "Failed to generate transcript" },
      { status: 500 }
    );
  }
}
