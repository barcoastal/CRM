import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createFeedbackService } from "@/lib/ai";
import type { TranscriptEntry } from "@/lib/ai/types";

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

    const feedback = await prisma.callFeedback.findUnique({
      where: { callId: id },
    });

    if (!feedback) {
      return NextResponse.json(
        { error: "Feedback not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: feedback.id,
      callId: feedback.callId,
      agentId: feedback.agentId,
      overallScore: feedback.overallScore,
      talkRatio: feedback.talkRatio,
      objectionHandling: feedback.objectionHandling,
      closingAttempt: feedback.closingAttempt,
      keyMoments: feedback.keyMoments ? JSON.parse(feedback.keyMoments) : [],
      improvements: feedback.improvements
        ? JSON.parse(feedback.improvements)
        : [],
      strengths: feedback.strengths ? JSON.parse(feedback.strengths) : [],
      createdAt: feedback.createdAt,
    });
  } catch (error) {
    console.error("Feedback GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch feedback" },
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

    // Check if feedback already exists
    const existing = await prisma.callFeedback.findUnique({
      where: { callId: id },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Feedback already exists for this call" },
        { status: 409 }
      );
    }

    // Get the transcript (required for feedback generation)
    const transcript = await prisma.transcript.findUnique({
      where: { callId: id },
    });

    if (!transcript) {
      return NextResponse.json(
        {
          error:
            "Transcript not found. Generate a transcript first before requesting feedback.",
        },
        { status: 400 }
      );
    }

    const entries: TranscriptEntry[] = JSON.parse(transcript.content);

    // Generate mock feedback
    const feedbackService = createFeedbackService();
    const feedbackData = feedbackService.generateFeedback(entries);

    const feedback = await prisma.callFeedback.create({
      data: {
        callId: id,
        agentId: call.agentId,
        overallScore: feedbackData.overallScore,
        talkRatio: feedbackData.talkRatio,
        objectionHandling: feedbackData.objectionHandling,
        closingAttempt: feedbackData.closingAttempt,
        keyMoments: JSON.stringify(feedbackData.keyMoments),
        improvements: JSON.stringify(feedbackData.improvements),
        strengths: JSON.stringify(feedbackData.strengths),
      },
    });

    return NextResponse.json(
      {
        id: feedback.id,
        callId: feedback.callId,
        agentId: feedback.agentId,
        overallScore: feedback.overallScore,
        talkRatio: feedback.talkRatio,
        objectionHandling: feedback.objectionHandling,
        closingAttempt: feedback.closingAttempt,
        keyMoments: feedbackData.keyMoments,
        improvements: feedbackData.improvements,
        strengths: feedbackData.strengths,
        summary: feedbackData.summary,
        createdAt: feedback.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Feedback POST error:", error);
    return NextResponse.json(
      { error: "Failed to generate feedback" },
      { status: 500 }
    );
  }
}
