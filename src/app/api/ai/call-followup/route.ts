import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { analyzeCallFollowUp } from "@/lib/ai/agents/call-follow-up";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { callId, apply } = body;

    if (!callId || typeof callId !== "string") {
      return NextResponse.json(
        { error: "callId (string) is required" },
        { status: 400 }
      );
    }

    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: {
        lead: {
          select: {
            id: true,
            contactName: true,
            businessName: true,
            notes: true,
          },
        },
      },
    });

    if (!call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    if (!call.lead) {
      return NextResponse.json(
        { error: "Call has no associated lead" },
        { status: 400 }
      );
    }

    const result = analyzeCallFollowUp({
      disposition: call.disposition,
      notes: call.notes,
      lead: {
        contactName: call.lead.contactName,
        businessName: call.lead.businessName,
      },
    });

    // Optionally apply the recommendation to the lead
    if (apply) {
      const updateData: Record<string, unknown> = {};

      if (result.followUpDate) {
        updateData.nextFollowUpAt = result.followUpDate;
      }

      // Append AI notes to existing lead notes
      const existingNotes = call.lead.notes || "";
      const separator = existingNotes ? "\n\n---\n\n" : "";
      updateData.notes = `${existingNotes}${separator}${result.autoNotes}`;

      // Update lead status based on disposition
      if (call.disposition === "ENROLLED") {
        updateData.status = "ENROLLED";
      } else if (call.disposition === "DNC") {
        updateData.status = "DNC";
      } else if (call.disposition === "CALLBACK") {
        updateData.status = "CALLBACK";
      }

      await prisma.lead.update({
        where: { id: call.lead.id },
        data: updateData,
      });
    }

    return NextResponse.json({
      suggestedAction: result.suggestedAction,
      followUpDate: result.followUpDate?.toISOString() ?? null,
      draftMessage: result.draftMessage,
      autoNotes: result.autoNotes,
    });
  } catch (error) {
    console.error("Call follow-up error:", error);
    return NextResponse.json(
      { error: "Failed to generate follow-up recommendations" },
      { status: 500 }
    );
  }
}
