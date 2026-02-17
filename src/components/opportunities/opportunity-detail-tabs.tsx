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
import {
  ChevronDown,
  Pencil,
  ArrowLeft,
  User,
  ChevronRight,
  Phone,
  Mail,
  Building2,
  DollarSign,
  Calendar,
  FileText,
  Megaphone,
  Clock,
  PhoneCall,
  ArrowUpRight,
  ArrowDownLeft,
  Link2,
} from "lucide-react";
import { OPPORTUNITY_STAGES } from "@/lib/validations/opportunity";
import { EnrollmentDialog } from "@/components/clients/enrollment-dialog";
import { PaymentCalculator } from "@/components/calculator/payment-calculator";
import { ContactActivityLog } from "@/components/shared/contact-activity-log";
import { DebtTable } from "@/components/debts/debt-table";
import { DocumentList } from "@/components/documents/document-list";
import { cn } from "@/lib/utils";
import Link from "next/link";

// ─── Stage Constants ──────────────────────────────────────────

const ACTIVE_STAGES = [
  "WORKING_OPPORTUNITY",
  "WAITING_FOR_AGREEMENTS",
  "READY_TO_CLOSE",
  "CONTRACT_SENT",
  "CONTRACT_SIGNED",
] as const;

const STAGE_ORDER = [
  "WORKING_OPPORTUNITY",
  "WAITING_FOR_AGREEMENTS",
  "READY_TO_CLOSE",
  "CONTRACT_SENT",
  "CONTRACT_SIGNED",
  "ARCHIVED",
  "CLOSED_WON_FIRST_PAYMENT",
  "CLOSED",
] as const;

