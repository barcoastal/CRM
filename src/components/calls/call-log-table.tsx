"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Search, Play } from "@/components/icons/lucide";
import Link from "next/link";

interface CallAgent {
  id: string;
  name: string;
}

interface CallLead {
  id: string;
  businessName: string;
  contactName: string;
  phone: string;
}

interface CallFeedback {
  overallScore: number;
}

interface CallRecord {
  id: string;
  direction: string;
  status: string;
  disposition: string | null;
  phoneNumber: string;
  duration: number | null;
  startedAt: string;
  lead: CallLead | null;
  agent: CallAgent;
  feedback: CallFeedback | null;
  campaignId?: string | null;
}

interface Agent {
  id: string;
  name: string;
}

interface Campaign {
  id: string;
  name: string;
}

interface CallLogTableProps {
  calls: CallRecord[];
  total: number;
  page: number;
  totalPages: number;
  agents: Agent[];
  campaigns: Campaign[];
  filters: {
    search: string;
    agentId: string;
    disposition: string;
    campaignId: string;
    direction: string;
    dateFrom: string;
    dateTo: string;
  };
}

const DISPOSITIONS = [
  "INTERESTED",
  "NOT_INTERESTED",
  "CALLBACK",
  "NOT_QUALIFIED",
  "WRONG_NUMBER",
  "VOICEMAIL",
  "NO_ANSWER",
  "DNC",
  "ENROLLED",
];

