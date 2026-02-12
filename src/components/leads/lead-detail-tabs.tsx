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
  Phone,
  Calendar,
  ChevronDown,
  Pencil,
  ArrowLeft,
  Clock,
  User,
} from "lucide-react";
import { ScoreBadge, StatusBadge, formatCurrency, formatPhone, formatSourceLabel } from "@/components/leads/lead-table";
import { LEAD_STATUSES } from "@/lib/validations/lead";
import { EnrollmentDialog } from "@/components/clients/enrollment-dialog";
import { ConvertToOpportunityDialog } from "@/components/opportunities/convert-to-opportunity-dialog";
import { cn } from "@/lib/utils";
import Link from "next/link";

const PIPELINE_STEPS = ["NEW", "CONTACTED", "QUALIFIED", "OPPORTUNITY", "ENROLLED"] as const;
const EXIT_STATUSES = ["UNQUALIFIED", "LOST", "DNC", "CALLBACK"];

function LeadPath({ status }: { status: string }) {
  const isExit = EXIT_STATUSES.includes(status);
  const currentIndex = PIPELINE_STEPS.indexOf(status as typeof PIPELINE_STEPS[number]);

  return (
    <div className="w-full">
      <div className="flex items-stretch h-10">
        {PIPELINE_STEPS.map((step, i) => {
          const isCompleted = !isExit && currentIndex > i;
          const isCurrent = !isExit && currentIndex === i;
          const isFirst = i === 0;
          const isLast = i === PIPELINE_STEPS.length - 1;

          return (
            <div key={step} className="relative flex-1 flex items-center justify-center min-w-0">
              {/* Arrow shape via SVG */}
              <svg
                className="absolute inset-0 w-full h-full"
                preserveAspectRatio="none"
                viewBox="0 0 120 40"
              >
                <path
                  d={
                    isFirst && isLast
                      ? "M0,0 L110,0 L120,20 L110,40 L0,40 Z"
                      : isFirst
                        ? "M0,0 L110,0 L120,20 L110,40 L0,40 Z"
                        : isLast
                          ? "M0,0 L120,0 L120,40 L0,40 L10,20 Z"
                          : "M0,0 L110,0 L120,20 L110,40 L0,40 L10,20 Z"
                  }
                  className={cn(
                    isCurrent
                      ? "fill-primary"
                      : isCompleted
                        ? "fill-primary/70"
                        : "fill-muted"
                  )}
                />
                {/* Right edge separator line */}
                {!isLast && (
                  <path
                    d="M110,0 L120,20 L110,40"
                    fill="none"
                    className={cn(
                      "stroke-background",
                    )}
                    strokeWidth="2"
                  />
                )}
                {/* Left edge separator line */}
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
                  "relative z-10 text-xs font-semibold truncate px-3",
                  isCurrent || isCompleted
                    ? "text-primary-foreground"
                    : "text-muted-foreground"
                )}
              >
                {step.replace(/_/g, " ")}
              </span>
            </div>
          );
        })}
      </div>
      {isExit && (
        <div className="mt-2 flex items-center gap-2">
          <Badge variant="destructive" className="text-xs">
            {status.replace(/_/g, " ")}
          </Badge>
          <span className="text-xs text-muted-foreground">
            This lead exited the pipeline
          </span>
        </div>
      )}
    </div>
  );
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
  agent: {
    id: string;
    name: string;
  };
}

interface CampaignContactData {
  id: string;
  status: string;
  attempts: number;
  campaign: {
    id: string;
    name: string;
    status: string;
  };
}

interface LeadData {
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
  scoreReason: string | null;
  notes: string | null;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignedTo: { id: string; name: string; email: string } | null;
  calls: CallData[];
  campaignContacts: CampaignContactData[];
}

