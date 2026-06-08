"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "@/components/icons/lucide";
import { CLIENT_STATUSES } from "@/lib/validations/client";
import { DebtTable } from "@/components/debts/debt-table";
import { PaymentTable } from "@/components/payments/payment-table";
import { DocumentList } from "@/components/documents/document-list";
import { PaymentCalculator } from "@/components/calculator/payment-calculator";
import { ContactActivityLog } from "@/components/shared/contact-activity-log";
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

interface CallData {
  id: string;
  direction: string;
  status: string;
  disposition: string | null;
  phoneNumber: string;
  duration: number | null;
  startedAt: string;
  notes: string | null;
  agent: { id: string; name: string };
  campaign: { id: string; name: string } | null;
}

interface CampaignContactData {
  id: string;
  attempts: number;
  status: string;
  lastAttempt: string | null;
  campaign: { id: string; name: string; status: string };
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
    lastContactedAt?: string | null;
    nextFollowUpAt?: string | null;
    createdAt: string;
    calls: CallData[];
    campaignContacts: CampaignContactData[];
  };
  assignedNegotiator: { id: string; name: string; email: string } | null;
  debts: DebtData[];
  payments: PaymentData[];
  documents: DocumentData[];
}

interface ClientDetailTabsProps {
  client: ClientData;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "bg-green-100 text-green-800" },
  ON_HOLD: { label: "On Hold", className: "bg-yellow-100 text-yellow-800" },
  GRADUATED: { label: "Completed", className: "bg-blue-100 text-blue-800" },
  DROPPED: { label: "Withdrawn", className: "bg-red-100 text-red-800" },
};

const DEBT_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  SETTLED: { label: "Settled", className: "bg-green-100 text-green-800" },
  NEGOTIATING: { label: "Negotiating", className: "bg-yellow-100 text-yellow-800" },
  ENROLLED: { label: "Enrolled", className: "bg-blue-100 text-blue-800" },
  DROPPED: { label: "Dropped", className: "bg-red-100 text-red-800" },
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

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  valueClassName,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClassName?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-coastal px-5 py-[1.15rem]">
      <p className="text-[0.72rem] font-medium uppercase tracking-[0.04em] text-muted-foreground mb-[0.35rem]">
        {label}
      </p>
      <p className={`text-2xl font-bold tracking-tight ${valueClassName ?? ""}`}>{value}</p>
      {sub && <p className="text-[0.72rem] text-muted-foreground mt-[0.2rem]">{sub}</p>}
    </div>
  );
}

// ─── Info Row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-[0.5rem] text-[0.82rem] border-b border-surface-container-low last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-coastal px-6 py-5">
      <h3 className="text-[0.95rem] font-bold mb-4">{title}</h3>
      {children}
    </div>
  );
}

// ─── Overview Tab Content ─────────────────────────────────────────────────────

