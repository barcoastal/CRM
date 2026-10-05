"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ChevronLeft, ChevronRight } from "@/components/icons/lucide";
import { ListView } from "@/components/slds/list-view";
import styles from "@/components/slds/lightning-list.module.css";
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
      className={`inline-block font-semibold rounded-sm ${config.className}`}
      style={{ fontSize: 11, lineHeight: "18px", padding: "0 6px" }}
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
    <ListView
      entity="Client" entityLabel="Clients" viewName="All Clients" totalCount={total}
      rows={clients} rowHref={client => `/clients/${client.id}`} rowOffset={(page - 1) * 20}
      toolbar={<div className={styles.searchForm}>
        <Select value={currentStatus} onValueChange={handleStatusFilter}>
          <SelectTrigger className="w-[150px] h-8 bg-white"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {CLIENT_STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input type="search" aria-label="Search clients" placeholder="Search this list..." defaultValue={currentSearch}
            onChange={e => {
              const value = e.target.value;
              if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
              searchTimerRef.current = setTimeout(() => handleSearch(value), 400);
            }} className="pl-7 bg-white" />
        </div>
      </div>}
      columns={[
        { key: "name", label: "Client", width: 240, render: c => c.lead.businessName },
        { key: "contact", label: "Contact", width: 180, render: c => c.lead.contactName },
        { key: "phone", label: "Phone", width: 160, render: c => formatPhone(c.lead.phone) },
        { key: "debt", label: "Total Debt", width: 140, render: c => formatCurrency(c.totalEnrolledDebt) },
        { key: "settled", label: "Settled", width: 130, render: c => formatCurrency(c.totalSettled) },
        { key: "savings", label: "Savings", width: 100, render: c => computeSavings(c.totalEnrolledDebt, c.totalSettled) },
        { key: "start", label: "Program Start", width: 150, render: c => formatDate(c.programStartDate) },
        { key: "status", label: "Status", width: 140, render: c => <StatusBadge status={c.status} /> },
        { key: "owner", label: "Negotiator", width: 180, render: c => c.assignedNegotiator?.name ?? "—" },
      ]}
      footer={<div className="flex items-center justify-between gap-3">
        <span>{clients.length > 0 ? `${startItem}–${endItem} of ${total} clients` : "No clients"}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" aria-label="Previous page" onClick={() => handlePageChange(page - 1)} disabled={page <= 1}><ChevronLeft className="size-4" /></Button>
          <span>Page {page} of {Math.max(1, totalPages)}</span>
          <Button variant="outline" size="sm" aria-label="Next page" onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages}><ChevronRight className="size-4" /></Button>
        </div>
      </div>}
    />
  );
}

export { StatusBadge as ClientStatusBadge, formatCurrency, formatDate };
