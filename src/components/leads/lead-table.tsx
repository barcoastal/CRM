"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useRef } from "react";
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
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { LEAD_STATUSES, LEAD_SOURCES } from "@/lib/validations/lead";

interface LeadAssignee {
  id: string;
  name: string;
  email: string;
}

interface Lead {
  id: string;
  businessName: string;
  contactName: string;
  phone: string;
  email: string | null;
  totalDebtEst: number | null;
  score: number | null;
  status: string;
  source: string;
  assignedTo: LeadAssignee | null;
  createdAt: string;
}

interface LeadTableProps {
  leads: Lead[];
  total: number;
  page: number;
  totalPages: number;
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return <Badge variant="secondary" className="text-xs">N/A</Badge>;
  }
  let className = "";
  if (score >= 75) {
    className = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  } else if (score >= 50) {
    className = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
  } else {
    className = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  }
  return (
    <Badge variant="secondary" className={`text-xs ${className}`}>
      {score}
    </Badge>
  );
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  CONTACTED: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  QUALIFIED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  UNQUALIFIED: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  CALLBACK: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  ENROLLED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  LOST: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  DNC: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
};

function StatusBadge({ status }: { status: string }) {
  const colorClass = STATUS_COLORS[status] || "";
  return (
    <Badge variant="secondary" className={`text-xs ${colorClass}`}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function formatSourceLabel(source: string): string {
  return source
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export function LeadTable({ leads, total, page, totalPages }: LeadTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const createQueryString = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      return params.toString();
    },
    [searchParams]
  );

  const handleSearch = (value: string) => {
    const qs = createQueryString({ search: value, page: "1" });
    router.push(`${pathname}?${qs}`);
  };

  const handleStatusFilter = (value: string) => {
    const qs = createQueryString({ status: value === "ALL" ? "" : value, page: "1" });
    router.push(`${pathname}?${qs}`);
  };

  const handleSourceFilter = (value: string) => {
    const qs = createQueryString({ source: value === "ALL" ? "" : value, page: "1" });
    router.push(`${pathname}?${qs}`);
  };

  const handlePageChange = (newPage: number) => {
    const qs = createQueryString({ page: String(newPage) });
    router.push(`${pathname}?${qs}`);
  };

  const currentSearch = searchParams.get("search") || "";
  const currentStatus = searchParams.get("status") || "ALL";
  const currentSource = searchParams.get("source") || "ALL";

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            defaultValue={currentSearch}
            onChange={(e) => {
              const value = e.target.value;
              if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
              searchTimerRef.current = setTimeout(() => handleSearch(value), 400);
            }}
            className="pl-9"
          />
        </div>
        <Select value={currentStatus} onValueChange={handleStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={currentSource} onValueChange={handleSourceFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Sources</SelectItem>
            {LEAD_SOURCES.map((s) => (
              <SelectItem key={s} value={s}>
                {formatSourceLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="text-right">Debt Est</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Assigned To</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No leads found.
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/leads/${lead.id}`)}
                >
                  <TableCell className="font-medium">{lead.businessName}</TableCell>
                  <TableCell>{lead.contactName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatPhone(lead.phone)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(lead.totalDebtEst)}
                  </TableCell>
                  <TableCell>
                    <ScoreBadge score={lead.score} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={lead.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatSourceLabel(lead.source)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {lead.assignedTo?.name ?? "--"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {leads.length > 0 ? (page - 1) * 20 + 1 : 0} to{" "}
          {Math.min(page * 20, total)} of {total} leads
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export { ScoreBadge, StatusBadge, formatCurrency, formatPhone, formatSourceLabel };
