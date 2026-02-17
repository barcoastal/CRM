"use client";

import { useState } from "react";
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
import { Plus, ChevronDown, ChevronRight } from "lucide-react";
import { AddDebtDialog } from "@/components/debts/add-debt-dialog";
import { DebtDetailPanel } from "@/components/debts/debt-detail-panel";

interface NegotiationData {
  id: string;
  type: string;
  date: string;
  offerAmount: number | null;
  offerPercent: number | null;
  response: string;
  counterAmount: number | null;
  notes: string | null;
  negotiator: { id: string; name: string };
  createdAt: string;
}

interface DebtData {
  id: string;
  creditorName: string;
  creditorPhone: string | null;
  creditorEmail: string | null;
  accountNumber: string | null;
  originalBalance: number;
  currentBalance: number;
  enrolledBalance: number;
  status: string;
  settledAmount: number | null;
  settledDate: string | null;
  savingsAmount: number | null;
  savingsPercent: number | null;
  notes: string | null;
  negotiations: NegotiationData[];
}

interface DebtTableProps {
  debts: DebtData[];
  clientId?: string;
  opportunityId?: string;
  onRefresh: () => void;
}

const DEBT_STATUS_COLORS: Record<string, string> = {
  ENROLLED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  NEGOTIATING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  SETTLED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  PAID: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  DISPUTED: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  WRITTEN_OFF: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function DebtTable({ debts, clientId, opportunityId, onRefresh }: DebtTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Debts ({debts.length})
        </h3>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" />
          Add Debt
        </Button>
      </div>

      {debts.length === 0 ? (
        <div className="rounded-md border py-12 text-center">
          <p className="text-muted-foreground">No debts recorded yet.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setAddOpen(true)}
          >
            Add First Debt
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Creditor</TableHead>
                <TableHead>Account #</TableHead>
                <TableHead className="text-right">Enrolled</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Settled</TableHead>
                <TableHead className="text-right">Savings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {debts.map((debt) => (
                <>
                  <TableRow
                    key={debt.id}
                    className="cursor-pointer"
                    onClick={() =>
                      setExpandedId(expandedId === debt.id ? null : debt.id)
                    }
                  >
                    <TableCell className="w-8">
                      {expandedId === debt.id ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {debt.creditorName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {debt.accountNumber || "--"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(debt.enrolledBalance)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(debt.currentBalance)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${DEBT_STATUS_COLORS[debt.status] || ""}`}
                      >
                        {debt.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(debt.settledAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {debt.savingsPercent !== null
                        ? `${debt.savingsPercent.toFixed(1)}%`
                        : "--"}
                    </TableCell>
                  </TableRow>
                  {expandedId === debt.id && (
                    <TableRow key={`${debt.id}-detail`}>
                      <TableCell colSpan={8} className="p-0">
                        <DebtDetailPanel
                          debt={debt}
                          clientId={clientId}
                          opportunityId={opportunityId}
                          onRefresh={onRefresh}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AddDebtDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        clientId={clientId}
        opportunityId={opportunityId}
        onSuccess={onRefresh}
      />
    </div>
  );
}
