import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { scoreLead } from "@/lib/ai/agents/lead-scoring";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // --- Bulk scoring ---
    if (Array.isArray(body.leadIds)) {
      const leadIds: string[] = body.leadIds;

      if (leadIds.length === 0) {
        return NextResponse.json(
          { error: "leadIds array must not be empty" },
          { status: 400 }
        );
      }

      const leads = await prisma.lead.findMany({
        where: { id: { in: leadIds } },
        select: {
          id: true,
          totalDebtEst: true,
          annualRevenue: true,
          source: true,
          industry: true,
          email: true,
          ein: true,
        },
      });

      const results: { id: string; score: number; reason: string }[] = [];

      for (const lead of leads) {
        const { score, reason } = scoreLead(lead);

        await prisma.lead.update({
          where: { id: lead.id },
          data: { score, scoreReason: reason },
        });

        results.push({ id: lead.id, score, reason });
      }

      return NextResponse.json({ results });
    }

    // --- Single scoring ---
    const { leadId } = body;

    if (!leadId || typeof leadId !== "string") {
      return NextResponse.json(
        { error: "leadId (string) or leadIds (string[]) is required" },
        { status: 400 }
      );
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        totalDebtEst: true,
        annualRevenue: true,
        source: true,
        industry: true,
        email: true,
        ein: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const { score, reason } = scoreLead(lead);

    await prisma.lead.update({
      where: { id: lead.id },
      data: { score, scoreReason: reason },
    });

    return NextResponse.json({ score, reason });
  } catch (error) {
    console.error("Score lead error:", error);
    return NextResponse.json(
      { error: "Failed to score lead" },
      { status: 500 }
    );
  }
}
