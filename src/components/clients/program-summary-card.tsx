"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProgramSummaryCardProps {
  totalEnrolledDebt: number;
  totalSettled: number;
  totalFees: number;
  monthlyPayment: number;
  programLength: number;
  programStartDate: string;
  status: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function ProgramSummaryCard({
  totalEnrolledDebt,
  totalSettled,
  totalFees,
  monthlyPayment,
  programLength,
  programStartDate,
  status,
}: ProgramSummaryCardProps) {
  const savingsPercent =
    totalEnrolledDebt > 0
      ? ((totalEnrolledDebt - totalSettled) / totalEnrolledDebt) * 100
      : 0;

  const start = new Date(programStartDate);
  const now = new Date();
  const monthsElapsed = Math.max(
    0,
    (now.getFullYear() - start.getFullYear()) * 12 +
      (now.getMonth() - start.getMonth())
  );
  const progressPercent = Math.min(100, (monthsElapsed / programLength) * 100);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Program Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Enrolled Debt
            </p>
            <p className="text-lg font-bold">{formatCurrency(totalEnrolledDebt)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Settled
            </p>
            <p className="text-lg font-bold text-green-600">
              {formatCurrency(totalSettled)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Savings %
            </p>
            <p className="text-lg font-bold">
              {totalSettled > 0 ? `${savingsPercent.toFixed(1)}%` : "--"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Monthly Payment
            </p>
            <p className="text-lg font-bold">{formatCurrency(monthlyPayment)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Fees
            </p>
            <p className="text-lg font-bold">{formatCurrency(totalFees)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Status
            </p>
            <p className="text-lg font-bold">{status.replace(/_/g, " ")}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Program Progress</span>
            <span>
              {monthsElapsed} / {programLength} months
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
