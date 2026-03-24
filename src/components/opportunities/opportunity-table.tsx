"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useRef, useState } from "react";
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
import { Search, ChevronLeft, ChevronRight, LayoutList, Kanban, SlidersHorizontal } from "lucide-react";
import { OPPORTUNITY_STAGES } from "@/lib/validations/opportunity";
import { OpportunityKanban } from "@/components/opportunities/opportunity-kanban";

interface Opportunity {
  id: string;
  stage: string;
  totalDebt: number | null;
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

export function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatStageLabel(stage: string): string {
  return stage.replace(/_/g, " ");
}

const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  WORKING_OPPORTUNITY:       { bg: "#e0e7ff", text: "#4338ca" },
  WAITING_FOR_AGREEMENTS:    { bg: "#e0e7ff", text: "#3730a3" },
  READY_TO_CLOSE:            { bg: "#fef3c7", text: "#92400e" },
  CONTRACT_SENT:             { bg: "#d1fae5", text: "#065f46" },
  CONTRACT_SIGNED:           { bg: "#d1fae5", text: "#047857" },
  ARCHIVED:                  { bg: "#f3f4f6", text: "#374151" },
  CLOSED_WON_FIRST_PAYMENT:  { bg: "#dcfce7", text: "#166534" },
  CLOSED:                    { bg: "#fee2e2", text: "#991b1b" },
};

export function StageBadge({ stage }: { stage: string }) {
  const colors = STAGE_COLORS[stage] || { bg: "#f2f3ff", text: "#444656" };
  return (
    <span
      className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded"
      style={{ background: colors.bg, color: colors.text }}
    >
      {formatStageLabel(stage)}
    </span>
  );
}

export function OpportunityTable({ opportunities, total, page, totalPages }: OpportunityTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Default to kanban view
  const [view, setView] = useState<"table" | "kanban">("kanban");

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
      {/* ── Filter Bar ───────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div
          className="relative flex-1 max-w-xs flex items-center gap-2 rounded"
          style={{ background: "#f2f3ff", padding: "0.45rem 0.85rem" }}
        >
          <Search className="size-4 flex-shrink-0" style={{ color: "#444656" }} />
          <input
            placeholder="Search opportunities..."
            defaultValue={currentSearch}
            onChange={(e) => {
              const value = e.target.value;
              if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
              searchTimerRef.current = setTimeout(() => handleSearch(value), 400);
            }}
            className="bg-transparent border-none outline-none text-[13.5px] w-full placeholder:text-[#444656]"
            style={{ color: "#131b2e" }}
          />
        </div>

        {/* Stage filter */}
        <Select value={currentStage} onValueChange={handleStageFilter}>
          <SelectTrigger
            className="w-[200px] border-none shadow-none text-[13px]"
            style={{ background: "#f2f3ff", color: "#131b2e" }}
          >
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

        {/* Spacer */}
        <div className="flex-1" />

        {/* Filter icon button */}
        <button
          className="flex items-center gap-1.5 rounded text-[13px] font-medium px-3 py-[7px] transition-opacity hover:opacity-80"
          style={{ background: "#eaedff", color: "#444656", border: "none" }}
        >
          <SlidersHorizontal className="size-3.5" />
          Filters
        </button>

        {/* View toggle */}
        <div
          className="flex rounded overflow-hidden"
          style={{ background: "#eaedff" }}
        >
          <button
            onClick={() => setView("table")}
            className="flex items-center gap-1.5 px-3 py-[7px] text-[12px] font-medium transition-all"
            style={{
              background: view === "table" ? "#3052ff" : "transparent",
              color: view === "table" ? "#fff" : "#444656",
              border: "none",
            }}
          >
            <LayoutList className="size-3.5" />
            Table
          </button>
          <button
            onClick={() => setView("kanban")}
            className="flex items-center gap-1.5 px-3 py-[7px] text-[12px] font-medium transition-all"
            style={{
              background: view === "kanban" ? "#3052ff" : "transparent",
              color: view === "kanban" ? "#fff" : "#444656",
              border: "none",
            }}
          >
            <Kanban className="size-3.5" />
            Kanban
          </button>
        </div>
      </div>

      {/* ── Kanban View ──────────────────────────────── */}
      {view === "kanban" && (
        <OpportunityKanban opportunities={opportunities} />
      )}

      {/* ── Table View ───────────────────────────────── */}
      {view === "table" && (
        <>
          <div
            className="rounded-xl overflow-hidden"
            style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
          >
            <Table>
              <TableHeader>
                <TableRow style={{ background: "#f2f3ff" }}>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#444656" }}>Business Name</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#444656" }}>Contact</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#444656" }}>Stage</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#444656" }}>Total Debt</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#444656" }}>Expected Close</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#444656" }}>Assigned To</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#444656" }}>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opportunities.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-32 text-center text-[13px]"
                      style={{ color: "#444656" }}
                    >
                      No opportunities found.
                    </TableCell>
                  </TableRow>
                ) : (
                  opportunities.map((opp) => (
                    <TableRow
                      key={opp.id}
                      className="cursor-pointer transition-colors"
                      style={{ background: "#ffffff" }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = "#faf8ff";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = "#ffffff";
                      }}
                      onClick={() => router.push(`/opportunities/${opp.id}`)}
                    >
                      <TableCell
                        className="font-semibold text-[13.5px]"
                        style={{ color: "#131b2e", fontFamily: "Manrope, sans-serif" }}
                      >
                        {opp.lead.businessName}
                      </TableCell>
                      <TableCell className="text-[13px]" style={{ color: "#444656" }}>
                        {opp.lead.contactName}
                      </TableCell>
                      <TableCell>
                        <StageBadge stage={opp.stage} />
                      </TableCell>
                      <TableCell
                        className="text-right font-semibold text-[13px]"
                        style={{ color: "#131b2e" }}
                      >
                        {formatCurrency(opp.totalDebt ?? opp.lead.totalDebtEst)}
                      </TableCell>
                      <TableCell className="text-[13px]" style={{ color: "#444656" }}>
                        {formatDate(opp.expectedCloseDate)}
                      </TableCell>
                      <TableCell className="text-[13px]" style={{ color: "#444656" }}>
                        {opp.assignedTo?.name ?? "--"}
                      </TableCell>
                      <TableCell className="text-[13px]" style={{ color: "#444656" }}>
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
            <p className="text-[12px]" style={{ color: "#444656" }}>
              Showing {opportunities.length > 0 ? (page - 1) * 20 + 1 : 0}–
              {Math.min(page * 20, total)} of {total} opportunities
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded text-[12px] font-medium disabled:opacity-40 transition-opacity"
                style={{ background: "#eaedff", color: "#444656", border: "none" }}
              >
                <ChevronLeft className="size-3.5" />
                Previous
              </button>
              <span className="text-[12px]" style={{ color: "#444656" }}>
                Page {page} of {totalPages || 1}
              </span>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                className="flex items-center gap-1 px-3 py-1.5 rounded text-[12px] font-medium disabled:opacity-40 transition-opacity"
                style={{ background: "#eaedff", color: "#444656", border: "none" }}
              >
                Next
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
