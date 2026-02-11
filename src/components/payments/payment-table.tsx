"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, CalendarClock, AlertTriangle, Plus, CheckCircle } from "lucide-react";
import { RecordPaymentDialog } from "./record-payment-dialog";

interface PaymentDebt {
  creditorName: string;
}

export interface PaymentData {
  id: string;
  clientId: string;
  debtId: string | null;
  type: string;
  amount: number;
  scheduledDate: string;
  paidDate: string | null;
  status: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  debt: PaymentDebt | null;
}

export interface PaymentTableProps {
  payments: PaymentData[];
  clientId: string;
  onRefresh: () => void;
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  MISSED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-600",
};

const TYPE_LABELS: Record<string, string> = {
  CLIENT_PAYMENT: "Program Payment",
  SETTLEMENT_PAYOUT: "Settlement Payout",
  FEE: "Fee",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function PaymentTable({ payments, clientId, onRefresh }: PaymentTableProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [markPaidPaymentId, setMarkPaidPaymentId] = useState<string | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Split payments into upcoming and history
  const { upcoming, history } = useMemo(() => {
    const upcomingPayments: PaymentData[] = [];
    const historyPayments: PaymentData[] = [];

    for (const payment of payments) {
      const scheduledDate = new Date(payment.scheduledDate);
      scheduledDate.setHours(0, 0, 0, 0);

      if (scheduledDate >= today && payment.status === "SCHEDULED") {
        upcomingPayments.push(payment);
      } else {
        historyPayments.push(payment);
      }
    }

    // Sort upcoming by date ascending (soonest first)
    upcomingPayments.sort(
      (a, b) =>
        new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
    );

    return { upcoming: upcomingPayments, history: historyPayments };
  }, [payments, today]);

  // Monthly summary
  const summary = useMemo(() => {
    let totalPaid = 0;
    let totalScheduled = 0;
    let totalMissed = 0;

    for (const payment of payments) {
      switch (payment.status) {
        case "COMPLETED":
          totalPaid += payment.amount;
          break;
        case "SCHEDULED":
          totalScheduled += payment.amount;
          break;
        case "MISSED":
          totalMissed += payment.amount;
          break;
      }
    }

    return { totalPaid, totalScheduled, totalMissed };
  }, [payments]);

  function handleRecordNew() {
    setMarkPaidPaymentId(null);
    setDialogOpen(true);
  }

  function handleMarkPaid(paymentId: string) {
    setMarkPaidPaymentId(paymentId);
    setDialogOpen(true);
  }

  function handleDialogClose() {
    setDialogOpen(false);
    setMarkPaidPaymentId(null);
  }

  function handleDialogSuccess() {
    handleDialogClose();
    onRefresh();
  }

  function renderPaymentRow(payment: PaymentData, showMarkPaid: boolean) {
    return (
      <TableRow key={payment.id}>
        <TableCell className="text-sm">
          {format(new Date(payment.scheduledDate), "MMM d, yyyy")}
          {payment.paidDate && (
            <span className="block text-xs text-muted-foreground">
              Paid: {format(new Date(payment.paidDate), "MMM d, yyyy")}
            </span>
          )}
        </TableCell>
        <TableCell className="text-sm">
          {TYPE_LABELS[payment.type] || payment.type}
        </TableCell>
        <TableCell className="text-sm font-medium">
          {formatCurrency(payment.amount)}
        </TableCell>
        <TableCell>
          <Badge
            variant="secondary"
            className={STATUS_BADGE_CLASSES[payment.status] || "bg-gray-100 text-gray-600"}
          >
            {payment.status}
          </Badge>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {payment.reference || "--"}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {payment.debt?.creditorName || "--"}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
          {payment.notes || "--"}
        </TableCell>
        {showMarkPaid && (
          <TableCell>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleMarkPaid(payment.id)}
              title="Mark as paid"
            >
              <CheckCircle className="size-4 text-green-600" />
            </Button>
          </TableCell>
        )}
      </TableRow>
    );
  }

  return (
    <div className="space-y-6">
      {/* Payment Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <DollarSign className="size-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.totalPaid)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Scheduled</CardTitle>
            <CalendarClock className="size-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(summary.totalScheduled)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Missed</CardTitle>
            <AlertTriangle className="size-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(summary.totalMissed)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Record Payment Button */}
      <div className="flex justify-end">
        <Button onClick={handleRecordNew}>
          <Plus className="mr-2 size-4" />
          Record Payment
        </Button>
      </div>

      {/* Upcoming Payments */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Debt</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcoming.map((payment) => renderPaymentRow(payment, true))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No upcoming payments.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Debt</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((payment) => renderPaymentRow(payment, false))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No payment history yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Record Payment / Mark as Paid Dialog */}
      <RecordPaymentDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        clientId={clientId}
        paymentId={markPaidPaymentId}
        onSuccess={handleDialogSuccess}
      />
    </div>
  );
}
