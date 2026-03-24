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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { CLIENT_STATUSES } from "@/lib/validations/client";

interface ClientLead {
  id: string;
  businessName: string;
  contactName: string;
  phone: string;
  email: string | null;
}

interface ClientNegotiator {
  id: string;
  name: string;
  email: string;
}

interface Client {
  id: string;
  leadId: string;
  lead: ClientLead;
  programStartDate: string;
  programLength: number;
  monthlyPayment: number;
  totalEnrolledDebt: number;
  totalSettled: number;
  totalFees: number;
  status: string;
  assignedNegotiator: ClientNegotiator | null;
  createdAt: string;
  updatedAt: string;
}

interface ClientTableProps {
  clients: Client[];
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

function computeSavings(totalEnrolledDebt: number, totalSettled: number): string {
  if (!totalEnrolledDebt || !totalSettled) return "--";
  const pct = ((totalEnrolledDebt - totalSettled) / totalEnrolledDebt) * 100;
  return `${pct.toFixed(0)}%`;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ACTIVE: {
    label: "Active",
    className: "bg-green-100 text-green-800",
  },
  ON_HOLD: {
    label: "On Hold",
    className: "bg-yellow-100 text-yellow-800",
  },
  GRADUATED: {
    label: "Completed",
    className: "bg-blue-100 text-blue-800",
  },
  DROPPED: {
    label: "Withdrawn",
    className: "bg-red-100 text-red-800",
  },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? { label: status.replace(/_/g, " "), className: "bg-muted text-muted-foreground" };
  return (
    <span
      className={`inline-block text-[0.68rem] font-semibold px-[0.55rem] py-[0.18rem] rounded-sm ${config.className}`}
    >
      {config.label}
    </span>
  );
}

export function ClientTable({ clients, total, page, totalPages }: ClientTableProps) {
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

  const handlePageChange = (newPage: number) => {
    const qs = createQueryString({ page: String(newPage) });
    router.push(`${pathname}?${qs}`);
  };

  const currentSearch = searchParams.get("search") || "";
  const currentStatus = searchParams.get("status") || "ALL";

  const startItem = clients.length > 0 ? (page - 1) * 20 + 1 : 0;
  const endItem = Math.min(page * 20, total);

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 flex-1 flex-wrap">
          {/* Status filter */}
          <Select value={currentStatus} onValueChange={handleStatusFilter}>
            <SelectTrigger className="w-[150px] h-8 text-xs bg-white shadow-coastal border-0 rounded-sm">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              {CLIENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_CONFIG[s]?.label ?? s.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              defaultValue={currentSearch}
              onChange={(e) => {
                const value = e.target.value;
                if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                searchTimerRef.current = setTimeout(() => handleSearch(value), 400);
              }}
              className="pl-8 h-8 text-xs w-52 bg-surface-container-low border-0 rounded-sm"
            />
          </div>

          {/* Filter icon button */}
          <button className="h-8 px-3 flex items-center gap-1.5 bg-surface-container border-0 rounded-sm text-xs font-medium text-muted-foreground hover:bg-surface-container-high transition-colors">
            <SlidersHorizontal className="size-3.5" />
            Filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-coastal overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead className="text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground bg-surface-container-low py-[0.85rem] px-4">
                Client
              </TableHead>
              <TableHead className="text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground bg-surface-container-low py-[0.85rem] px-4">
                Phone
              </TableHead>
              <TableHead className="text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground bg-surface-container-low py-[0.85rem] px-4">
                Total Debt
              </TableHead>
              <TableHead className="text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground bg-surface-container-low py-[0.85rem] px-4">
                Settled
              </TableHead>
              <TableHead className="text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground bg-surface-container-low py-[0.85rem] px-4">
                Savings
              </TableHead>
              <TableHead className="text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground bg-surface-container-low py-[0.85rem] px-4">
                Program Start
              </TableHead>
              <TableHead className="text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground bg-surface-container-low py-[0.85rem] px-4">
                Status
              </TableHead>
              <TableHead className="text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground bg-surface-container-low py-[0.85rem] px-4">
                Negotiator
              </TableHead>
              <TableHead className="bg-surface-container-low py-[0.85rem] px-4 w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length === 0 ? (
              <TableRow className="border-0">
                <TableCell
                  colSpan={9}
                  className="h-28 text-center text-sm text-muted-foreground"
                >
                  No clients found.
                </TableCell>
              </TableRow>
            ) : (
              clients.map((client, idx) => (
                <TableRow
                  key={client.id}
                  className={`border-0 cursor-pointer transition-colors hover:bg-surface-container ${
                    idx % 2 === 1 ? "bg-surface-container-low" : "bg-white"
                  }`}
                  onClick={() => router.push(`/clients/${client.id}`)}
                >
                  {/* Client Name — business + contact stacked */}
                  <TableCell className="py-[0.7rem] px-4">
                    <div className="flex flex-col">
                      <span className="text-[0.82rem] font-semibold leading-tight">
                        {client.lead.businessName}
                      </span>
                      <span className="text-[0.7rem] text-muted-foreground leading-tight mt-0.5">
                        {client.lead.contactName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-[0.7rem] px-4 text-[0.8rem]">
                    {formatPhone(client.lead.phone)}
                  </TableCell>
                  <TableCell className="py-[0.7rem] px-4 text-[0.8rem] font-semibold">
                    {formatCurrency(client.totalEnrolledDebt)}
                  </TableCell>
                  <TableCell className="py-[0.7rem] px-4 text-[0.8rem]">
                    {formatCurrency(client.totalSettled)}
                  </TableCell>
                  <TableCell className="py-[0.7rem] px-4 text-[0.8rem] font-semibold text-emerald-600">
                    {computeSavings(client.totalEnrolledDebt, client.totalSettled)}
                  </TableCell>
                  <TableCell className="py-[0.7rem] px-4 text-[0.8rem] text-muted-foreground">
                    {formatDate(client.programStartDate)}
                  </TableCell>
                  <TableCell className="py-[0.7rem] px-4">
                    <StatusBadge status={client.status} />
                  </TableCell>
                  <TableCell className="py-[0.7rem] px-4 text-[0.8rem] text-muted-foreground">
                    {client.assignedNegotiator?.name ?? "--"}
                  </TableCell>
                  <TableCell className="py-[0.7rem] px-4" onClick={(e) => e.stopPropagation()}>
                    <button className="p-1 rounded-sm text-muted-foreground hover:bg-surface-container transition-colors">
                      <MoreHorizontal className="size-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination inside table card */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-surface-container-low">
          <span className="text-[0.8rem] text-muted-foreground">
            {clients.length > 0
              ? `Showing ${startItem}–${endItem} of ${total} clients`
              : "No clients"}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-sm text-muted-foreground hover:bg-surface-container-low"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="size-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  onClick={() => handlePageChange(p)}
                  className={`size-8 flex items-center justify-center rounded-sm text-[0.8rem] font-medium transition-colors ${
                    p === page
                      ? "gradient-primary text-white"
                      : "bg-surface-container-low text-muted-foreground hover:bg-surface-container"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-sm text-muted-foreground hover:bg-surface-container-low"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { StatusBadge as ClientStatusBadge, formatCurrency, formatDate };