const STAGE_COLORS: Record<string, string> = {
  WORKING_OPPORTUNITY: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  WAITING_FOR_AGREEMENTS: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  READY_TO_CLOSE: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  CONTRACT_SENT: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
  CONTRACT_SIGNED: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  ARCHIVED: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  CLOSED_WON_FIRST_PAYMENT: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  CLOSED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const DISPOSITION_COLORS: Record<string, string> = {
  INTERESTED: "bg-green-100 text-green-800",
  NOT_INTERESTED: "bg-red-100 text-red-800",
  CALLBACK: "bg-blue-100 text-blue-800",
  NOT_QUALIFIED: "bg-gray-100 text-gray-800",
  WRONG_NUMBER: "bg-orange-100 text-orange-800",
  VOICEMAIL: "bg-purple-100 text-purple-800",
  NO_ANSWER: "bg-yellow-100 text-yellow-800",
  DNC: "bg-red-200 text-red-900",
  ENROLLED: "bg-emerald-100 text-emerald-800",
};

// ─── Pipeline Path ────────────────────────────────────────────

function OpportunityPath({ stage }: { stage: string }) {
  const currentIndex = STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);
  const isArchived = stage === "ARCHIVED";
  const isClosed = stage === "CLOSED";
  const isClosedWon = stage === "CLOSED_WON_FIRST_PAYMENT";

  return (
    <div className="w-full">
      <div className="flex items-stretch h-10">
        {STAGE_ORDER.map((step, i) => {
          const isCurrent = currentIndex === i;
          const isCompleted = !isArchived && !isClosed && currentIndex > i && i < 5;
          const isFirst = i === 0;
          const isLast = i === STAGE_ORDER.length - 1;

          let fillClass = "fill-muted";
          if (isCurrent) {
            if (isArchived) fillClass = "fill-gray-500";
            else if (isClosed) fillClass = "fill-red-500";
            else if (isClosedWon) fillClass = "fill-green-600";
            else fillClass = "fill-primary";
          } else if (isCompleted) {
            fillClass = "fill-primary/70";
          }

          let textClass = "text-muted-foreground";
          if (isCurrent || isCompleted) {
            textClass = "text-white";
          }

          return (
            <div key={step} className="relative flex-1 flex items-center justify-center min-w-0">
              <svg
                className="absolute inset-0 w-full h-full"
                preserveAspectRatio="none"
                viewBox="0 0 120 40"
              >
                <path
                  d={
                    isFirst
                      ? "M0,0 L110,0 L120,20 L110,40 L0,40 Z"
                      : isLast
                        ? "M0,0 L120,0 L120,40 L0,40 L10,20 Z"
                        : "M0,0 L110,0 L120,20 L110,40 L0,40 L10,20 Z"
                  }
                  className={fillClass}
                />
                {!isLast && (
                  <path
                    d="M110,0 L120,20 L110,40"
                    fill="none"
                    className="stroke-background"
                    strokeWidth="2"
                  />
                )}
                {!isFirst && (
                  <path
                    d="M0,0 L10,20 L0,40"
                    fill="none"
                    className="stroke-background"
                    strokeWidth="2"
                  />
                )}
              </svg>
              <span
                className={cn(
                  "relative z-10 text-[10px] font-semibold truncate px-2 leading-tight text-center",
                  textClass
                )}
              >
                {step === "CLOSED_WON_FIRST_PAYMENT"
                  ? "WON"
                  : step.replace(/_/g, " ")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────

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

interface DocumentData {
  id: string;
  name: string;
  type: string;
  filePath: string;
  fileSize: number | null;
  uploadedBy: { id: string; name: string };
  createdAt: string;
}

interface OpportunityData {
  id: string;
  stage: string;
  totalDebt: number | null;
  expectedCloseDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lead: {
    id: string;
    businessName: string;
    contactName: string;
    phone: string;
    email: string | null;
    ein: string | null;
    industry: string | null;
    annualRevenue: number | null;
    totalDebtEst: number | null;
    source: string;
    status: string;
    score: number | null;
    notes: string | null;
    lastContactedAt: string | null;
    nextFollowUpAt: string | null;
    createdAt: string;
    calls: CallData[];
    campaignContacts: CampaignContactData[];
  };
  assignedTo: { id: string; name: string; email: string } | null;
  client: { id: string } | null;
  debts: DebtData[];
  documents: DocumentData[];
}

interface OpportunityDetailTabsProps {
  opportunity: OpportunityData;
}

// ─── Helpers ──────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function formatSourceLabel(source: string): string {
  return source
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function getNextStage(current: string): string | null {
  const activeIdx = ACTIVE_STAGES.indexOf(current as (typeof ACTIVE_STAGES)[number]);
  if (activeIdx >= 0 && activeIdx < ACTIVE_STAGES.length - 1) {
    return ACTIVE_STAGES[activeIdx + 1];
  }
  if (current === "CONTRACT_SIGNED") {
    return "CLOSED_WON_FIRST_PAYMENT";
  }
  return null;
}

// ─── Detail Field Component ──────────────────────────────────

function DetailField({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof Phone }) {
  return (
    <div className="flex items-start gap-3 py-2">
      {Icon && <Icon className="size-4 text-muted-foreground mt-0.5 shrink-0" />}
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <p className="text-sm mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────

export function OpportunityDetailTabs({ opportunity }: OpportunityDetailTabsProps) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);

  const handleStageChange = async (newStage: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/opportunities/${opportunity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
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

  const nextStage = getNextStage(opportunity.stage);
  const canEnroll =
    (opportunity.stage === "CONTRACT_SIGNED" || opportunity.stage === "CLOSED_WON_FIRST_PAYMENT") &&
    !opportunity.client;

  const stageColorClass = STAGE_COLORS[opportunity.stage] || "";

  // Compute total debt from debts array
  const totalDebtFromDebts = opportunity.debts.reduce((sum, d) => sum + d.currentBalance, 0);
  const displayDebt = opportunity.totalDebt || totalDebtFromDebts || opportunity.lead.totalDebtEst || 0;

  // Get last call disposition info
  const lastCall = opportunity.lead.calls[0];
  const interestedCalls = opportunity.lead.calls.filter((c) => c.disposition === "INTERESTED").length;
  const totalCalls = opportunity.lead.calls.length;

  // Settlement summary
  const settledDebts = opportunity.debts.filter((d) => d.status === "SETTLED" || d.status === "PAID");
  const totalSettled = settledDebts.reduce((sum, d) => sum + (d.settledAmount || 0), 0);
  const totalSavings = settledDebts.reduce((sum, d) => sum + (d.savingsAmount || 0), 0);

  return (
    <div className="space-y-4">
      {/* ─── Header Bar ──────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" asChild>
              <Link href="/opportunities">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <h2 className="text-2xl font-bold tracking-tight">
              {opportunity.lead.businessName}
            </h2>
          </div>
          <div className="flex items-center gap-3 pl-10">
            <Badge variant="secondary" className={`text-xs ${stageColorClass}`}>
              {opportunity.stage.replace(/_/g, " ")}
            </Badge>
            {opportunity.assignedTo && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <User className="size-3.5" />
                {opportunity.assignedTo.name}
              </span>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/opportunities/${opportunity.id}/edit`}>
              <Pencil className="size-4" />
              Edit
            </Link>
          </Button>
          {nextStage && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStageChange(nextStage)}
              disabled={updating}
            >
              Advance Stage
              <ChevronRight className="size-4" />
            </Button>
          )}
          {canEnroll && (
            <Button size="sm" onClick={() => setEnrollOpen(true)}>
              Enroll as Client
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={updating}>
                Set Stage
                <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {OPPORTUNITY_STAGES.map((s) => (
                <DropdownMenuItem
                  key={s}
                  onClick={() => handleStageChange(s)}
                  disabled={s === opportunity.stage}
                >
                  {s.replace(/_/g, " ")}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ─── Key Info Bar ────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 rounded-lg border p-3 bg-muted/30">
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Account Name</p>
          <p className="text-sm font-semibold truncate">{opportunity.lead.businessName}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Current Total Debt</p>
          <p className="text-sm font-semibold text-red-600">{formatCurrency(displayDebt)}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Lead ID</p>
          <p className="text-sm font-mono truncate">{opportunity.lead.id.slice(-8)}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Opportunity Owner</p>
          <p className="text-sm font-semibold">{opportunity.assignedTo?.name || "Unassigned"}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Expected Close</p>
          <p className="text-sm font-semibold">{formatDate(opportunity.expectedCloseDate)}</p>
        </div>
      </div>

      {/* ─── Pipeline Path ───────────────────────────────── */}
      <OpportunityPath stage={opportunity.stage} />

      <Separator />

      {/* ─── Tabs ────────────────────────────────────────── */}
      <Tabs defaultValue="details">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="debts">
            Debt Info ({opportunity.debts.length})
          </TabsTrigger>
          <TabsTrigger value="calculator">Calculator</TabsTrigger>
          <TabsTrigger value="settlements">Settlements</TabsTrigger>
          <TabsTrigger value="documents">
            Documents ({opportunity.documents.length})
          </TabsTrigger>
          <TabsTrigger value="related">Related</TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════
            TAB 1: DETAILS
        ═══════════════════════════════════════════════════ */}
        <TabsContent value="details" className="mt-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Opportunity Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="size-4" />
                  Opportunity Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  <DetailField label="Account Name" value={opportunity.lead.businessName} icon={Building2} />
                  <DetailField label="Lead ID" value={opportunity.lead.id.slice(-8)} />
                  <DetailField label="Total Debt" value={formatCurrency(displayDebt)} icon={DollarSign} />
                  <DetailField label="Expected Close" value={formatDate(opportunity.expectedCloseDate)} icon={Calendar} />
                  <DetailField label="Source" value={formatSourceLabel(opportunity.lead.source)} />
                  <DetailField label="Lead Score" value={opportunity.lead.score !== null ? String(opportunity.lead.score) : "--"} />
                  <DetailField label="Stage" value={opportunity.stage.replace(/_/g, " ")} />
                  <DetailField label="Created" value={formatDateTime(opportunity.createdAt)} icon={Clock} />
                </div>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="size-4" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  <DetailField label="Contact Name" value={opportunity.lead.contactName} icon={User} />
                  <DetailField label="Phone" value={formatPhone(opportunity.lead.phone)} icon={Phone} />
                  <DetailField label="Email" value={opportunity.lead.email || "--"} icon={Mail} />
                  <DetailField label="EIN" value={opportunity.lead.ein || "--"} />
                </div>
              </CardContent>
            </Card>

            {/* Business Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="size-4" />
                  Business Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  <DetailField label="Business Name" value={opportunity.lead.businessName} icon={Building2} />
                  <DetailField label="Industry" value={opportunity.lead.industry || "--"} />
                  <DetailField label="Annual Revenue" value={formatCurrency(opportunity.lead.annualRevenue)} icon={DollarSign} />
                  <DetailField label="Estimated Debt" value={formatCurrency(opportunity.lead.totalDebtEst)} />
                </div>
              </CardContent>
            </Card>

            {/* Call Disposition */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <PhoneCall className="size-4" />
                  Call Disposition
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  <DetailField label="Total Calls" value={String(totalCalls)} icon={Phone} />
                  <DetailField label="Interested" value={String(interestedCalls)} />
                  {lastCall && (
                    <>
                      <DetailField
                        label="Last Disposition"
                        value={lastCall.disposition?.replace(/_/g, " ") || "None"}
                      />
                      <DetailField
                        label="Last Agent"
                        value={lastCall.agent.name}
                        icon={User}
                      />
                      <DetailField
                        label="Last Call Date"
                        value={formatDateTime(lastCall.startedAt)}
                        icon={Clock}
                      />
                      <DetailField
                        label="Duration"
                        value={formatDuration(lastCall.duration)}
                      />
                    </>
                  )}
                </div>
                {/* Recent disposition badges */}
                {totalCalls > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Recent Dispositions</p>
                    <div className="flex flex-wrap gap-1.5">
                      {opportunity.lead.calls.slice(0, 5).map((call) => (
                        <Badge
                          key={call.id}
                          variant="secondary"
                          className={`text-[10px] ${DISPOSITION_COLORS[call.disposition || ""] || "bg-gray-100 text-gray-800"}`}
                        >
                          {call.disposition?.replace(/_/g, " ") || "N/A"}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="size-4" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {opportunity.notes ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Opportunity Notes</p>
                    <p className="text-sm whitespace-pre-wrap rounded-md bg-muted/50 p-3">{opportunity.notes}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No opportunity notes.</p>
                )}
                {opportunity.lead.notes && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Lead Notes</p>
                    <p className="text-sm whitespace-pre-wrap rounded-md bg-muted/50 p-3">{opportunity.lead.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════
            TAB 2: ACTIVITIES
        ═══════════════════════════════════════════════════ */}
        <TabsContent value="activities" className="mt-4">
          <ContactActivityLog
            calls={opportunity.lead.calls}
            campaignContacts={opportunity.lead.campaignContacts}
            leadCreatedAt={opportunity.lead.createdAt}
            lastContactedAt={opportunity.lead.lastContactedAt}
            nextFollowUpAt={opportunity.lead.nextFollowUpAt}
          />
        </TabsContent>

        {/* ═══════════════════════════════════════════════════
            TAB 3: DEBT INFORMATION
        ═══════════════════════════════════════════════════ */}
        <TabsContent value="debts" className="mt-4">
          <DebtTable
            debts={opportunity.debts}
            opportunityId={opportunity.id}
            onRefresh={handleRefresh}
          />
        </TabsContent>

        {/* ═══════════════════════════════════════════════════
            TAB 4: PAYMENT CALCULATOR
        ═══════════════════════════════════════════════════ */}
        <TabsContent value="calculator" className="mt-4">
          <PaymentCalculator
            initialDebt={displayDebt}
            businessName={opportunity.lead.businessName}
            contactEmail={opportunity.lead.email || ""}
            compact
          />
        </TabsContent>

        {/* ═══════════════════════════════════════════════════
            TAB 5: SETTLEMENTS
        ═══════════════════════════════════════════════════ */}
        <TabsContent value="settlements" className="mt-4">
          <div className="space-y-6">
            {/* Settlement Summary */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="py-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Total Debts</p>
                  <p className="text-2xl font-bold mt-1">{opportunity.debts.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Settled</p>
                  <p className="text-2xl font-bold mt-1 text-green-600">{settledDebts.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Total Settled For</p>
                  <p className="text-2xl font-bold mt-1 text-green-600">{formatCurrency(totalSettled)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Total Savings</p>
                  <p className="text-2xl font-bold mt-1 text-green-600">{formatCurrency(totalSavings)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Settlement Details */}
            {settledDebts.length > 0 ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Settlement Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {settledDebts.map((debt) => (
                      <div key={debt.id} className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <p className="text-sm font-medium">{debt.creditorName}</p>
                          <p className="text-xs text-muted-foreground">
                            Original: {formatCurrency(debt.originalBalance)} | Settled: {formatCurrency(debt.settledAmount)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-green-600">
                            {debt.savingsPercent !== null ? `${debt.savingsPercent.toFixed(1)}% savings` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {debt.settledDate ? formatDate(debt.settledDate) : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <DollarSign className="size-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No settlements recorded yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add debts in the Debt Information tab, then track settlements after enrollment.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Negotiation Activity across all debts */}
            {opportunity.debts.some((d) => d.negotiations.length > 0) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Negotiation History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {opportunity.debts.flatMap((debt) =>
                      debt.negotiations.map((neg) => ({
                        ...neg,
                        creditorName: debt.creditorName,
                      }))
                    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 10)
                    .map((neg) => (
                      <div key={neg.id} className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{neg.creditorName}</p>
                            <Badge variant="secondary" className="text-[10px]">
                              {neg.type}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {neg.offerAmount !== null && `Offer: ${formatCurrency(neg.offerAmount)}`}
                            {neg.counterAmount !== null && ` | Counter: ${formatCurrency(neg.counterAmount)}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant="secondary"
                            className={`text-xs ${
                              neg.response === "ACCEPTED" ? "bg-green-100 text-green-800" :
                              neg.response === "REJECTED" ? "bg-red-100 text-red-800" :
                              neg.response === "COUNTERED" ? "bg-yellow-100 text-yellow-800" :
                              "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {neg.response}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">{formatDate(neg.date)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════
            TAB 6: DOCUMENTS
        ═══════════════════════════════════════════════════ */}
        <TabsContent value="documents" className="mt-4">
          <DocumentList
            documents={opportunity.documents}
            opportunityId={opportunity.id}
            onRefresh={handleRefresh}
          />
        </TabsContent>

        {/* ═══════════════════════════════════════════════════
            TAB 7: RELATED
        ═══════════════════════════════════════════════════ */}
        <TabsContent value="related" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Lead Record */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Link2 className="size-4" />
                  Lead Record
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">{opportunity.lead.businessName}</p>
                    <p className="text-xs text-muted-foreground">
                      {opportunity.lead.contactName} | Created {formatDate(opportunity.lead.createdAt)}
                    </p>
                    <Badge variant="secondary" className="text-[10px] mt-1">
                      {opportunity.lead.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/leads/${opportunity.lead.id}`}>
                      View Lead
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Client Record */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Link2 className="size-4" />
                  Client Record
                </CardTitle>
              </CardHeader>
              <CardContent>
                {opportunity.client ? (
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-sm font-medium">{opportunity.lead.businessName}</p>
                      <p className="text-xs text-muted-foreground">Enrolled as client</p>
                      <Badge variant="secondary" className="text-[10px] mt-1 bg-green-100 text-green-800">
                        ENROLLED
                      </Badge>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/clients/${opportunity.client.id}`}>
                        View Client
                        <ArrowUpRight className="size-3.5" />
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-md border p-6 text-center">
                    <p className="text-sm text-muted-foreground">Not yet enrolled as a client.</p>
                    {canEnroll && (
                      <Button size="sm" className="mt-3" onClick={() => setEnrollOpen(true)}>
                        Enroll as Client
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Campaign History */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Megaphone className="size-4" />
                  Campaign History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {opportunity.lead.campaignContacts.length > 0 ? (
                  <div className="space-y-2">
                    {opportunity.lead.campaignContacts.map((cc) => (
                      <div key={cc.id} className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <p className="text-sm font-medium">{cc.campaign.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {cc.attempts} attempts | Last: {cc.lastAttempt ? formatDateTime(cc.lastAttempt) : "Never"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {cc.status}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {cc.campaign.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border p-6 text-center">
                    <Megaphone className="size-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No campaign history.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════
            TAB 8: MARKETING
        ═══════════════════════════════════════════════════ */}
        <TabsContent value="marketing" className="mt-4">
          <div className="space-y-6">
            {/* Engagement Summary */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="py-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Total Interactions</p>
                  <p className="text-2xl font-bold mt-1">
                    {opportunity.lead.calls.length + opportunity.lead.campaignContacts.reduce((sum, cc) => sum + cc.attempts, 0)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Calls Made</p>
                  <p className="text-2xl font-bold mt-1">{opportunity.lead.calls.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Campaigns</p>
                  <p className="text-2xl font-bold mt-1">{opportunity.lead.campaignContacts.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Last Contact</p>
                  <p className="text-sm font-bold mt-1">{formatDate(opportunity.lead.lastContactedAt)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Activity by Campaign */}
            {opportunity.lead.campaignContacts.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Megaphone className="size-4" />
                    Activity by Campaign
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {opportunity.lead.campaignContacts.map((cc) => {
                      const campaignCalls = opportunity.lead.calls.filter(
                        (c) => c.campaign?.id === cc.campaign.id
                      );
                      return (
                        <div key={cc.id} className="rounded-md border p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="text-sm font-semibold">{cc.campaign.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {cc.attempts} attempts | {campaignCalls.length} calls logged
                              </p>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {cc.campaign.status}
                            </Badge>
                          </div>
                          {campaignCalls.length > 0 && (
                            <div className="space-y-1.5">
                              {campaignCalls.slice(0, 5).map((call) => (
                                <div key={call.id} className="flex items-center gap-3 text-sm py-1">
                                  {call.direction === "OUTBOUND" ? (
                                    <ArrowUpRight className="size-3.5 text-blue-500" />
                                  ) : (
                                    <ArrowDownLeft className="size-3.5 text-green-500" />
                                  )}
                                  <span className="text-xs text-muted-foreground w-32">
                                    {formatDateTime(call.startedAt)}
                                  </span>
                                  <Badge
                                    variant="secondary"
                                    className={`text-[10px] ${DISPOSITION_COLORS[call.disposition || ""] || "bg-gray-100 text-gray-800"}`}
                                  >
                                    {call.disposition?.replace(/_/g, " ") || "N/A"}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {call.agent.name} | {formatDuration(call.duration)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Engagement Timeline */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="size-4" />
                  Engagement Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                {opportunity.lead.calls.length > 0 ? (
                  <div className="space-y-3">
                    {opportunity.lead.calls.slice(0, 15).map((call) => (
                      <div key={call.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            "flex size-8 items-center justify-center rounded-full",
                            call.direction === "OUTBOUND" ? "bg-blue-100" : "bg-green-100"
                          )}>
                            {call.direction === "OUTBOUND" ? (
                              <ArrowUpRight className="size-3.5 text-blue-600" />
                            ) : (
                              <ArrowDownLeft className="size-3.5 text-green-600" />
                            )}
                          </div>
                          <div className="flex-1 w-px bg-border" />
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {call.direction === "OUTBOUND" ? "Outbound Call" : "Inbound Call"}
                              </span>
                              {call.disposition && (
                                <Badge
                                  variant="secondary"
                                  className={`text-[10px] ${DISPOSITION_COLORS[call.disposition] || "bg-gray-100 text-gray-800"}`}
                                >
                                  {call.disposition.replace(/_/g, " ")}
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(call.startedAt)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Agent: {call.agent.name}
                            {call.campaign && ` | Campaign: ${call.campaign.name}`}
                            {call.duration && ` | ${formatDuration(call.duration)}`}
                          </p>
                          {call.notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic">{call.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <Mail className="size-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No engagement history yet.</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Calls, emails, and campaign activity will appear here.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <EnrollmentDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        leadId={opportunity.lead.id}
        businessName={opportunity.lead.businessName}
        totalDebtEst={opportunity.lead.totalDebtEst}
        opportunityId={opportunity.id}
      />
    </div>
  );
}
