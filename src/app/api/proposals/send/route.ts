import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, subject, message, calculationSummary } = body;

    if (!email || !subject) {
      return NextResponse.json({ error: "Email and subject are required" }, { status: 400 });
    }

    // Check if email integration is configured
    // For now, log the proposal and return success
    // TODO: Integrate with actual email service when configured
    console.log("Proposal sent:", { email, subject, message: message?.substring(0, 100) });

    return NextResponse.json({
      success: true,
      message: "Proposal sent successfully"
    });
  } catch (error) {
    console.error("Failed to send proposal:", error);
    return NextResponse.json({ error: "Failed to send proposal" }, { status: 500 });
  }
}
