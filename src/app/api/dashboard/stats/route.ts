import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function getMonday(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? 6 : day - 1; // Monday = 0 offset
  date.setDate(date.getDate() - diff);
  return date;
}

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user as { role?: string }).role;
  const userId = session.user.id;
  const isManagerOrAdmin = userRole === "MANAGER" || userRole === "ADMIN";

  const agentFilter = isManagerOrAdmin ? {} : { agentId: userId };
  const leadFilter = isManagerOrAdmin ? {} : { assignedToId: userId };

  // Parse date range for filtered section
  const searchParams = request.nextUrl.searchParams;
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const now = new Date();
  const rangeFrom = fromParam ? new Date(fromParam) : new Date(now.getFullYear(), now.getMonth(), 1);
  const rangeTo = toParam ? new Date(new Date(toParam).getTime() + 86400000) : new Date(now.getTime() + 86400000); // end of day

  // Fixed dates (always the same, not affected by date range)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = getMonday(now); // Monday start
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  try {
    // Fixed lead counts + filtered data in parallel
    const [
      leadsToday,
      leadsThisWeek,
      leadsThisMonth,
      // Filtered data below
      settledDebtsData,
      activeClientsCount,
      atRiskClientsCount,
      activeCampaigns,
      callsInRange,
      enrollmentsInRange,
      leadsByStatusRaw,
      recentCalls,
      agentLeaderboardRaw,
      openOpportunities,
      wonOpportunitiesInRange,
    ] = await Promise.all([
      // FIXED: Leads today
      prisma.lead.count({
        where: { ...leadFilter, createdAt: { gte: startOfToday } },
      }),
      // FIXED: Leads this week (WTD, Monday start)
      prisma.lead.count({
        where: { ...leadFilter, createdAt: { gte: startOfWeek } },
      }),
      // FIXED: Leads this month (MTD)
      prisma.lead.count({
        where: { ...leadFilter, createdAt: { gte: startOfMonth } },
      }),

      // FILTERED: Settled debts in range
      prisma.debt.findMany({
        where: {
          status: "SETTLED",
          updatedAt: { gte: rangeFrom, lt: rangeTo },
        },
        select: { settledAmount: true, enrolledBalance: true, savingsPercent: true },
      }),
      // FILTERED: Active clients (snapshot, not date-filtered but kept for dashboard)
      prisma.client.count({ where: { status: "ACTIVE" } }),
      // FILTERED: At-risk clients
      prisma.client.count({ where: { status: { in: ["DROPPED", "ON_HOLD"] } } }),
      // FILTERED: Active campaigns
      prisma.campaign.count({ where: { status: "ACTIVE" } }),
      // FILTERED: Calls in range
      prisma.call.count({
        where: { ...agentFilter, startedAt: { gte: rangeFrom, lt: rangeTo } },
      }),
      // FILTERED: Enrollments in range
      prisma.lead.count({
        where: { ...leadFilter, status: "ENROLLED", updatedAt: { gte: rangeFrom, lt: rangeTo } },
      }),
      // FILTERED: Leads by status (pipeline — snapshot, all time)
      prisma.lead.groupBy({
        by: ["status"],
        _count: { id: true },
        where: leadFilter,
      }),
      // FILTERED: Recent calls in range
      prisma.call.findMany({
        where: { ...agentFilter, startedAt: { gte: rangeFrom, lt: rangeTo } },
        orderBy: { startedAt: "desc" },
        take: 10,
        include: {
          lead: { select: { businessName: true } },
          agent: { select: { name: true } },
          feedback: { select: { overallScore: true } },
        },
      }),
      // FILTERED: Agent leaderboard in range
      prisma.call.groupBy({
        by: ["agentId"],
        _count: { id: true },
        where: { startedAt: { gte: rangeFrom, lt: rangeTo } },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      // Open opportunities (not archived/closed/won)
      prisma.opportunity.count({
        where: {
          stage: { notIn: ["ARCHIVED", "CLOSED", "CLOSED_WON_FIRST_PAYMENT"] },
        },
      }),
      // Won opportunities in range
      prisma.opportunity.count({
        where: {
          stage: "CLOSED_WON_FIRST_PAYMENT",
          updatedAt: { gte: rangeFrom, lt: rangeTo },
        },
      }),
    ]);

    // Compute revenue stats
    const totalRevenue = settledDebtsData.reduce(
      (sum, d) => sum + (d.settledAmount ?? 0), 0
    );
    const avgSavingsPercent =
      settledDebtsData.length > 0
        ? settledDebtsData.reduce((sum, d) => sum + (d.savingsPercent ?? 0), 0) / settledDebtsData.length
        : 0;

    // Format leads by status
    const leadsByStatus = leadsByStatusRaw.map((item) => ({
      status: item.status,
      count: item._count.id,
    }));

    // Build agent leaderboard with details
    const agentIds = agentLeaderboardRaw.map((a) => a.agentId);
    const agentUsers = agentIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: agentIds } },
          select: { id: true, name: true },
        })
      : [];

    const agentLeaderboard = await Promise.all(
      agentLeaderboardRaw.map(async (entry) => {
        const agent = agentUsers.find((a) => a.id === entry.agentId);
        const [connections, enrollments, feedbackScores] = await Promise.all([
          prisma.call.count({
            where: {
              agentId: entry.agentId,
              startedAt: { gte: rangeFrom, lt: rangeTo },
              status: { in: ["IN_PROGRESS", "COMPLETED"] },
            },
          }),
          prisma.lead.count({
            where: {
              assignedToId: entry.agentId,
              status: "ENROLLED",
              updatedAt: { gte: rangeFrom, lt: rangeTo },
            },
          }),
          prisma.callFeedback.findMany({
            where: {
              agentId: entry.agentId,
              createdAt: { gte: rangeFrom, lt: rangeTo },
            },
            select: { overallScore: true },
          }),
        ]);

        const avgScore =
          feedbackScores.length > 0
            ? Math.round(
                feedbackScores.reduce((sum, f) => sum + f.overallScore, 0) /
                  feedbackScores.length
              )
            : null;

        return {
          name: agent?.name || "Unknown",
          calls: entry._count.id,
          connections,
          enrollments,
          avgScore,
        };
      })
    );

    return NextResponse.json({
      // Fixed stats
      leadsToday,
      leadsThisWeek,
      leadsThisMonth,
      // Filtered stats
      totalRevenue,
      settledCount: settledDebtsData.length,
      avgSavingsPercent,
      activeClients: activeClientsCount,
      atRiskClients: atRiskClientsCount,
      activeCampaigns,
      callsInRange,
      enrollmentsInRange,
      leadsByStatus,
      recentCalls,
      agentLeaderboard,
      openOpportunities,
      wonOpportunitiesInRange,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}
