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
import { OPPORTUNITY_STAGES } from "@/lib/validations/opportunity";

interface Opportunity {
  id: string;
  stage: string;
  estimatedValue: number | null;
  expectedCloseDate: string | null;
  createdAt: string;
  lead: {
    id: string;
    businessName: string;
    contactName: string;
    phone: string;
    email: string | null;
    totalDebtEst: number | null;
  };
  assignedTo: { id: string; name: string; email: string } | null;
}

interface OpportunityTableProps {
  opportunities: Opportunity[];
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const STAGE_COLORS: Record<string, string> = {
  WORKING_OPPORTUNITY: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  WAITING_FOR_AGREEMENTS: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  READY_TO_CLOSE: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  CONTRACT_SENT: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
  CONTRACT_SIGNED: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  ARCHIVED: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  CLOSED_WON_FIRST_PAYMENT: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  CLOSED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export function StageBadge({ stage }: { stage: string }) {
  const colorClass = STAGE_COLORS[stage] || "";
  return (
    <Badge variant="secondary" className={`text-xs ${colorClass}`}>
      {stage.replace(/_/g, " ")}
    </Badge>
  );
}

function formatStageLabel(stage: string): string {
  return stage.replace(/_/g, " ");
}

export function OpportunityTable({ opportunities, total, page, totalPages }: OpportunityTableProps) {
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

  const handleStageFilter = (value: string) => {
    const qs = createQueryString({ stage: value === "ALL" ? "" : value, page: "1" });
    router.push(`${pathname}?${qs}`);
  };

  const handlePageChange = (newPage: number) => {
    const qs = createQueryString({ page: String(newPage) });
    router.push(`${pathname}?${qs}`);
  };

  const currentSearch = searchParams.get("search") || "";
  const currentStage = searchParams.get("stage") || "ALL";

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search opportunities..."
            defaultValue={currentSearch}
            onChange={(e) => {
              const value = e.target.value;
              if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
              searchTimerRef.current = setTimeout(() => handleSearch(value), 400);
            }}
            className="pl-9"
          />
        </div>
        <Select value={currentStage} onValueChange={handleStageFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="All Stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Stages</SelectItem>
            {OPPORTUNITY_STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                {formatStageLabel(s)}
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
              <TableHead>Stage</TableHead>
              <TableHead className="text-right">Est. Value</TableHead>
              <TableHead>Expected Close</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {opportunities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No opportunities found.
                </TableCell>
              </TableRow>
            ) : (
              opportunities.map((opp) => (
                <TableRow
                  key={opp.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/opportunities/${opp.id}`)}
                >
                  <TableCell className="font-medium">{opp.lead.businessName}</TableCell>
                  <TableCell>{opp.lead.contactName}</TableCell>
                  <TableCell>
                    <StageBadge stage={opp.stage} />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(opp.estimatedValue)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(opp.expectedCloseDate)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {opp.assignedTo?.name ?? "--"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(opp.createdAt)}
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
          Showing {opportunities.length > 0 ? (page - 1) * 20 + 1 : 0} to{" "}
          {Math.min(page * 20, total)} of {total} opportunities
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

export { formatCurrency, formatDate };
