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
} from "lucide-react";
import { OPPORTUNITY_STAGES } from "@/lib/validations/opportunity";
import { EnrollmentDialog } from "@/components/clients/enrollment-dialog";
import { cn } from "@/lib/utils";
import Link from "next/link";

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

function OpportunityPath({ stage }: { stage: string }) {
  const currentIndex = STAGE_ORDER.indexOf(stage as typeof STAGE_ORDER[number]);
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
    createdAt: string;
  };
  assignedTo: { id: string; name: string; email: string } | null;
  client: { id: string } | null;
}

interface OpportunityDetailTabsProps {
  opportunity: OpportunityData;
}

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

function formatCurrency(value: number | null): string {
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

function getNextStage(current: string): string | null {
  const activeIdx = ACTIVE_STAGES.indexOf(current as typeof ACTIVE_STAGES[number]);
  if (activeIdx >= 0 && activeIdx < ACTIVE_STAGES.length - 1) {
    return ACTIVE_STAGES[activeIdx + 1];
  }
  if (current === "CONTRACT_SIGNED") {
    return "CLOSED_WON_FIRST_PAYMENT";
  }
  return null;
}

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

  const nextStage = getNextStage(opportunity.stage);
  const canEnroll =
    (opportunity.stage === "CONTRACT_SIGNED" || opportunity.stage === "CLOSED_WON_FIRST_PAYMENT") &&
    !opportunity.client;

  const stageColorClass = STAGE_COLORS[opportunity.stage] || "";

  return (
    <div className="space-y-6">
      {/* Header */}
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
            <Button
              size="sm"
              onClick={() => setEnrollOpen(true)}
            >
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

      {/* Pipeline Path */}
      <OpportunityPath stage={opportunity.stage} />

      <Separator />

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Contact Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 grid-cols-2">
                <InfoField label="Contact Name" value={opportunity.lead.contactName} />
                <InfoField label="Phone" value={formatPhone(opportunity.lead.phone)} />
                <InfoField label="Email" value={opportunity.lead.email || "--"} />
                <InfoField label="EIN" value={opportunity.lead.ein || "--"} />
              </CardContent>
            </Card>

            {/* Business Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Business Information</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 grid-cols-2">
                <InfoField label="Business Name" value={opportunity.lead.businessName} />
                <InfoField label="Industry" value={opportunity.lead.industry || "--"} />
                <InfoField
                  label="Annual Revenue"
                  value={formatCurrency(opportunity.lead.annualRevenue)}
                />
                <InfoField
                  label="Estimated Debt"
                  value={formatCurrency(opportunity.lead.totalDebtEst)}
                />
              </CardContent>
            </Card>

            {/* Deal Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Deal Details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 grid-cols-2">
                <InfoField
                  label="Total Debt"
                  value={formatCurrency(opportunity.totalDebt)}
                />
                <InfoField
                  label="Expected Close"
                  value={formatDate(opportunity.expectedCloseDate)}
                />
                <InfoField
                  label="Assigned To"
                  value={opportunity.assignedTo?.name || "Unassigned"}
                />
                <InfoField
                  label="Source"
                  value={formatSourceLabel(opportunity.lead.source)}
                />
                <InfoField
                  label="Lead Score"
                  value={opportunity.lead.score !== null ? String(opportunity.lead.score) : "--"}
                />
                <InfoField label="Created" value={formatDateTime(opportunity.createdAt)} />
              </CardContent>
            </Card>

            {/* Lead Link */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Related Records</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">Lead Record</p>
                    <p className="text-xs text-muted-foreground">
                      Created {formatDate(opportunity.lead.createdAt)}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/leads/${opportunity.lead.id}`}>View Lead</Link>
                  </Button>
                </div>
                {opportunity.client && (
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-sm font-medium">Client Record</p>
                      <p className="text-xs text-muted-foreground">Enrolled</p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/clients/${opportunity.client.id}`}>View Client</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            {(opportunity.notes || opportunity.lead.notes) && (
              <Card className="md:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Notes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {opportunity.notes && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Opportunity Notes
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{opportunity.notes}</p>
                    </div>
                  )}
                  {opportunity.lead.notes && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Lead Notes
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{opportunity.lead.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="size-2 rounded-full bg-primary" />
                    <div className="flex-1 w-px bg-border" />
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium">Opportunity Created</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(opportunity.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="size-2 rounded-full bg-primary" />
                    <div className="flex-1 w-px bg-border" />
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium">
                      Current Stage: {opportunity.stage.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Last updated {formatDateTime(opportunity.updatedAt)}
                    </p>
                  </div>
                </div>
                {opportunity.client && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="size-2 rounded-full bg-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-600">
                        Client Enrolled
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Enrolled as client
                      </p>
                    </div>
                  </div>
                )}
                {!opportunity.client && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="size-2 rounded-full bg-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Awaiting enrollment
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
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