interface LeadDetailTabsProps {
  lead: LeadData;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
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

export function LeadDetailTabs({ lead }: LeadDetailTabsProps) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" asChild>
              <Link href="/leads">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <h2 className="text-2xl font-bold tracking-tight">
              {lead.businessName}
            </h2>
          </div>
          <div className="flex items-center gap-3 pl-10">
            <StatusBadge status={lead.status} />
            <ScoreBadge score={lead.score} />
            {lead.assignedTo && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <User className="size-3.5" />
                {lead.assignedTo.name}
              </span>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dialer?leadId=${lead.id}`}>
              <Phone className="size-4" />
              Call Now
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/leads/${lead.id}/edit`}>
              <Pencil className="size-4" />
              Edit
            </Link>
          </Button>
          {lead.status !== "ENROLLED" && lead.status !== "OPPORTUNITY" && (
            <Button
              size="sm"
              onClick={() => setConvertOpen(true)}
            >
              Convert to Opportunity
            </Button>
          )}
          {lead.status === "OPPORTUNITY" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEnrollOpen(true)}
            >
              Enroll Client
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={updating}>
                Change Status
                <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {LEAD_STATUSES.map((s) => (
                <DropdownMenuItem
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={s === lead.status}
                >
                  {s.replace(/_/g, " ")}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Pipeline Path */}
      <LeadPath status={lead.status} />

      <Separator />

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="calls">
            Calls ({lead.calls.length})
          </TabsTrigger>
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
                <InfoField label="Contact Name" value={lead.contactName} />
                <InfoField label="Phone" value={formatPhone(lead.phone)} />
                <InfoField label="Email" value={lead.email || "--"} />
                <InfoField label="EIN" value={lead.ein || "--"} />
              </CardContent>
            </Card>

            {/* Business Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Business Information</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 grid-cols-2">
                <InfoField label="Business Name" value={lead.businessName} />
                <InfoField label="Industry" value={lead.industry || "--"} />
                <InfoField
                  label="Annual Revenue"
                  value={formatCurrency(lead.annualRevenue)}
                />
                <InfoField
                  label="Estimated Debt"
                  value={formatCurrency(lead.totalDebtEst)}
                />
              </CardContent>
            </Card>

            {/* Lead Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Lead Details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 grid-cols-2">
                <InfoField label="Source" value={formatSourceLabel(lead.source)} />
                <InfoField label="Status" value={lead.status.replace(/_/g, " ")} />
                <InfoField
                  label="Score"
                  value={lead.score !== null ? String(lead.score) : "--"}
                />
                <InfoField
                  label="Score Reason"
                  value={lead.scoreReason || "--"}
                />
                <InfoField
                  label="Assigned To"
                  value={lead.assignedTo?.name || "Unassigned"}
                />
                <InfoField label="Created" value={formatDate(lead.createdAt)} />
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Timeline</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 grid-cols-1">
                <div className="flex items-center gap-3">
                  <Clock className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Last Contacted</p>
                    <p className="text-sm">{formatDate(lead.lastContactedAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Next Follow-up</p>
                    <p className="text-sm">{formatDate(lead.nextFollowUpAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Last Updated</p>
                    <p className="text-sm">{formatDate(lead.updatedAt)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            {lead.notes && (
              <Card className="md:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{lead.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="calls" className="mt-4">
          {lead.calls.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Phone className="size-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No calls recorded yet.</p>
                <Button variant="outline" size="sm" className="mt-3" asChild>
                  <Link href={`/dialer?leadId=${lead.id}`}>
                    Make First Call
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {lead.calls.map((call) => (
                <Card key={call.id} className="py-4">
                  <CardContent className="px-4 py-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`size-8 rounded-full flex items-center justify-center ${
                          call.direction === "OUTBOUND"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        }`}>
                          <Phone className="size-3.5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {call.direction === "OUTBOUND" ? "Outbound" : "Inbound"} Call
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {call.agent.name} - {formatDate(call.startedAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {call.disposition && (
                          <Badge variant="secondary" className="text-xs">
                            {call.disposition.replace(/_/g, " ")}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {call.status.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDuration(call.duration)}
                        </span>
                      </div>
                    </div>
                    {call.notes && (
                      <p className="mt-2 text-sm text-muted-foreground pl-11">
                        {call.notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <div className="space-y-4">
            {/* Campaign Activity */}
            {lead.campaignContacts.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Campaign Activity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {lead.campaignContacts.map((cc) => (
                    <div
                      key={cc.id}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{cc.campaign.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {cc.attempts} attempt{cc.attempts !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {cc.status.replace(/_/g, " ")}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {cc.campaign.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Lead Timeline */}
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
                      <p className="text-sm font-medium">Lead Created</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(lead.createdAt)}
                      </p>
                    </div>
                  </div>
                  {lead.lastContactedAt && (
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="size-2 rounded-full bg-primary" />
                        <div className="flex-1 w-px bg-border" />
                      </div>
                      <div className="pb-4">
                        <p className="text-sm font-medium">Last Contacted</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(lead.lastContactedAt)}
                        </p>
                      </div>
                    </div>
                  )}
                  {lead.calls.length > 0 && (
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="size-2 rounded-full bg-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {lead.calls.length} Call{lead.calls.length !== 1 ? "s" : ""} Recorded
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Latest: {formatDate(lead.calls[0]?.startedAt)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <EnrollmentDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        leadId={lead.id}
        businessName={lead.businessName}
        totalDebtEst={lead.totalDebtEst}
      />

      <ConvertToOpportunityDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        leadId={lead.id}
        businessName={lead.businessName}
        totalDebtEst={lead.totalDebtEst}
      />
    </div>
  );
}
