import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = session.user.role;
  const userId = session.user.id;
  const isManagerOrAdmin = userRole === "MANAGER" || userRole === "ADMIN";

  // Build agent filter for non-managers
  const agentFilter = isManagerOrAdmin ? {} : { agentId: userId };
  const leadFilter = isManagerOrAdmin ? {} : { assignedToId: userId };

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  try {
    const [
      totalLeads,
      newLeadsThisWeek,
      activeCampaigns,
      callsToday,
      callsThisWeek,
      enrollmentsThisMonth,
      completedCalls,
      inProgressCalls,
      totalCallsForRate,
      leadsByStatus,
      recentCalls,
      agentLeaderboardData,
    ] = await Promise.all([
      // Total leads
      prisma.lead.count({ where: leadFilter }),

      // New leads this week
      prisma.lead.count({
        where: {
          ...leadFilter,
          createdAt: { gte: startOfWeek },
        },
      }),

      // Active campaigns
      prisma.campaign.count({ where: { status: "ACTIVE" } }),

      // Calls today
      prisma.call.count({
        where: {
          ...agentFilter,
          startedAt: { gte: startOfToday },
        },
      }),

      // Calls this week
      prisma.call.count({
        where: {
          ...agentFilter,
          startedAt: { gte: startOfWeek },
        },
      }),

      // Enrollments this month
      prisma.lead.count({
        where: {
          ...leadFilter,
          status: "ENROLLED",
          updatedAt: { gte: startOfMonth },
        },
      }),

      // Completed calls for avg duration
      prisma.call.findMany({
        where: {
          ...agentFilter,
          status: "COMPLETED",
          duration: { not: null },
        },
        select: { duration: true },
      }),

      // Calls that reached IN_PROGRESS
      prisma.call.count({
        where: {
          ...agentFilter,
          status: "IN_PROGRESS",
        },
      }),

      // Total calls for connection rate
      prisma.call.count({ where: agentFilter }),

      // Leads by status
      prisma.lead.groupBy({
        by: ["status"],
        _count: { id: true },
        where: leadFilter,
      }),

      // Recent calls
      prisma.call.findMany({
        where: agentFilter,
        orderBy: { startedAt: "desc" },
        take: 10,
        include: {
          lead: { select: { businessName: true, contactName: true } },
          agent: { select: { name: true } },
          feedback: { select: { overallScore: true } },
        },
      }),

      // Agent leaderboard - top agents by calls this week
      prisma.call.groupBy({
        by: ["agentId"],
        _count: { id: true },
        where: {
          startedAt: { gte: startOfWeek },
        },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
    ]);

    // Calculate avg call duration
    const totalDuration = completedCalls.reduce(
      (sum, c) => sum + (c.duration || 0),
      0
    );
    const avgCallDuration =
      completedCalls.length > 0
        ? Math.round(totalDuration / completedCalls.length)
        : 0;

    // Calculate connection rate: calls that reached IN_PROGRESS or COMPLETED
    const completedCount = completedCalls.length;
    const connectedCalls = inProgressCalls + completedCount;
    const connectionRate =
      totalCallsForRate > 0
        ? Math.round((connectedCalls / totalCallsForRate) * 100)
        : 0;

    // Format leads by status
    const formattedLeadsByStatus = leadsByStatus.map((item) => ({
      status: item.status,
      count: item._count.id,
    }));

    // Build agent leaderboard with details
    const agentIds = agentLeaderboardData.map((a) => a.agentId);
    const agents = await prisma.user.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true },
    });

    const agentLeaderboard = await Promise.all(
      agentLeaderboardData.map(async (entry) => {
        const agent = agents.find((a) => a.id === entry.agentId);
        const [connections, enrollments, feedbackScores] = await Promise.all([
          prisma.call.count({
            where: {
              agentId: entry.agentId,
              startedAt: { gte: startOfWeek },
              status: { in: ["IN_PROGRESS", "COMPLETED"] },
            },
          }),
          prisma.lead.count({
            where: {
              assignedToId: entry.agentId,
              status: "ENROLLED",
              updatedAt: { gte: startOfWeek },
            },
          }),
          prisma.callFeedback.findMany({
            where: {
              agentId: entry.agentId,
              createdAt: { gte: startOfWeek },
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
      totalLeads,
      newLeadsThisWeek,
      activeCampaigns,
      callsToday,
      callsThisWeek,
      enrollmentsThisMonth,
      avgCallDuration,
      connectionRate,
      leadsByStatus: formattedLeadsByStatus,
      recentCalls,
      agentLeaderboard,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}
