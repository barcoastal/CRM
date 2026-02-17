"use client";

import { Card, CardContent } from "@/components/ui/card";
import { NegotiationTimeline } from "@/components/debts/negotiation-timeline";

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

interface DebtDetailPanelProps {
  debt: {
    id: string;
    creditorName: string;
    creditorPhone: string | null;
    creditorEmail: string | null;
    accountNumber: string | null;
    originalBalance: number;
    currentBalance: number;
    enrolledBalance: number;
    settledAmount: number | null;
    savingsAmount: number | null;
    savingsPercent: number | null;
    status: string;
    notes: string | null;
    negotiations: NegotiationData[];
  };
  clientId?: string;
  opportunityId?: string;
  onRefresh: () => void;
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

export function DebtDetailPanel({
  debt,
  clientId,
  opportunityId,
  onRefresh,
}: DebtDetailPanelProps) {
  return (
    <div className="space-y-4 pt-2 pb-4 px-4 bg-muted/20 border-t">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Creditor Contact */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase">Phone</p>
          <p className="text-sm">{debt.creditorPhone || "--"}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase">Email</p>
          <p className="text-sm">{debt.creditorEmail || "--"}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase">Account #</p>
          <p className="text-sm">{debt.accountNumber || "--"}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase">Status</p>
          <p className="text-sm font-medium">{debt.status}</p>
        </div>
      </div>

      {/* Settlement Calculator */}
      <Card>
        <CardContent className="py-3">
          <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
            Settlement Calculator
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Original</p>
              <p className="font-medium">{formatCurrency(debt.originalBalance)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Enrolled</p>
              <p className="font-medium">{formatCurrency(debt.enrolledBalance)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Settled For</p>
              <p className="font-medium text-green-600">
                {formatCurrency(debt.settledAmount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Savings</p>
              <p className="font-medium text-green-600">
                {debt.savingsAmount !== null
                  ? `${formatCurrency(debt.savingsAmount)} (${debt.savingsPercent?.toFixed(1)}%)`
                  : "--"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {debt.notes && (
        <p className="text-sm text-muted-foreground">{debt.notes}</p>
      )}

      {/* Negotiation Timeline */}
      <NegotiationTimeline
        negotiations={debt.negotiations}
        clientId={clientId}
        debtId={debt.id}
        onRefresh={onRefresh}
      />
    </div>
  );
}
