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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, MoreHorizontal, Search } from "lucide-react";
import { LEAD_STATUSES, LEAD_SOURCES } from "@/lib/validations/lead";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeadAssignee {
  id: string;
  name: string;
  email: string;
}

interface Lead {
  id: string;
  sfId: string | null;
  businessName: string;
  contactName: string;
  phone: string;
  email: string | null;
  totalDebtEst: number | null;
  score: number | null;
  status: string;
  source: string;
  subDisposition: string | null;
  assignedTo: LeadAssignee | null;
  createdAt: string;
  lastContactedAt: string | null;
}

interface LeadTableProps {
  leads: Lead[];
  total: number;
  page: number;
  totalPages: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

export function formatSourceLabel(source: string): string {
  return source
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function formatDate(iso: string | null): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { badge: string; text: string; pillar: string }
> = {
  NEW: {
    badge: "rgba(48,82,255,0.08)",
    text: "#3052FF",
    pillar: "#3052FF",
  },
  CONTACTED: {
    badge: "rgba(245,158,11,0.08)",
    text: "#b45309",
    pillar: "#F59E0B",
  },
  QUALIFIED: {
    badge: "rgba(5,150,105,0.08)",
    text: "#059669",
    pillar: "#10B981",
  },
  UNQUALIFIED: {
    badge: "rgba(100,116,139,0.08)",
    text: "#64748b",
    pillar: "#94a3b8",
  },
  CALLBACK: {
    badge: "rgba(245,158,11,0.08)",
    text: "#b45309",
    pillar: "#F59E0B",
  },
  OPPORTUNITY: {
    badge: "rgba(6,182,212,0.08)",
    text: "#0891b2",
    pillar: "#06b6d4",
  },
  ENROLLED: {
    badge: "rgba(5,150,105,0.08)",
    text: "#059669",
    pillar: "#059669",
  },
  LOST: {
    badge: "rgba(186,26,26,0.08)",
    text: "#ba1a1a",
    pillar: "#EF4444",
  },
  DNC: {
    badge: "rgba(234,88,12,0.08)",
    text: "#ea580c",
    pillar: "#f97316",
  },
};

export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ background: "#f2f3ff", color: "#444656" }}
      >
        N/A
      </span>
    );
  }
  let bg = "rgba(48,82,255,0.08)";
  let color = "#3052FF";
  if (score >= 75) {
    bg = "rgba(5,150,105,0.08)";
    color = "#059669";
  } else if (score >= 50) {
    bg = "rgba(245,158,11,0.08)";
    color = "#b45309";
  } else {
    bg = "rgba(186,26,26,0.08)";
    color = "#ba1a1a";
  }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: bg, color }}
    >
      {score}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    badge: "#f2f3ff",
    text: "#444656",
    pillar: "#94a3b8",
  };
  return (
    <span
      className="inline-block px-2.5 py-0.5 rounded-full text-[12px] font-semibold"
      style={{ background: cfg.badge, color: cfg.text }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ─── Filter Bar (exported so page can render it above the table) ──────────────

export function LeadFilterBar() {
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

  const currentSearch = searchParams.get("search") || "";
  const currentStatus = searchParams.get("status") || "ALL";
  const currentSource = searchParams.get("source") || "ALL";

  return (
    <div className="flex flex-wrap items-center gap-3 mb-5">
      <Select value={currentStatus} onValueChange={handleStatusFilter}>
        <SelectTrigger
          className="w-[160px] border-0 text-[13px] font-medium"
          style={{ background: "#f2f3ff", color: "#444656", boxShadow: "none" }}
        >
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
        <SelectTrigger
          className="w-[160px] border-0 text-[13px] font-medium"
          style={{ background: "#f2f3ff", color: "#444656", boxShadow: "none" }}
        >
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

      {/* Search input */}
      <div className="relative ml-auto">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 size-[15px]"
          style={{ color: "#444656" }}
        />
        <input
          type="text"
          placeholder="Search by name, phone, email..."
          defaultValue={currentSearch}
          onChange={(e) => {
            const value = e.target.value;
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
            searchTimerRef.current = setTimeout(() => handleSearch(value), 400);
          }}
          className="pl-9 pr-4 py-2 rounded-[4px] text-[13px] outline-none border-0 min-w-[260px]"
          style={{
            background: "#f2f3ff",
            color: "#131b2e",
            fontFamily: "inherit",
          }}
        />
      </div>
    </div>
  );
}

// ─── Main Table Component ─────────────────────────────────────────────────────

export function LeadTable({ leads, total, page, totalPages }: LeadTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [allChecked, setAllChecked] = useState(false);

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

  const handlePageChange = (newPage: number) => {
    const qs = createQueryString({ page: String(newPage) });
    router.push(`${pathname}?${qs}`);
  };

  const toggleAll = () => {
    if (allChecked) {
      setCheckedIds(new Set());
      setAllChecked(false);
    } else {
      setCheckedIds(new Set(leads.map((l) => l.id)));
      setAllChecked(true);
    }
  };

  const toggleOne = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "#ffffff",
        boxShadow: "0 12px 40px rgba(19,27,46,0.06)",
      }}
    >
      <Table>
        <TableHeader>
          <TableRow
            className="border-0"
            style={{ background: "#ffffff" }}
          >
            {/* Checkbox col */}
            <TableHead className="w-10 pl-4 pr-2 border-0">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={toggleAll}
                className="w-4 h-4 cursor-pointer"
                style={{ accentColor: "#3052FF" }}
              />
            </TableHead>
            <TableHead
              className="border-0 text-[11.5px] font-semibold uppercase tracking-wide pl-3"
              style={{ color: "#444656" }}
            >
              Lead Name
            </TableHead>
            <TableHead
              className="border-0 text-[11.5px] font-semibold uppercase tracking-wide"
              style={{ color: "#444656" }}
            >
              Lead ID
            </TableHead>
            <TableHead
              className="border-0 text-[11.5px] font-semibold uppercase tracking-wide"
              style={{ color: "#444656" }}
            >
              Phone
            </TableHead>
            <TableHead
              className="border-0 text-[11.5px] font-semibold uppercase tracking-wide"
              style={{ color: "#444656" }}
            >
              Email
            </TableHead>
            <TableHead
              className="border-0 text-[11.5px] font-semibold uppercase tracking-wide"
              style={{ color: "#444656" }}
            >
              Debt Estimate
            </TableHead>
            <TableHead
              className="border-0 text-[11.5px] font-semibold uppercase tracking-wide"
              style={{ color: "#444656" }}
            >
              Source
            </TableHead>
            <TableHead
              className="border-0 text-[11.5px] font-semibold uppercase tracking-wide"
              style={{ color: "#444656" }}
            >
              Status
            </TableHead>
            <TableHead
              className="border-0 text-[11.5px] font-semibold uppercase tracking-wide"
              style={{ color: "#444656" }}
            >
              Sub Disposition
            </TableHead>
            <TableHead
              className="border-0 text-[11.5px] font-semibold uppercase tracking-wide"
              style={{ color: "#444656" }}
            >
              Assigned To
            </TableHead>
            <TableHead
              className="border-0 text-[11.5px] font-semibold uppercase tracking-wide"
              style={{ color: "#444656" }}
            >
              Last Contact
            </TableHead>
            {/* Actions */}
            <TableHead className="border-0 w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={12}
                className="h-24 text-center text-[13.5px]"
                style={{ color: "#444656" }}
              >
                No leads found.
              </TableCell>
            </TableRow>
          ) : (
            leads.map((lead, idx) => {
              const cfg = STATUS_CONFIG[lead.status] ?? {
                pillar: "#94a3b8",
              };
              const isEven = idx % 2 === 1;
              return (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer border-0 transition-colors"
                  style={{
                    background: isEven ? "#f2f3ff" : "#ffffff",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLTableRowElement).style.background =
                      "#eaedff")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLTableRowElement).style.background =
                      isEven ? "#f2f3ff" : "#ffffff")
                  }
                  onClick={() => router.push(`/leads/${lead.id}`)}
                >
                  {/* Checkbox + status pillar */}
                  <TableCell
                    className="w-10 pl-0 pr-2 relative border-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Status pillar */}
                    <span
                      className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-[2px]"
                      style={{ background: cfg.pillar }}
                    />
                    <span className="pl-4 flex items-center">
                      <input
                        type="checkbox"
                        checked={checkedIds.has(lead.id)}
                        onChange={() => toggleOne(lead.id)}
                        className="w-4 h-4 cursor-pointer"
                        style={{ accentColor: "#3052FF" }}
                      />
                    </span>
                  </TableCell>

                  {/* Lead Name */}
                  <TableCell className="border-0 py-3 pl-3">
                    <div
                      className="font-semibold text-[13.5px]"
                      style={{ color: "#131b2e" }}
                    >
                      {lead.businessName}
                    </div>
                    <div
                      className="text-[12px] mt-0.5"
                      style={{ color: "#444656" }}
                    >
                      {lead.contactName}
                    </div>
                  </TableCell>

                  {/* Lead ID (SF parity column) */}
                  <TableCell
                    className="text-[12px] font-mono border-0 whitespace-nowrap"
                    style={{ color: "#444656" }}
                  >
                    {lead.sfId
                      ? lead.sfId.slice(0, 15)
                      : lead.id.slice(-8).toUpperCase()}
                  </TableCell>

                  <TableCell
                    className="text-[13.5px] border-0 whitespace-nowrap"
                    style={{ color: "#131b2e" }}
                  >
                    {formatPhone(lead.phone)}
                  </TableCell>

                  <TableCell
                    className="text-[13.5px] border-0 whitespace-nowrap"
                    style={{ color: "#444656" }}
                  >
                    {lead.email ?? "--"}
                  </TableCell>

                  <TableCell
                    className="text-[13.5px] font-medium border-0 whitespace-nowrap"
                    style={{ color: "#131b2e" }}
                  >
                    {formatCurrency(lead.totalDebtEst)}
                  </TableCell>

                  <TableCell
                    className="text-[13.5px] border-0 whitespace-nowrap"
                    style={{ color: "#444656" }}
                  >
                    {formatSourceLabel(lead.source)}
                  </TableCell>

                  <TableCell className="border-0">
                    <StatusBadge status={lead.status} />
                  </TableCell>

                  <TableCell
                    className="text-[13px] border-0 whitespace-nowrap"
                    style={{ color: "#444656" }}
                  >
                    {lead.subDisposition ?? "--"}
                  </TableCell>

                  <TableCell
                    className="text-[13.5px] border-0 whitespace-nowrap"
                    style={{ color: "#444656" }}
                  >
                    {lead.assignedTo?.name ?? "--"}
                  </TableCell>

                  <TableCell
                    className="text-[13.5px] border-0 whitespace-nowrap"
                    style={{ color: "#444656" }}
                  >
                    {formatDate(lead.lastContactedAt)}
                  </TableCell>

                  {/* Actions menu */}
                  <TableCell
                    className="border-0 pr-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="w-8 h-8 flex items-center justify-center rounded-[4px] border-0 transition-colors"
                          style={{ background: "transparent", color: "#444656" }}
                          onMouseEnter={(e) =>
                            ((e.currentTarget as HTMLButtonElement).style.background =
                              "#f2f3ff")
                          }
                          onMouseLeave={(e) =>
                            ((e.currentTarget as HTMLButtonElement).style.background =
                              "transparent")
                          }
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          onClick={() => router.push(`/leads/${lead.id}`)}
                        >
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => router.push(`/leads/${lead.id}/edit`)}
                        >
                          Edit
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* Pagination Footer */}
      <div
        className="flex items-center justify-between px-6 py-4 border-t-0"
        style={{ borderTop: "1px solid #eaedff" }}
      >
        <p className="text-[13px]" style={{ color: "#444656" }}>
          Showing {leads.length > 0 ? (page - 1) * 20 + 1 : 0}–
          {Math.min(page * 20, total)} of {total.toLocaleString()} leads
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            className="w-9 h-9 flex items-center justify-center rounded-[4px] text-[13px] font-medium border-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "transparent",
              color: "#444656",
              fontFamily: "inherit",
            }}
          >
            <ChevronLeft className="size-4" />
          </button>

          {/* Page number buttons */}
          {Array.from({ length: Math.min(totalPages || 1, 5) }, (_, i) => {
            const p = i + 1;
            return (
              <button
                key={p}
                onClick={() => handlePageChange(p)}
                className="w-9 h-9 flex items-center justify-center rounded-[4px] text-[13px] font-medium border-0 transition-colors"
                style={{
                  background: p === page ? "#3052FF" : "transparent",
                  color: p === page ? "#ffffff" : "#444656",
                  fontFamily: "inherit",
                }}
              >
                {p}
              </button>
            );
          })}

          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
            className="w-9 h-9 flex items-center justify-center rounded-[4px] text-[13px] font-medium border-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "transparent",
              color: "#444656",
              fontFamily: "inherit",
            }}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export { ScoreBadge as default };
