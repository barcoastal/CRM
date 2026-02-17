"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ChevronDown, User } from "lucide-react";
import { CLIENT_STATUSES } from "@/lib/validations/client";
import { ProgramSummaryCard } from "@/components/clients/program-summary-card";
import { DebtTable } from "@/components/debts/debt-table";
import { PaymentTable } from "@/components/payments/payment-table";
import { DocumentList } from "@/components/documents/document-list";
import { PaymentCalculator } from "@/components/calculator/payment-calculator";
import Link from "next/link";

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

interface PaymentData {
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
  debt: { creditorName: string } | null;
}

interface DocumentData {
  id: string;
  name: string;
  type: string;
  filePath: string;
  fileSize: number | null;
  uploadedBy: { id: string; name: string };
  createdAt: string;
}

interface ClientData {
  id: string;
  leadId: string;
  programStartDate: string;
  programLength: number;
  monthlyPayment: number;
  totalEnrolledDebt: number;
  totalSettled: number;
  totalFees: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  lead: {
    id: string;
    businessName: string;
    contactName: string;
    phone: string;
    email: string | null;
    ein?: string | null;
    industry?: string | null;
    annualRevenue?: number | null;
    totalDebtEst?: number | null;
    source?: string;
  };
  assignedNegotiator: { id: string; name: string; email: string } | null;
  debts: DebtData[];
  payments: PaymentData[];
  documents: DocumentData[];
}

interface ClientDetailTabsProps {
  client: ClientData;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  GRADUATED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  DROPPED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  ON_HOLD: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

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

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

export function ClientDetailTabs({ client }: ClientDetailTabsProps) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleRefresh = () => {
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" asChild>
              <Link href="/clients">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <h2 className="text-2xl font-bold tracking-tight">
              {client.lead.businessName}
            </h2>
          </div>
          <div className="flex items-center gap-3 pl-10">
            <Badge
              variant="secondary"
              className={`text-xs ${STATUS_COLORS[client.status] || ""}`}
            >
              {client.status.replace(/_/g, " ")}
            </Badge>
            {client.assignedNegotiator && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <User className="size-3.5" />
                {client.assignedNegotiator.name}
              </span>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={updating}>
              Change Status
              <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {CLIENT_STATUSES.map((s) => (
              <DropdownMenuItem
                key={s}
                onClick={() => handleStatusChange(s)}
                disabled={s === client.status}
              >
                {s.replace(/_/g, " ")}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="debts">
            Debts ({client.debts.length})
          </TabsTrigger>
          <TabsTrigger value="payments">
            Payments ({client.payments.length})
          </TabsTrigger>
          <TabsTrigger value="documents">
            Documents ({client.documents.length})
          </TabsTrigger>
          <TabsTrigger value="calculator">Calculator</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Contact Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 grid-cols-2">
                <InfoField label="Contact Name" value={client.lead.contactName} />
                <InfoField label="Phone" value={formatPhone(client.lead.phone)} />
                <InfoField label="Email" value={client.lead.email || "--"} />
                <InfoField label="EIN" value={client.lead.ein || "--"} />
              </CardContent>
            </Card>

            {/* Program Summary */}
            <ProgramSummaryCard
              totalEnrolledDebt={client.totalEnrolledDebt}
              totalSettled={client.totalSettled}
              totalFees={client.totalFees}
              monthlyPayment={client.monthlyPayment}
              programLength={client.programLength}
              programStartDate={client.programStartDate}
              status={client.status}
            />

            {/* Business Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Business Information</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 grid-cols-2">
                <InfoField label="Business Name" value={client.lead.businessName} />
                <InfoField label="Industry" value={client.lead.industry || "--"} />
                <InfoField
                  label="Annual Revenue"
                  value={formatCurrency(client.lead.annualRevenue)}
                />
                <InfoField
                  label="Estimated Debt"
                  value={formatCurrency(client.lead.totalDebtEst)}
                />
              </CardContent>
            </Card>

            {/* Program Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Program Details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 grid-cols-2">
                <InfoField label="Start Date" value={formatDate(client.programStartDate)} />
                <InfoField label="Program Length" value={`${client.programLength} months`} />
                <InfoField label="Negotiator" value={client.assignedNegotiator?.name || "Unassigned"} />
                <InfoField label="Enrolled" value={formatDate(client.createdAt)} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="debts" className="mt-4">
          <DebtTable
            debts={client.debts}
            clientId={client.id}
            onRefresh={handleRefresh}
          />
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <PaymentTable
            payments={client.payments}
            clientId={client.id}
            onRefresh={handleRefresh}
          />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <DocumentList
            documents={client.documents}
            clientId={client.id}
            onRefresh={handleRefresh}
          />
        </TabsContent>

        <TabsContent value="calculator" className="mt-4">
          <PaymentCalculator
            initialDebt={client.totalEnrolledDebt}
            businessName={client.lead.businessName}
            compact
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="size-2 rounded-full bg-primary" />
                    <div className="flex-1 w-px bg-border" />
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium">Client Enrolled</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(client.createdAt)}
                    </p>
                  </div>
                </div>

                {client.debts.length > 0 && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="size-2 rounded-full bg-primary" />
                      <div className="flex-1 w-px bg-border" />
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium">
                        {client.debts.length} Debt{client.debts.length !== 1 ? "s" : ""} Enrolled
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Total: {formatCurrency(client.totalEnrolledDebt)}
                      </p>
                    </div>
                  </div>
                )}

                {client.debts
                  .filter((d) => d.status === "SETTLED")
                  .map((debt) => (
                    <div key={debt.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="size-2 rounded-full bg-green-500" />
                        <div className="flex-1 w-px bg-border" />
                      </div>
                      <div className="pb-4">
                        <p className="text-sm font-medium">
                          {debt.creditorName} Settled
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(debt.settledAmount)} ({debt.savingsPercent?.toFixed(1)}% savings)
                          {debt.settledDate && ` - ${formatDate(debt.settledDate)}`}
                        </p>
                      </div>
                    </div>
                  ))}

                {client.payments.filter((p) => p.status === "COMPLETED").length > 0 && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="size-2 rounded-full bg-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {client.payments.filter((p) => p.status === "COMPLETED").length} Payment{client.payments.filter((p) => p.status === "COMPLETED").length !== 1 ? "s" : ""} Completed
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Total: {formatCurrency(
                          client.payments
                            .filter((p) => p.status === "COMPLETED")
                            .reduce((sum, p) => sum + p.amount, 0)
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
