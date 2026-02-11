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

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  GRADUATED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  DROPPED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  ON_HOLD: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

function ClientStatusBadge({ status }: { status: string }) {
  const colorClass = STATUS_COLORS[status] || "";
  return (
    <Badge variant="secondary" className={`text-xs ${colorClass}`}>
      {status.replace(/_/g, " ")}
    </Badge>
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

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
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
            {CLIENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, " ")}
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
              <TableHead className="text-right">Total Debt</TableHead>
              <TableHead className="text-right">Settled</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Negotiator</TableHead>
              <TableHead>Program Start</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No clients found.
                </TableCell>
              </TableRow>
            ) : (
              clients.map((client) => (
                <TableRow
                  key={client.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/clients/${client.id}`)}
                >
                  <TableCell className="font-medium">
                    {client.lead.businessName}
                  </TableCell>
                  <TableCell>{client.lead.contactName}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(client.totalEnrolledDebt)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(client.totalSettled)}
                  </TableCell>
                  <TableCell>
                    <ClientStatusBadge status={client.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {client.assignedNegotiator?.name ?? "--"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(client.programStartDate)}
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
          Showing {clients.length > 0 ? (page - 1) * 20 + 1 : 0} to{" "}
          {Math.min(page * 20, total)} of {total} clients
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

export { ClientStatusBadge, formatCurrency, formatDate };