const DISPOSITION_LABELS: Record<string, string> = {
  INTERESTED: "Interested",
  NOT_INTERESTED: "Not Interested",
  CALLBACK: "Callback",
  NOT_QUALIFIED: "Not Qualified",
  WRONG_NUMBER: "Wrong Number",
  VOICEMAIL: "Voicemail",
  NO_ANSWER: "No Answer",
  DNC: "DNC",
  ENROLLED: "Enrolled",
};

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function DispositionBadge({ disposition }: { disposition: string | null }) {
  if (!disposition) return <span className="text-[#444656] text-xs">--</span>;

  const styleMap: Record<string, string> = {
    INTERESTED: "bg-[#dcfce7] text-[#15803d]",
    ENROLLED: "bg-[#dcfce7] text-[#14532d] font-bold",
    CALLBACK: "bg-[#dbeafe] text-[#1d4ed8]",
    NOT_INTERESTED: "bg-[#fee2e2] text-[#b91c1c]",
    DNC: "bg-[#fee2e2] text-[#991b1b] font-bold",
    NO_ANSWER: "bg-[#f1f1f5] text-[#6b7280]",
    VOICEMAIL: "bg-[#f1f1f5] text-[#6b7280]",
    WRONG_NUMBER: "bg-[#ffedd5] text-[#c2410c]",
    NOT_QUALIFIED: "bg-[#f1f1f5] text-[#6b7280]",
  };

  const cls = styleMap[disposition] ?? "bg-[#f1f1f5] text-[#6b7280]";
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold ${cls}`}
    >
      {DISPOSITION_LABELS[disposition] ?? disposition}
    </span>
  );
}

export function CallLogTable({
  calls,
  total,
  page,
  totalPages,
  agents,
  campaigns,
  filters,
}: CallLogTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      if (key !== "page") {
        params.delete("page");
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname]
  );

  const goToPage = useCallback(
    (newPage: number) => {
      updateFilter("page", newPage.toString());
    },
    [updateFilter]
  );

  const start = total === 0 ? 0 : (page - 1) * 20 + 1;
  const end = Math.min(page * 20, total);

  return (
    <div className="space-y-5">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Agent */}
        <Select
          value={filters.agentId || "all"}
          onValueChange={(val) => updateFilter("agentId", val)}
        >
          <SelectTrigger className="h-9 w-40 border-none bg-white shadow-coastal text-[13px] rounded-sm">
            <SelectValue placeholder="All Agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Disposition */}
        <Select
          value={filters.disposition || "all"}
          onValueChange={(val) => updateFilter("disposition", val)}
        >
          <SelectTrigger className="h-9 w-44 border-none bg-white shadow-coastal text-[13px] rounded-sm">
            <SelectValue placeholder="All Dispositions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dispositions</SelectItem>
            {DISPOSITIONS.map((d) => (
              <SelectItem key={d} value={d}>
                {DISPOSITION_LABELS[d] ?? d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Campaign */}
        <Select
          value={filters.campaignId || "all"}
          onValueChange={(val) => updateFilter("campaignId", val)}
        >
          <SelectTrigger className="h-9 w-44 border-none bg-white shadow-coastal text-[13px] rounded-sm">
            <SelectValue placeholder="All Campaigns" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Campaigns</SelectItem>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Direction toggle */}
        <div className="flex bg-white shadow-coastal rounded-sm overflow-hidden">
          {(["all", "INBOUND", "OUTBOUND"] as const).map((dir) => {
            const label = dir === "all" ? "All" : dir === "INBOUND" ? "Inbound" : "Outbound";
            const active = (filters.direction || "all") === dir;
            return (
              <button
                key={dir}
                onClick={() => updateFilter("direction", dir)}
                className={`px-3.5 py-2 text-[13px] font-medium transition-colors ${
                  active
                    ? "gradient-primary text-white"
                    : "text-[#444656] hover:text-[#131b2e]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Date range */}
        <input
          type="date"
          defaultValue={filters.dateFrom}
          onChange={(e) => updateFilter("dateFrom", e.target.value)}
          className="h-9 px-3 bg-white shadow-coastal rounded-sm border-none text-[13px] text-[#131b2e] outline-none focus:ring-1 focus:ring-[#3052ff]"
        />
        <input
          type="date"
          defaultValue={filters.dateTo}
          onChange={(e) => updateFilter("dateTo", e.target.value)}
          className="h-9 px-3 bg-white shadow-coastal rounded-sm border-none text-[13px] text-[#131b2e] outline-none focus:ring-1 focus:ring-[#3052ff]"
        />

        {/* Search */}
        <div className="flex items-center gap-1.5 bg-white shadow-coastal rounded-sm px-3 h-9">
          <Search className="size-3.5 text-[#444656] shrink-0" />
          <input
            type="text"
            placeholder="Search calls..."
            defaultValue={filters.search}
            onChange={(e) => {
              const value = e.target.value;
              const timer = setTimeout(() => updateFilter("search", value), 400);
              return () => clearTimeout(timer);
            }}
            className="border-none bg-transparent outline-none text-[13px] text-[#131b2e] placeholder:text-[#444656] w-36"
          />
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl shadow-coastal overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Lead Name", "Phone", "Dir", "Duration", "Agent", "Campaign", "Disposition", "Date / Time", ""].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-[11.5px] font-semibold text-[#444656] uppercase tracking-wide bg-[#f2f3ff]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calls.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-[#444656]">
                  No calls found.
                </td>
              </tr>
            ) : (
              calls.map((call, idx) => {
                const isEven = idx % 2 === 1;
                const isOut = call.direction === "OUTBOUND";
                return (
                  <tr
                    key={call.id}
                    className={`cursor-pointer transition-colors hover:bg-[#eaedff] ${isEven ? "bg-[#faf8ff]" : "bg-white"}`}
                    onClick={() => router.push(`/calls/${call.id}`)}
                  >
                    {/* Lead Name */}
                    <td className="px-4 py-[11px] text-[13.5px] font-semibold text-[#131b2e]">
                      {call.lead?.businessName || call.lead?.contactName || "--"}
                    </td>
                    {/* Phone */}
                    <td className="px-4 py-[11px] text-[13px] text-[#444656]">
                      {call.lead?.phone || call.phoneNumber}
                    </td>
                    {/* Direction */}
                    <td className="px-4 py-[11px]">
                      {isOut ? (
                        <span className="text-[#16a34a] font-bold text-base leading-none" title="Outbound">↑</span>
                      ) : (
                        <span className="text-[#3052ff] font-bold text-base leading-none" title="Inbound">↓</span>
                      )}
                    </td>
                    {/* Duration */}
                    <td className="px-4 py-[11px] text-[13.5px] text-[#131b2e]">
                      {formatDuration(call.duration)}
                    </td>
                    {/* Agent */}
                    <td className="px-4 py-[11px] text-[13.5px] text-[#131b2e]">
                      {call.agent.name}
                    </td>
                    {/* Campaign — not on record directly, show -- */}
                    <td className="px-4 py-[11px] text-[13px] text-[#444656]">
                      --
                    </td>
                    {/* Disposition */}
                    <td className="px-4 py-[11px]">
                      <DispositionBadge disposition={call.disposition} />
                    </td>
                    {/* Date/Time */}
                    <td className="px-4 py-[11px] text-[13px] text-[#444656] whitespace-nowrap">
                      {format(new Date(call.startedAt), "MMM d, h:mm a")}
                    </td>
                    {/* Play */}
                    <td className="px-4 py-[11px]" onClick={(e) => e.stopPropagation()}>
                      <Link href={`/calls/${call.id}`}>
                        <button
                          className="w-7 h-7 rounded-full bg-[#f2f3ff] hover:bg-[#eaedff] inline-flex items-center justify-center text-[#3052ff] transition-colors"
                          title="View call"
                        >
                          <Play className="size-3 fill-[#3052ff]" />
                        </button>
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Table footer */}
        <div className="flex items-center justify-between px-4 py-3.5 border-t border-[rgba(196,197,217,0.15)]">
          <span className="text-[13px] text-[#444656]">
            {total === 0
              ? "No calls found"
              : `Showing ${start}–${end} of ${total.toLocaleString()} call${total !== 1 ? "s" : ""}`}
          </span>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
                className="w-8 h-8 rounded-sm flex items-center justify-center text-[#444656] hover:bg-[#f2f3ff] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="size-4" />
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                // Show pages around current
                let p: number;
                if (totalPages <= 5) {
                  p = i + 1;
                } else if (page <= 3) {
                  p = i + 1;
                } else if (page >= totalPages - 2) {
                  p = totalPages - 4 + i;
                } else {
                  p = page - 2 + i;
                }
                const isActive = p === page;
                return (
                  <button
                    key={p}
                    onClick={() => goToPage(p)}
                    className={`w-8 h-8 rounded-sm text-[13px] font-medium transition-colors ${
                      isActive
                        ? "gradient-primary text-white"
                        : "text-[#444656] hover:bg-[#f2f3ff]"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                disabled={page >= totalPages}
                onClick={() => goToPage(page + 1)}
                className="w-8 h-8 rounded-sm flex items-center justify-center text-[#444656] hover:bg-[#f2f3ff] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