function OverviewTab({ client }: { client: ClientData }) {
  const start = new Date(client.programStartDate);
  const now = new Date();
  const monthsElapsed = Math.max(
    0,
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  );
  const progressPct = Math.min(100, (monthsElapsed / client.programLength) * 100);

  const estCompletion = new Date(start);
  estCompletion.setMonth(estCompletion.getMonth() + client.programLength);

  // Next scheduled payment
  const nextPayment = client.payments
    .filter((p) => p.status === "SCHEDULED" || p.status === "PENDING")
    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())[0];

  // Payment history for bar chart — last 6 paid months
  const paidPayments = client.payments
    .filter((p) => p.status === "PAID" && p.paidDate)
    .sort((a, b) => new Date(a.paidDate!).getTime() - new Date(b.paidDate!).getTime())
    .slice(-6);

  const maxPayment = paidPayments.reduce((m, p) => Math.max(m, p.amount), 1);

  return (
    <div className="grid grid-cols-[1.6fr_1fr] gap-6">
      {/* Left column */}
      <div className="space-y-4">
        {/* Debt Breakdown */}
        <Panel title="Debt Breakdown">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Creditor", "Original", "Current", "Status"].map((h) => (
                  <th
                    key={h}
                    className="text-left text-[0.68rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground pb-2 px-1"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {client.debts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-[0.8rem] text-muted-foreground py-4">
                    No debts enrolled.
                  </td>
                </tr>
              ) : (
                client.debts.map((debt, idx) => {
                  const dsc =
                    DEBT_STATUS_CONFIG[debt.status] ?? {
                      label: debt.status,
                      className: "bg-muted text-muted-foreground",
                    };
                  return (
                    <tr
                      key={debt.id}
                      className={idx % 2 === 1 ? "bg-surface-container-low" : ""}
                    >
                      <td className="text-[0.8rem] font-semibold py-[0.55rem] px-1">
                        {debt.creditorName}
                      </td>
                      <td className="text-[0.8rem] py-[0.55rem] px-1">
                        {formatCurrency(debt.originalBalance)}
                      </td>
                      <td className="text-[0.8rem] py-[0.55rem] px-1">
                        {formatCurrency(debt.currentBalance)}
                      </td>
                      <td className="py-[0.55rem] px-1">
                        <span
                          className={`inline-block text-[0.68rem] font-semibold px-[0.45rem] py-[0.15rem] rounded-sm ${dsc.className}`}
                        >
                          {dsc.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Panel>

        {/* Payment History Chart */}
        <Panel title="Payment History">
          {paidPayments.length === 0 ? (
            <p className="text-[0.8rem] text-muted-foreground">No payment history yet.</p>
          ) : (
            <div className="flex items-flex-end gap-3 h-36 mt-2 pt-2">
              {paidPayments.map((p) => {
                const heightPct = Math.max(4, (p.amount / maxPayment) * 100);
                const month = new Date(p.paidDate!).toLocaleDateString("en-US", {
                  month: "short",
                });
                return (
                  <div
                    key={p.id}
                    className="flex-1 flex flex-col items-center gap-[0.35rem] h-full justify-end"
                  >
                    <span className="text-[0.62rem] font-semibold text-on-surface">
                      {formatCurrency(p.amount)}
                    </span>
                    <div
                      className="w-full rounded-t-[3px] gradient-primary min-h-1"
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="text-[0.65rem] text-muted-foreground font-medium">
                      {month}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* Right column */}
      <div className="space-y-4">
        {/* Negotiator */}
        <Panel title="Assigned Negotiator">
          {client.assignedNegotiator ? (
            <>
              <div className="flex items-center gap-[0.85rem] mb-3">
                <div className="size-[42px] rounded-full gradient-primary flex items-center justify-center text-white font-bold text-[0.85rem] flex-shrink-0">
                  {getInitials(client.assignedNegotiator.name)}
                </div>
                <div>
                  <p className="text-[0.85rem] font-semibold">
                    {client.assignedNegotiator.name}
                  </p>
                  <p className="text-[0.72rem] text-muted-foreground">Negotiator</p>
                </div>
              </div>
              <InfoRow label="Email" value={client.assignedNegotiator.email} />
            </>
          ) : (
            <p className="text-[0.8rem] text-muted-foreground">Unassigned</p>
          )}
        </Panel>

        {/* Next Payment */}
        <Panel title="Next Payment">
          {nextPayment ? (
            <div className="bg-surface-container-low rounded-sm px-4 py-[0.85rem]">
              <p className="text-[0.7rem] uppercase tracking-[0.04em] text-muted-foreground mb-[0.25rem]">
                Due Date
              </p>
              <p className="text-[1.1rem] font-bold">
                {formatDate(nextPayment.scheduledDate)}
              </p>
              <p className="text-[0.82rem] text-muted-foreground mt-[0.1rem]">
                {formatCurrency(nextPayment.amount)}
              </p>
            </div>
          ) : (
            <p className="text-[0.8rem] text-muted-foreground">No upcoming payments.</p>
          )}
        </Panel>

        {/* Program Timeline */}
        <Panel title="Program Timeline">
          <div>
            <div className="flex justify-between text-[0.75rem] text-muted-foreground mb-2">
              <span>
                <strong className="text-foreground">{monthsElapsed}</strong> of{" "}
                {client.programLength} months completed
              </span>
              <span>{Math.round(progressPct)}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-surface-container overflow-hidden">
              <div
                className="h-full gradient-primary rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-[0.35rem] text-[0.65rem] text-muted-foreground">
              <span>{formatDate(client.programStartDate)}</span>
              <span>{formatDate(estCompletion.toISOString())}</span>
            </div>
          </div>
          <div className="mt-4">
            <InfoRow label="Program Start" value={formatDate(client.programStartDate)} />
            <InfoRow label="Est. Completion" value={formatDate(estCompletion.toISOString())} />
            <InfoRow
              label="Payments Made"
              value={`${client.payments.filter((p) => p.status === "PAID").length} of ${
                client.programLength
              }`}
            />
            <InfoRow
              label="Total Paid"
              value={formatCurrency(
                client.payments
                  .filter((p) => p.status === "PAID")
                  .reduce((sum, p) => sum + p.amount, 0)
              )}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

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

  const statusConfig =
    STATUS_CONFIG[client.status] ?? {
      label: client.status.replace(/_/g, " "),
      className: "bg-muted text-muted-foreground",
    };

  const savingsPct =
    client.totalEnrolledDebt > 0
      ? ((client.totalEnrolledDebt - client.totalSettled) / client.totalEnrolledDebt) * 100
      : 0;

  const settledPct =
    client.totalEnrolledDebt > 0
      ? (client.totalSettled / client.totalEnrolledDebt) * 100
      : 0;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-[0.4rem] text-[0.8rem] text-muted-foreground">
        <Link href="/clients" className="text-primary font-medium hover:underline">
          Clients
        </Link>
        <span>›</span>
        <span>{client.lead.businessName}</span>
      </nav>

      {/* Detail Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">
            {client.lead.businessName}
          </h1>
          <div className="flex items-center gap-3 text-[0.85rem] text-muted-foreground flex-wrap">
            <span>{client.lead.contactName}</span>
            <span
              className={`inline-block text-[0.7rem] font-semibold px-[0.65rem] py-[0.2rem] rounded-sm ${statusConfig.className}`}
            >
              {statusConfig.label}
            </span>
            <span>
              Program Start:{" "}
              <strong className="text-foreground">{formatDate(client.programStartDate)}</strong>
            </span>
            <span>
              Phone:{" "}
              <strong className="text-foreground">{formatPhone(client.lead.phone)}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                disabled={updating}
                className="h-8 px-4 flex items-center gap-1.5 bg-surface-container rounded-sm text-[0.8rem] font-medium text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50"
              >
                Change Status
                <ChevronDown className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {CLIENT_STATUSES.map((s) => (
                <DropdownMenuItem
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={s === client.status}
                >
                  {STATUS_CONFIG[s]?.label ?? s.replace(/_/g, " ")}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stat Cards — 4 across */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Enrolled Debt"
          value={formatCurrency(client.totalEnrolledDebt)}
          sub={`${client.debts.length} creditor${client.debts.length !== 1 ? "s" : ""}`}
        />
        <StatCard
          label="Total Settled"
          value={formatCurrency(client.totalSettled)}
          sub={`${Math.round(settledPct)}% of enrolled`}
        />
        <StatCard
          label="Monthly Payment"
          value={formatCurrency(client.monthlyPayment)}
          sub="Due 1st of month"
        />
        <StatCard
          label="Savings Rate"
          value={client.totalSettled > 0 ? `${Math.round(savingsPct)}%` : "--"}
          sub={
            client.totalSettled > 0
              ? `${formatCurrency(client.totalEnrolledDebt - client.totalSettled)} saved`
              : undefined
          }
          valueClassName="text-emerald-600"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="bg-transparent p-0 gap-0 border-b border-surface-container-low rounded-none h-auto">
          {[
            { value: "overview", label: "Overview" },
            { value: "debts", label: `Debts (${client.debts.length})` },
            { value: "payments", label: `Payments (${client.payments.length})` },
            { value: "documents", label: `Documents (${client.documents.length})` },
            { value: "calculator", label: "Calculator" },
            { value: "activity", label: "Activity" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-none bg-transparent px-5 py-[0.6rem] text-[0.82rem] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <OverviewTab client={client} />
        </TabsContent>

        <TabsContent value="debts" className="mt-6">
          <DebtTable
            debts={client.debts}
            clientId={client.id}
            onRefresh={handleRefresh}
          />
        </TabsContent>

        <TabsContent value="payments" className="mt-6">
          <PaymentTable
            payments={client.payments}
            clientId={client.id}
            onRefresh={handleRefresh}
          />
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <DocumentList
            documents={client.documents}
            clientId={client.id}
            onRefresh={handleRefresh}
          />
        </TabsContent>

        <TabsContent value="calculator" className="mt-6">
          <PaymentCalculator
            initialDebt={client.totalEnrolledDebt}
            businessName={client.lead.businessName}
            contactEmail={client.lead.email || ""}
            compact
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <ContactActivityLog
            calls={client.lead.calls}
            campaignContacts={client.lead.campaignContacts}
            leadCreatedAt={client.lead.createdAt}
            lastContactedAt={client.lead.lastContactedAt}
            nextFollowUpAt={client.lead.nextFollowUpAt}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
