"use client";

import { useCallback, useEffect, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users,
  CalendarDays,
  CalendarRange,
  CalendarClock,
  Briefcase,
  DollarSign,
  TrendingDown,
  AlertTriangle,
  Megaphone,
  PhoneCall,
  UserCheck,
  Target,
  Trophy,
  Loader2,
} from "lucide-react";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-500",
  CONTACTED: "bg-indigo-500",
  QUALIFIED: "bg-purple-500",
  UNQUALIFIED: "bg-gray-400",
  CALLBACK: "bg-yellow-500",
  OPPORTUNITY: "bg-cyan-500",
  ENROLLED: "bg-green-500",
  LOST: "bg-red-400",
  DNC: "bg-red-600",
};

const STATUS_ORDER = ["NEW", "CONTACTED", "QUALIFIED", "OPPORTUNITY", "ENROLLED"];

interface DashboardData {
  leadsToday: number;
  leadsThisWeek: number;
  leadsThisMonth: number;
  totalRevenue: number;
  settledCount: number;
  avgSavingsPercent: number;
  activeClients: number;
  atRiskClients: number;
  activeCampaigns: number;
  callsInRange: number;
  enrollmentsInRange: number;
  openOpportunities: number;
  wonOpportunitiesInRange: number;
  leadsByStatus: { status: string; count: number }[];
  recentCalls: {
    id: string;
    startedAt: string;
    duration: number | null;
    disposition: string | null;
    lead: { businessName: string } | null;
    agent: { name: string };
    feedback: { overallScore: number } | null;
  }[];
  agentLeaderboard: {
    name: string;
    calls: number;
    connections: number;
    enrollments: number;
    avgScore: number | null;
  }[];
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatCallDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
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

function toDateString(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getMonday(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - diff);
  return date;
}

interface DashboardContentProps {
  userName: string;
}

type Preset = "today" | "wtd" | "mtd" | "qtd" | "ytd";

export function DashboardContent({ userName }: DashboardContentProps) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [activePreset, setActivePreset] = useState<Preset>("mtd");
  const [dateFrom, setDateFrom] = useState(
    toDateString(new Date(now.getFullYear(), now.getMonth(), 1))
  );
  const [dateTo, setDateTo] = useState(toDateString(today));
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  function applyPreset(preset: Preset) {
    setActivePreset(preset);
    const t = new Date();
    const td = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    switch (preset) {
      case "today":
        setDateFrom(toDateString(td));
        setDateTo(toDateString(td));
        break;
      case "wtd": {
        setDateFrom(toDateString(getMonday(td)));
        setDateTo(toDateString(td));
        break;
      }
      case "mtd":
        setDateFrom(toDateString(new Date(t.getFullYear(), t.getMonth(), 1)));
        setDateTo(toDateString(td));
        break;
      case "qtd": {
        const qMonth = Math.floor(t.getMonth() / 3) * 3;
        setDateFrom(toDateString(new Date(t.getFullYear(), qMonth, 1)));
        setDateTo(toDateString(td));
        break;
      }
      case "ytd":
        setDateFrom(toDateString(new Date(t.getFullYear(), 0, 1)));
        setDateTo(toDateString(td));
        break;
    }
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/dashboard/stats?from=${dateFrom}&to=${dateTo}`
      );
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(val);

  const pipelineStatuses = data
    ? STATUS_ORDER.map((status) => {
        const found = data.leadsByStatus.find((l) => l.status === status);
        return { status, count: found?.count || 0 };
      })
    : [];
  const pipelineTotal = pipelineStatuses.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Welcome back, {userName}
        </h2>
        <p className="text-muted-foreground">
          Here is your dashboard overview.
        </p>
      </div>

      {/* Fixed Lead Cards — always Today / WTD / MTD */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Leads Today
            </CardTitle>
            <CalendarDays className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.leadsToday ?? "--"}
            </div>
            <p className="text-xs text-muted-foreground">Today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Leads This Week
            </CardTitle>
            <CalendarRange className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.leadsThisWeek ?? "--"}
            </div>
            <p className="text-xs text-muted-foreground">WTD (Mon start)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Leads This Month
            </CardTitle>
            <CalendarClock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.leadsThisMonth ?? "--"}
            </div>
            <p className="text-xs text-muted-foreground">MTD</p>
          </CardContent>
        </Card>
      </div>

      {/* Date Range Bar */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground mr-1">
              Date Range:
            </span>
            {(
              [
                ["today", "Today"],
                ["wtd", "WTD"],
                ["mtd", "MTD"],
                ["qtd", "QTD"],
                ["ytd", "YTD"],
              ] as [Preset, string][]
            ).map(([key, label]) => (
              <Button
                key={key}
                variant={activePreset === key ? "default" : "outline"}
                size="sm"
                onClick={() => applyPreset(key)}
                className="h-7 px-3 text-xs"
              >
                {label}
              </Button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setActivePreset(undefined as unknown as Preset);
                }}
                className="h-7 w-36 text-xs"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setActivePreset(undefined as unknown as Preset);
                }}
                className="h-7 w-36 text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && !data ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          {/* Filtered Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Revenue
                </CardTitle>
                <DollarSign className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(data.totalRevenue)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {data.settledCount} debt
                  {data.settledCount !== 1 ? "s" : ""} settled
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Calls
                </CardTitle>
                <PhoneCall className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.callsInRange}</div>
                <p className="text-xs text-muted-foreground">In selected range</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Enrollments
                </CardTitle>
                <UserCheck className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.enrollmentsInRange}
                </div>
                <p className="text-xs text-muted-foreground">
                  Converted in range
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Open Opportunities
                </CardTitle>
                <Target className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.openOpportunities}
                </div>
                <Link
                  href="/opportunities"
                  className="text-xs text-primary hover:underline"
                >
                  View pipeline
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Won This Period
                </CardTitle>
                <Trophy className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {data.wonOpportunitiesInRange}
                </div>
                <p className="text-xs text-muted-foreground">
                  Closed won in range
                </p>
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
                <div className="text-2xl font-bold">
                  {data.activeCampaigns}
                </div>
                <p className="text-xs text-muted-foreground">
                  Currently running
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Client Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Active Clients
                </CardTitle>
                <Briefcase className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.activeClients}</div>
                <Link
                  href="/clients"
                  className="text-xs text-primary hover:underline"
                >
                  View all clients
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Avg Savings %
                </CardTitle>
                <TrendingDown className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.avgSavingsPercent > 0
                    ? `${data.avgSavingsPercent.toFixed(1)}%`
                    : "--"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Across settled debts
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  At-Risk Clients
                </CardTitle>
                <AlertTriangle className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {data.atRiskClients}
                </div>
                <p className="text-xs text-muted-foreground">
                  Dropped or on hold
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
                      <div
                        key={item.status}
                        className="flex items-center gap-2 text-sm"
                      >
                        <div
                          className={`size-3 rounded-full ${STATUS_COLORS[item.status] || "bg-gray-400"}`}
                        />
                        <span className="text-muted-foreground">
                          {item.status}
                        </span>
                        <span className="font-medium">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No leads in pipeline yet.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Recent Calls & Agent Leaderboard */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Calls</CardTitle>
              </CardHeader>
              <CardContent>
                {data.recentCalls.length > 0 ? (
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
                      {data.recentCalls.map((call) => (
                        <TableRow key={call.id}>
                          <TableCell className="text-xs">
                            {formatCallDate(call.startedAt)}
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
                                className={getDispositionColor(
                                  call.disposition
                                )}
                              >
                                {call.disposition}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                --
                              </span>
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
                              <span className="text-xs text-muted-foreground">
                                --
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No calls in selected range.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Agent Leaderboard</CardTitle>
              </CardHeader>
              <CardContent>
                {data.agentLeaderboard.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Agent</TableHead>
                        <TableHead>Calls</TableHead>
                        <TableHead>Connections</TableHead>
                        <TableHead>Enrollments</TableHead>
                        <TableHead>Avg Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.agentLeaderboard.map((agent, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">
                            {agent.name}
                          </TableCell>
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
                              <span className="text-xs text-muted-foreground">
                                --
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No agent activity in selected range.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
