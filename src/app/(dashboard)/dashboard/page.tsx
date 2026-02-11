import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, PhoneCall, Megaphone, UserCheck } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-500",
  CONTACTED: "bg-indigo-500",
  QUALIFIED: "bg-purple-500",
  UNQUALIFIED: "bg-gray-400",
  CALLBACK: "bg-yellow-500",
  ENROLLED: "bg-green-500",
  LOST: "bg-red-400",
  DNC: "bg-red-600",
};

const STATUS_ORDER = ["NEW", "CONTACTED", "QUALIFIED", "CALLBACK", "ENROLLED"];

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getDispositionColor(disposition: string | null): string {
  switch (disposition) {
    case "INTERESTED":
      return "bg-green-100 text-green-800";
    case "ENROLLED":
      return "bg-green-200 text-green-900 font-bold";
    case "NOT_INTERESTED":
      return "bg-red-100 text-red-800";
    case "DNC":
      return "bg-red-200 text-red-900 font-bold";
    case "CALLBACK":
      return "bg-yellow-100 text-yellow-800";
    case "VOICEMAIL":
    case "NO_ANSWER":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function getScoreColor(score: number): string {
  if (score >= 75) return "text-green-600";
  if (score >= 50) return "text-yellow-600";
  return "text-red-600";
}

export default async function DashboardPage() {
  const session = await auth();
  const userRole = (session?.user as { role?: string })?.role;
  const userId = session?.user?.id;
  const isManagerOrAdmin = userRole === "MANAGER" || userRole === "ADMIN";

  const agentFilter = isManagerOrAdmin ? {} : { agentId: userId };
  const leadFilter = isManagerOrAdmin ? {} : { assignedToId: userId };

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalLeads,
    callsToday,
    activeCampaigns,
    enrollmentsThisMonth,
    leadsByStatusRaw,
    recentCalls,
    agentLeaderboardRaw,
  ] = await Promise.all([
    prisma.lead.count({ where: leadFilter }),
    prisma.call.count({
      where: { ...agentFilter, startedAt: { gte: startOfToday } },
    }),
    prisma.campaign.count({ where: { status: "ACTIVE" } }),
    prisma.lead.count({
      where: { ...leadFilter, status: "ENROLLED", updatedAt: { gte: startOfMonth } },
    }),
    prisma.lead.groupBy({
      by: ["status"],
      _count: { id: true },
      where: leadFilter,
    }),
    prisma.call.findMany({
      where: agentFilter,
      orderBy: { startedAt: "desc" },
      take: 10,
      include: {
        lead: { select: { businessName: true } },
        agent: { select: { name: true } },
        feedback: { select: { overallScore: true } },
      },
    }),
    prisma.call.groupBy({
      by: ["agentId"],
      _count: { id: true },
      where: { startedAt: { gte: startOfWeek } },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
  ]);

  // Format leads by status for pipeline
  const leadsByStatus = leadsByStatusRaw.map((item) => ({
    status: item.status,
    count: item._count.id,
  }));

  const pipelineStatuses = STATUS_ORDER.map((status) => {
    const found = leadsByStatus.find((l) => l.status === status);
    return { status, count: found?.count || 0 };
  });
  const pipelineTotal = pipelineStatuses.reduce((sum, s) => sum + s.count, 0);

  // Build agent leaderboard
  const agentIds = agentLeaderboardRaw.map((a) => a.agentId);
  const agentUsers = await prisma.user.findMany({
    where: { id: { in: agentIds } },
    select: { id: true, name: true },
  });

  const agentLeaderboard = await Promise.all(
    agentLeaderboardRaw.map(async (entry) => {
      const agent = agentUsers.find((a) => a.id === entry.agentId);
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

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Welcome back, {session?.user?.name ?? "User"}
        </h2>
        <p className="text-muted-foreground">
          Here is your dashboard overview for today.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Leads
            </CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLeads}</div>
            <p className="text-xs text-muted-foreground">Across all sources</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Calls Today
            </CardTitle>
            <PhoneCall className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{callsToday}</div>
            <p className="text-xs text-muted-foreground">Outbound & inbound</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Campaigns
            </CardTitle>
            <Megaphone className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCampaigns}</div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Enrollments This Month
            </CardTitle>
            <UserCheck className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enrollmentsThisMonth}</div>
            <p className="text-xs text-muted-foreground">
              Leads converted to enrolled
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lead Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle>Lead Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          {pipelineTotal > 0 ? (
            <>
              <div className="flex h-8 w-full overflow-hidden rounded-full">
                {pipelineStatuses.map((item) =>
                  item.count > 0 ? (
                    <div
                      key={item.status}
                      className={`${STATUS_COLORS[item.status] || "bg-gray-400"} flex items-center justify-center text-xs font-medium text-white transition-all`}
                      style={{
                        width: `${(item.count / pipelineTotal) * 100}%`,
                        minWidth: item.count > 0 ? "2rem" : "0",
                      }}
                      title={`${item.status}: ${item.count}`}
                    >
                      {item.count}
                    </div>
                  ) : null
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-4">
                {pipelineStatuses.map((item) => (
                  <div key={item.status} className="flex items-center gap-2 text-sm">
                    <div
                      className={`size-3 rounded-full ${STATUS_COLORS[item.status] || "bg-gray-400"}`}
                    />
                    <span className="text-muted-foreground">{item.status}</span>
                    <span className="font-medium">{item.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No leads in pipeline yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Recent Calls & Agent Leaderboard */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Calls */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Calls</CardTitle>
          </CardHeader>
          <CardContent>
            {recentCalls.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Disposition</TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentCalls.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell className="text-xs">
                        {formatDate(call.startedAt)}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {call.lead?.businessName || "--"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {call.agent.name}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDuration(call.duration)}
                      </TableCell>
                      <TableCell>
                        {call.disposition ? (
                          <Badge
                            variant="secondary"
                            className={getDispositionColor(call.disposition)}
                          >
                            {call.disposition}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {call.feedback ? (
                          <span
                            className={`text-sm font-semibold ${getScoreColor(call.feedback.overallScore)}`}
                          >
                            {call.feedback.overallScore}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">--</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">
                No calls recorded yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Agent Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle>Agent Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            {agentLeaderboard.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent Name</TableHead>
                    <TableHead>Calls This Week</TableHead>
                    <TableHead>Connections</TableHead>
                    <TableHead>Enrollments</TableHead>
                    <TableHead>Avg AI Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentLeaderboard.map((agent, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{agent.name}</TableCell>
                      <TableCell>{agent.calls}</TableCell>
                      <TableCell>{agent.connections}</TableCell>
                      <TableCell>{agent.enrollments}</TableCell>
                      <TableCell>
                        {agent.avgScore !== null ? (
                          <span
                            className={`font-semibold ${getScoreColor(agent.avgScore)}`}
                          >
                            {agent.avgScore}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">--</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">
                No agent activity this week.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
