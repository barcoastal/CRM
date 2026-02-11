"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { format } from "date-fns";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowUpRight,
  ArrowDownLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

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

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
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
      // Reset to page 1 when filtering
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

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by business name..."
          defaultValue={filters.search}
          className="w-64"
          onChange={(e) => {
            const value = e.target.value;
            // Debounce search
            const timer = setTimeout(() => updateFilter("search", value), 400);
            return () => clearTimeout(timer);
          }}
        />
        <Input
          type="date"
          defaultValue={filters.dateFrom}
          className="w-40"
          onChange={(e) => updateFilter("dateFrom", e.target.value)}
        />
        <Input
          type="date"
          defaultValue={filters.dateTo}
          className="w-40"
          onChange={(e) => updateFilter("dateTo", e.target.value)}
        />
        <Select
          value={filters.agentId || "all"}
          onValueChange={(val) => updateFilter("agentId", val)}
        >
          <SelectTrigger className="w-44">
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
        <Select
          value={filters.disposition || "all"}
          onValueChange={(val) => updateFilter("disposition", val)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Dispositions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dispositions</SelectItem>
            {DISPOSITIONS.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.campaignId || "all"}
          onValueChange={(val) => updateFilter("campaignId", val)}
        >
          <SelectTrigger className="w-44">
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
        <Select
          value={filters.direction || "all"}
          onValueChange={(val) => updateFilter("direction", val)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Direction" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Directions</SelectItem>
            <SelectItem value="OUTBOUND">Outbound</SelectItem>
            <SelectItem value="INBOUND">Inbound</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results summary */}
      <p className="text-sm text-muted-foreground">
        {total} call{total !== 1 ? "s" : ""} found
      </p>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date/Time</TableHead>
            <TableHead className="w-10">Dir</TableHead>
            <TableHead>Lead</TableHead>
            <TableHead>Agent</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Disposition</TableHead>
            <TableHead>AI Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {calls.length > 0 ? (
            calls.map((call) => (
              <TableRow
                key={call.id}
                className="cursor-pointer"
                onClick={() => router.push(`/calls/${call.id}`)}
              >
                <TableCell className="text-xs">
                  {format(new Date(call.startedAt), "MMM d, yyyy h:mm a")}
                </TableCell>
                <TableCell>
                  {call.direction === "OUTBOUND" ? (
                    <ArrowUpRight className="size-4 text-blue-500" />
                  ) : (
                    <ArrowDownLeft className="size-4 text-green-500" />
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {call.lead?.businessName || call.phoneNumber}
                </TableCell>
                <TableCell className="text-sm">{call.agent.name}</TableCell>
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
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={7}
                className="h-24 text-center text-muted-foreground"
              >
                No calls found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
