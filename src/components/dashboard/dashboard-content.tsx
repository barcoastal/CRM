"use client";

import { useCallback, useEffect, useState } from "react";
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
  Target,
  UserCheck,
  DollarSign,
  PhoneCall,
  Trophy,
  Loader2,
  TrendingUp,
  TrendingDown,
} from "@/components/icons/lucide";
import Link from "next/link";

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_ORDER = ["NEW", "CONTACTED", "QUALIFIED", "OPPORTUNITY", "ENROLLED"];

const PIPELINE_COLORS: Record<string, string> = {
  NEW: "#3052FF",
  CONTACTED: "#6366f1",
  QUALIFIED: "#8b5cf6",
  OPPORTUNITY: "#06b6d4",
  ENROLLED: "#10b981",
};

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface DashboardContentProps {
  userName: string;
}

type Preset = "today" | "wtd" | "mtd" | "qtd" | "ytd";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
      return "bg-emerald-50 text-emerald-700";
    case "ENROLLED":
      return "bg-emerald-100 text-emerald-800 font-semibold";
    case "NOT_INTERESTED":
      return "bg-red-50 text-red-700";
    case "DNC":
      return "bg-red-100 text-red-800 font-semibold";
    case "CALLBACK":
      return "bg-amber-50 text-amber-700";
    case "VOICEMAIL":
    case "NO_ANSWER":
      return "bg-[#f2f3ff] text-[#444656]";
    default:
      return "bg-[#f2f3ff] text-[#444656]";
  }
}

function getScoreColor(score: number): string {
  if (score >= 75) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
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

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const AVATAR_COLORS = [
  "#3052FF",
  "#8b5cf6",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#ec4899",
];

// ─── Sub-components ───────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg: string;
  change?: number;
  sub?: React.ReactNode;
}

function KpiCard({ label, value, icon, iconBg, change, sub }: KpiCardProps) {
  const isUp = change !== undefined && change >= 0;
  return (
    <div className="bg-white rounded-xl shadow-coastal p-6 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: iconBg }}
        >
          {icon}
        </div>
        {change !== undefined && (
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${
              isUp
                ? "text-emerald-700 bg-emerald-50"
                : "text-red-700 bg-red-50"
            }`}
          >
            {isUp ? (
              <TrendingUp className="size-3" />
            ) : (
              <TrendingDown className="size-3" />
            )}
            {isUp ? "+" : ""}
            {change}%
          </span>
        )}
      </div>
      <div>
        <div
          className="font-bold text-[30px] tracking-tight leading-none text-[#131b2e]"
          style={{ fontFamily: "var(--font-sans, sans-serif)" }}
        >
          {value}
        </div>
        <div className="text-[13px] text-[#444656] font-medium mt-1.5">
          {label}
        </div>
        {sub && <div className="mt-1">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

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
      case "wtd":
        setDateFrom(toDateString(getMonday(td)));
        setDateTo(toDateString(td));
        break;
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
  const pipelineMax = Math.max(...pipelineStatuses.map((s) => s.count), 1);

  // Monthly Revenue chart — 6 static points scaled to the SVG
  const revenuePoints = [140, 120, 95, 110, 75, 45];
  const lineD = revenuePoints
    .map((y, i) => `${i === 0 ? "M" : "L"}${i * 100},${y}`)
    .join(" ");
  const areaD = `${lineD} L500,200 L0,200 Z`;

  return (
    <div className="min-h-screen bg-[#faf8ff]">
      <div className="p-8 space-y-6 max-w-screen-2xl mx-auto">

        {/* ── Greeting ── */}
        <div>
          <h1 className="text-[26px] font-bold text-[#131b2e] tracking-tight">
            {getGreeting()}, {userName}
          </h1>
          <p className="text-[13.5px] text-[#444656] mt-0.5">
            {getFormattedDate()}
          </p>
        </div>

        {/* ── 4 KPI Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <KpiCard
            label="Total Leads"
            value={data?.leadsThisMonth ?? "--"}
            icon={<Users className="size-5 text-[#3052FF]" />}
            iconBg="rgba(48,82,255,0.08)"
            change={12}
          />
          <KpiCard
            label="Active Opportunities"
            icon={<Target className="size-5 text-emerald-600" />}
            iconBg="rgba(16,185,129,0.08)"
            value={data?.openOpportunities ?? "--"}
            change={8}
            sub={
              data ? (
                <Link
                  href="/opportunities"
                  className="text-xs text-[#3052FF] hover:underline"
                >
                  View pipeline
                </Link>
              ) : null
            }
          />
          <KpiCard
            label="Enrolled Clients"
            icon={<UserCheck className="size-5 text-violet-500" />}
            iconBg="rgba(139,92,246,0.08)"
            value={data?.activeClients ?? "--"}
            change={5}
            sub={
              data ? (
                <Link
                  href="/clients"
                  className="text-xs text-[#3052FF] hover:underline"
                >
                  View all clients
                </Link>
              ) : null
            }
          />
          <KpiCard
            label="Revenue This Month"
            icon={<DollarSign className="size-5 text-amber-500" />}
            iconBg="rgba(245,158,11,0.08)"
            value={data ? formatCurrency(data.totalRevenue) : "--"}
            change={15}
            sub={
              data ? (
                <span className="text-xs text-[#444656]">
                  {data.settledCount} debt{data.settledCount !== 1 ? "s" : ""}{" "}
                  settled
                </span>
              ) : null
            }
          />
        </div>

        {/* ── Date Range Bar ── */}
        <div className="bg-white rounded-xl shadow-coastal px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-[#444656] mr-1">
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
                variant={activePreset === key ? "default" : "ghost"}
                size="sm"
                onClick={() => applyPreset(key)}
                className={`h-7 px-3 text-xs rounded-lg ${
                  activePreset === key
                    ? "gradient-primary text-white"
                    : "text-[#444656] hover:bg-[#f2f3ff]"
                }`}
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
                className="h-7 w-36 text-xs bg-[#f2f3ff] border-0 rounded-lg"
              />
              <span className="text-xs text-[#444656]">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setActivePreset(undefined as unknown as Preset);
                }}
                className="h-7 w-36 text-xs bg-[#f2f3ff] border-0 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* ── Loading ── */}
        {loading && !data && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-[#3052FF]" />
          </div>
        )}

        {data && (
          <>
            {/* ── Charts Row ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Lead Pipeline Bar Chart */}
              <div className="bg-white rounded-xl shadow-coastal p-6">
                <h3 className="text-[16px] font-bold text-[#131b2e] mb-5">
                  Lead Pipeline
                </h3>
                {pipelineStatuses.some((s) => s.count > 0) ? (
                  <>
                    <div className="flex items-flex-end gap-5 h-[200px] pt-2">
                      {pipelineStatuses.map((item) => {
                        const heightPct = (item.count / pipelineMax) * 170;
                        const color =
                          PIPELINE_COLORS[item.status] || "#94a3b8";
                        return (
                          <div
                            key={item.status}
                            className="flex-1 flex flex-col items-center gap-2"
                          >
                            <div className="w-full h-[180px] flex items-end justify-center">
                              <div
                                className="w-12 rounded-t-md relative transition-all duration-300 hover:opacity-80"
                                style={{
                                  height: `${heightPct}px`,
                                  background: `linear-gradient(135deg, #0034e4, ${color})`,
                                }}
                                title={`${item.status}: ${item.count}`}
                              >
                                <span
                                  className="absolute -top-5 left-1/2 -translate-x-1/2 text-[12px] font-semibold text-[#131b2e] whitespace-nowrap"
                                >
                                  {item.count}
                                </span>
                              </div>
                            </div>
                            <span className="text-[12px] text-[#444656] font-medium text-center capitalize">
                              {item.status.charAt(0) +
                                item.status.slice(1).toLowerCase()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-[#444656]">
                    No leads in pipeline yet.
                  </p>
                )}
              </div>

              {/* Monthly Revenue Area Chart */}
              <div className="bg-white rounded-xl shadow-coastal p-6">
                <h3 className="text-[16px] font-bold text-[#131b2e] mb-5">
                  Monthly Revenue
                </h3>
                <div className="relative h-[200px]">
                  <svg
                    viewBox="0 0 500 200"
                    preserveAspectRatio="none"
                    className="w-full h-full"
                  >
                    <defs>
                      <linearGradient
                        id="areaGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#3052ff"
                          stopOpacity="0.15"
                        />
                        <stop
                          offset="100%"
                          stopColor="#3052ff"
                          stopOpacity="0"
                        />
                      </linearGradient>
                    </defs>
                    <line
                      x1="0"
                      y1="50"
                      x2="500"
                      y2="50"
                      stroke="#eaedff"
                      strokeWidth="1"
                    />
                    <line
                      x1="0"
                      y1="100"
                      x2="500"
                      y2="100"
                      stroke="#eaedff"
                      strokeWidth="1"
                    />
                    <line
                      x1="0"
                      y1="150"
                      x2="500"
                      y2="150"
                      stroke="#eaedff"
                      strokeWidth="1"
                    />
                    <text
                      x="2"
                      y="48"
                      fill="#444656"
                      fontSize="11"
                      fontFamily="Inter,sans-serif"
                    >
                      $500k
                    </text>
                    <text
                      x="2"
                      y="98"
                      fill="#444656"
                      fontSize="11"
                      fontFamily="Inter,sans-serif"
                    >
                      $350k
                    </text>
                    <text
                      x="2"
                      y="148"
                      fill="#444656"
                      fontSize="11"
                      fontFamily="Inter,sans-serif"
                    >
                      $200k
                    </text>
                    <path d={areaD} fill="url(#areaGrad)" />
                    <path
                      d={lineD}
                      fill="none"
                      stroke="#3052ff"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {revenuePoints.map((y, i) => (
                      <circle key={i} cx={i * 100} cy={y} r="4" fill="#3052ff" />
                    ))}
                  </svg>
                </div>
                <div className="flex justify-between mt-2">
                  {["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"].map((m) => (
                    <span
                      key={m}
                      className="text-[12px] text-[#444656] font-medium"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Tables Row: Recent Calls + Top Agents ── */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.65fr] gap-5">

              {/* Recent Calls */}
              <div className="bg-white rounded-xl shadow-coastal p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-[16px] font-bold text-[#131b2e]">
                    Recent Calls
                  </h3>
                  <PhoneCall className="size-4 text-[#444656]" />
                </div>
                {data.recentCalls.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-0 hover:bg-transparent">
                        <TableHead className="text-[11px] font-semibold text-[#444656] uppercase tracking-wide px-4 py-3">
                          Date / Time
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold text-[#444656] uppercase tracking-wide px-4 py-3">
                          Lead
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold text-[#444656] uppercase tracking-wide px-4 py-3">
                          Agent
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold text-[#444656] uppercase tracking-wide px-4 py-3">
                          Duration
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold text-[#444656] uppercase tracking-wide px-4 py-3">
                          Disposition
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold text-[#444656] uppercase tracking-wide px-4 py-3">
                          Score
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recentCalls.map((call, idx) => (
                        <TableRow
                          key={call.id}
                          className={`border-0 transition-colors hover:bg-[#f2f3ff] ${
                            idx % 2 === 1 ? "bg-[#faf8ff]" : ""
                          }`}
                        >
                          <TableCell className="text-xs text-[#444656] px-4 py-3">
                            {formatCallDate(call.startedAt)}
                          </TableCell>
                          <TableCell className="text-[13.5px] font-medium text-[#131b2e] px-4 py-3">
                            {call.lead?.businessName || "--"}
                          </TableCell>
                          <TableCell className="text-[13.5px] text-[#444656] px-4 py-3">
                            {call.agent.name}
                          </TableCell>
                          <TableCell className="text-[13.5px] text-[#444656] px-4 py-3">
                            {formatDuration(call.duration)}
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            {call.disposition ? (
                              <Badge
                                variant="secondary"
                                className={`text-[12px] px-2.5 py-0.5 rounded-full border-0 ${getDispositionColor(call.disposition)}`}
                              >
                                {call.disposition.replace(/_/g, " ")}
                              </Badge>
                            ) : (
                              <span className="text-xs text-[#444656]">--</span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            {call.feedback ? (
                              <span
                                className={`text-[13.5px] font-semibold ${getScoreColor(call.feedback.overallScore)}`}
                              >
                                {call.feedback.overallScore}
                              </span>
                            ) : (
                              <span className="text-xs text-[#444656]">--</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-[#444656]">
                    No calls in selected range.
                  </p>
                )}
              </div>

              {/* Top Agents Leaderboard */}
              <div className="bg-white rounded-xl shadow-coastal p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-[16px] font-bold text-[#131b2e]">
                    Top Agents
                  </h3>
                  <Trophy className="size-4 text-amber-500" />
                </div>
                {data.agentLeaderboard.length > 0 ? (
                  <div>
                    {data.agentLeaderboard.map((agent, idx) => {
                      const rankColor =
                        idx === 0
                          ? "#f59e0b"
                          : idx === 1
                          ? "#94a3b8"
                          : idx === 2
                          ? "#b45309"
                          : "#444656";
                      const avatarColor =
                        AVATAR_COLORS[idx % AVATAR_COLORS.length];
                      return (
                        <div
                          key={idx}
                          className={`flex items-center gap-3 px-4 py-3.5 rounded-lg transition-colors hover:bg-[#f2f3ff] ${
                            idx % 2 === 1 ? "bg-[#faf8ff]" : ""
                          }`}
                        >
                          {/* Rank */}
                          <span
                            className="text-[16px] font-bold w-6 shrink-0 text-center"
                            style={{ color: rankColor, fontFamily: "sans-serif" }}
                          >
                            {idx + 1}
                          </span>

                          {/* Avatar */}
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
                            style={{ background: avatarColor }}
                          >
                            {getInitials(agent.name)}
                          </div>

                          {/* Name */}
                          <div className="flex-1 min-w-0">
                            <div className="text-[13.5px] font-semibold text-[#131b2e] truncate">
                              {agent.name}
                            </div>
                            <div className="text-[12px] text-[#444656]">
                              Agent
                            </div>
                          </div>

                          {/* Stats */}
                          <div className="flex gap-4 text-[12.5px] text-[#444656] shrink-0">
                            <span>
                              Enrolled{" "}
                              <strong className="text-[#131b2e]">
                                {agent.enrollments}
                              </strong>
                            </span>
                            <span>
                              Calls{" "}
                              <strong className="text-[#131b2e]">
                                {agent.calls}
                              </strong>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-[#444656]">
                    No agent activity in selected range.
                  </p>
                )}
              </div>
            </div>

            {/* ── Upcoming Follow-ups ── */}
            <div className="bg-white rounded-xl shadow-coastal p-6">
              <h3 className="text-[16px] font-bold text-[#131b2e] mb-5">
                Upcoming Follow-ups
              </h3>
              <Table>
                <TableHeader>
                  <TableRow className="border-0 hover:bg-transparent">
                    {["Lead", "Company", "Calls", "Enrolled", "Avg Score"].map(
                      (h) => (
                        <TableHead
                          key={h}
                          className="text-[11px] font-semibold text-[#444656] uppercase tracking-wide px-4 py-3"
                        >
                          {h}
                        </TableHead>
                      )
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.agentLeaderboard.length > 0 ? (
                    data.agentLeaderboard.map((agent, idx) => (
                      <TableRow
                        key={idx}
                        className={`border-0 transition-colors hover:bg-[#f2f3ff] ${
                          idx % 2 === 1 ? "bg-[#faf8ff]" : ""
                        }`}
                      >
                        <TableCell className="text-[13.5px] font-medium text-[#131b2e] px-4 py-3">
                          {agent.name}
                        </TableCell>
                        <TableCell className="text-[13.5px] text-[#444656] px-4 py-3">
                          --
                        </TableCell>
                        <TableCell className="text-[13.5px] text-[#444656] px-4 py-3">
                          {agent.calls}
                        </TableCell>
                        <TableCell className="text-[13.5px] text-[#444656] px-4 py-3">
                          {agent.enrollments}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          {agent.avgScore !== null ? (
                            <span
                              className={`text-[13.5px] font-semibold ${getScoreColor(agent.avgScore)}`}
                            >
                              {agent.avgScore}
                            </span>
                          ) : (
                            <span className="text-xs text-[#444656]">--</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow className="border-0">
                      <TableCell
                        colSpan={5}
                        className="text-sm text-[#444656] px-4 py-6 text-center"
                      >
                        No follow-up data available.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* ── Additional Stats (secondary row) ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                {
                  label: "Leads Today",
                  value: data.leadsToday,
                  sub: "Today",
                },
                {
                  label: "Leads This Week",
                  value: data.leadsThisWeek,
                  sub: "WTD (Mon start)",
                },
                {
                  label: "Calls in Range",
                  value: data.callsInRange,
                  sub: "Selected period",
                },
                {
                  label: "Enrollments",
                  value: data.enrollmentsInRange,
                  sub: "Converted",
                },
                {
                  label: "Won Opps",
                  value: data.wonOpportunitiesInRange,
                  sub: "Closed won",
                  green: true,
                },
              ].map(({ label, value, sub, green }) => (
                <div
                  key={label}
                  className="bg-white rounded-xl shadow-coastal p-5"
                >
                  <div
                    className={`text-2xl font-bold ${green ? "text-emerald-600" : "text-[#131b2e]"}`}
                  >
                    {value}
                  </div>
                  <div className="text-[13px] font-medium text-[#131b2e] mt-1">
                    {label}
                  </div>
                  <div className="text-[12px] text-[#444656] mt-0.5">{sub}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
