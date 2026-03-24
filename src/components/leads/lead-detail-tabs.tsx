"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Phone,
  Pencil,
  MoreHorizontal,
  DollarSign,
  TrendingUp,
  Clock,
  PhoneCall,
  User,
  Calendar,
  ChevronRight,
  Tag,
} from "lucide-react";
import { StatusBadge, formatCurrency, formatPhone, formatSourceLabel } from "@/components/leads/lead-table";
import { LEAD_STATUSES } from "@/lib/validations/lead";
import { EnrollmentDialog } from "@/components/clients/enrollment-dialog";
import { ConvertToOpportunityDialog } from "@/components/opportunities/convert-to-opportunity-dialog";
import Link from "next/link";

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
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  eliClickId: string | null;
  redtrackClickId: string | null;
  gclid: string | null;
  fbclid: string | null;
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

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function getDaysInPipeline(createdAt: string): number {
  const created = new Date(createdAt);
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

function getMonthlyRevenue(annualRevenue: number | null): string {
  if (!annualRevenue) return "--";
  return formatCurrency(annualRevenue / 12);
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function ScoreCircle({ score }: { score: number | null }) {
  const val = score ?? 0;
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (val / 100) * circumference;

  let strokeColor = "#3052FF";
  if (val >= 75) strokeColor = "#059669";
  else if (val >= 50) strokeColor = "#b45309";
  else if (val > 0) strokeColor = "#ba1a1a";

  if (score === null) {
    return (
      <div
        className="relative flex items-center justify-center"
        style={{ width: 56, height: 56 }}
      >
        <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="28" cy="28" r={radius} fill="none" stroke="#eaedff" strokeWidth="4" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color: "#444656" }}>
          N/A
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: 56, height: 56 }}
    >
      <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="28" cy="28" r={radius} fill="none" stroke="#eaedff" strokeWidth="4" />
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center font-bold text-base"
        style={{ fontFamily: "Manrope, sans-serif", color: "#131b2e" }}
      >
        {val}
      </div>
    </div>
  );
}

function InfoField({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#444656" }}>
        {label}
      </p>
      {href ? (
        <a href={href} className="text-sm font-medium" style={{ color: "#3052FF" }}>
          {value}
        </a>
      ) : (
        <p className="text-sm font-medium" style={{ color: "#131b2e" }}>
          {value}
        </p>
      )}
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
    <div style={{ color: "#131b2e" }}>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 mb-5 text-[13px]" style={{ color: "#444656" }}>
        <Link href="/leads" className="font-medium hover:underline" style={{ color: "#3052FF" }}>
          Leads
        </Link>
        <ChevronRight className="size-3.5" style={{ color: "#444656" }} />
        <span>{lead.businessName}</span>
      </nav>

      {/* Detail Header */}
      <div className="flex items-start justify-between mb-7">
        <div className="flex items-center gap-5">
          <div>
            <h1
              className="flex items-center gap-3 text-[26px] font-bold"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              {lead.businessName}
              <StatusBadge status={lead.status} />
            </h1>
            <div className="mt-0.5 text-[15px]" style={{ color: "#444656" }}>
              {lead.contactName}
            </div>
          </div>
          <ScoreCircle score={lead.score} />
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="ghost"
            size="sm"
            className="font-medium"
            style={{ background: "#f2f3ff", color: "#131b2e", border: "none" }}
            asChild
          >
            <Link href={`/leads/${lead.id}/edit`}>
              <Pencil className="size-3.5" />
              Edit
            </Link>
          </Button>

          <Button
            size="sm"
            className="font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#0034e4,#3052ff)", border: "none" }}
            asChild
          >
            <Link href={`/dialer?leadId=${lead.id}`}>
              <Phone className="size-3.5" />
              Call
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center justify-center rounded"
                style={{
                  width: 40,
                  height: 40,
                  background: "#f2f3ff",
                  border: "none",
                  color: "#444656",
                  cursor: "pointer",
                }}
              >
                <MoreHorizontal className="size-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {lead.status !== "ENROLLED" && lead.status !== "OPPORTUNITY" && (
                <DropdownMenuItem onClick={() => setConvertOpen(true)}>
                  Convert to Opportunity
                </DropdownMenuItem>
              )}
              {lead.status === "OPPORTUNITY" && (
                <DropdownMenuItem onClick={() => setEnrollOpen(true)}>
                  Enroll Client
                </DropdownMenuItem>
              )}
              {LEAD_STATUSES.map((s) => (
                <DropdownMenuItem
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={s === lead.status || updating}
                >
                  Set: {s.replace(/_/g, " ")}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mini Stat Cards */}
      <div className="grid grid-cols-4 gap-4 mb-7">
        {[
          {
            label: "Total Debt",
            value: formatCurrency(lead.totalDebtEst),
            Icon: DollarSign,
          },
          {
            label: "Monthly Revenue",
            value: getMonthlyRevenue(lead.annualRevenue),
            Icon: TrendingUp,
          },
          {
            label: "Days in Pipeline",
            value: String(getDaysInPipeline(lead.createdAt)),
            Icon: Clock,
          },
          {
            label: "Calls Made",
            value: String(lead.calls.length),
            Icon: PhoneCall,
          },
        ].map(({ label, value, Icon }) => (
          <div
            key={label}
            className="rounded-xl p-5"
            style={{
              background: "#ffffff",
              boxShadow: "0 12px 40px rgba(19,27,46,0.06)",
            }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Icon className="size-4" style={{ color: "#3052FF" }} />
              <p className="text-[12.5px] font-medium" style={{ color: "#444656" }}>
                {label}
              </p>
            </div>
            <p
              className="text-[24px] font-extrabold tracking-tight"
              style={{ fontFamily: "Manrope, sans-serif", color: "#131b2e" }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Tab Bar */}
      <Tabs defaultValue="overview">
        <div
          className="flex rounded-xl overflow-hidden mb-6"
          style={{
            background: "#ffffff",
            boxShadow: "0 12px 40px rgba(19,27,46,0.06)",
          }}
        >
          <TabsList className="flex h-auto bg-transparent p-0 w-full">
            {[
              { value: "overview", label: "Overview" },
              { value: "debts", label: "Debts" },
              { value: "calls", label: `Calls (${lead.calls.length})` },
              { value: "campaigns", label: "Campaigns" },
              { value: "documents", label: "Documents" },
              { value: "notes", label: "Notes" },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="relative flex-1 px-6 py-3.5 text-[13.5px] font-medium rounded-none border-0 data-[state=active]:shadow-none data-[state=active]:font-semibold"
                style={{
                  color: "#444656",
                  background: "transparent",
                }}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-0">
          <div className="grid gap-6" style={{ gridTemplateColumns: "1.5fr 1fr" }}>
            {/* Left column */}
            <div className="flex flex-col gap-5">
              {/* Contact Info Card */}
              <div
                className="rounded-xl p-6"
                style={{
                  background: "#ffffff",
                  boxShadow: "0 12px 40px rgba(19,27,46,0.06)",
                }}
              >
                <h3
                  className="text-base font-bold mb-5"
                  style={{ fontFamily: "Manrope, sans-serif" }}
                >
                  Contact Information
                </h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <InfoField label="Phone" value={formatPhone(lead.phone)} href={`tel:${lead.phone}`} />
                  <InfoField label="Email" value={lead.email || "--"} href={lead.email ? `mailto:${lead.email}` : undefined} />
                  <InfoField label="EIN" value={lead.ein || "--"} />
                  <InfoField label="Industry" value={lead.industry || "--"} />
                  <InfoField label="Annual Revenue" value={formatCurrency(lead.annualRevenue)} />
                  <InfoField label="Source" value={formatSourceLabel(lead.source)} />
                  {lead.utmCampaign && (
                    <InfoField label="UTM Campaign" value={lead.utmCampaign} />
                  )}
                  {lead.scoreReason && (
                    <InfoField label="Score Reason" value={lead.scoreReason} />
                  )}
                  <InfoField label="Created" value={formatDateShort(lead.createdAt)} />
                  <InfoField label="Last Updated" value={formatDateShort(lead.updatedAt)} />
                </div>
              </div>

              {/* Activity Timeline */}
              <div
                className="rounded-xl p-6"
                style={{
                  background: "#ffffff",
                  boxShadow: "0 12px 40px rgba(19,27,46,0.06)",
                }}
              >
                <h3
                  className="text-base font-bold mb-5"
                  style={{ fontFamily: "Manrope, sans-serif" }}
                >
                  Activity Timeline
                </h3>
                <div className="flex flex-col">
                  {/* Lead created */}
                  <div className="flex gap-4 pb-4 relative">
                    <div className="flex flex-col items-center">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: "rgba(48,82,255,0.08)", color: "#3052FF" }}
                      >
                        <User className="size-4" />
                      </div>
                      {(lead.lastContactedAt || lead.calls.length > 0) && (
                        <div className="w-px flex-1 mt-2" style={{ background: "#eaedff" }} />
                      )}
                    </div>
                    <div className="flex-1 pt-1.5 pb-2">
                      <p className="text-[13.5px] font-medium" style={{ color: "#131b2e" }}>Lead created</p>
                      <p className="text-[12.5px] mt-0.5" style={{ color: "#444656" }}>
                        Added to the pipeline
                      </p>
                    </div>
                    <div className="text-[12px] whitespace-nowrap pt-1.5" style={{ color: "#444656" }}>
                      {formatDateShort(lead.createdAt)}
                    </div>
                  </div>

                  {lead.lastContactedAt && (
                    <div className="flex gap-4 pb-4 relative">
                      <div className="flex flex-col items-center">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: "rgba(5,150,105,0.08)", color: "#059669" }}
                        >
                          <Phone className="size-4" />
                        </div>
                        {lead.calls.length > 0 && (
                          <div className="w-px flex-1 mt-2" style={{ background: "#eaedff" }} />
                        )}
                      </div>
                      <div className="flex-1 pt-1.5 pb-2">
                        <p className="text-[13.5px] font-medium" style={{ color: "#131b2e" }}>Last contacted</p>
                        <p className="text-[12.5px] mt-0.5" style={{ color: "#444656" }}>Phone or email contact made</p>
                      </div>
                      <div className="text-[12px] whitespace-nowrap pt-1.5" style={{ color: "#444656" }}>
                        {formatDateShort(lead.lastContactedAt)}
                      </div>
                    </div>
                  )}

                  {lead.calls.length > 0 && (
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: "rgba(48,82,255,0.08)", color: "#3052FF" }}
                        >
                          <PhoneCall className="size-4" />
                        </div>
                      </div>
                      <div className="flex-1 pt-1.5">
                        <p className="text-[13.5px] font-medium" style={{ color: "#131b2e" }}>
                          {lead.calls.length} call{lead.calls.length !== 1 ? "s" : ""} recorded
                        </p>
                        <p className="text-[12.5px] mt-0.5" style={{ color: "#444656" }}>
                          Latest: {formatDate(lead.calls[0]?.startedAt)}
                        </p>
                      </div>
                    </div>
                  )}

                  {lead.calls.length === 0 && !lead.lastContactedAt && (
                    <p className="text-[13px] text-center py-4" style={{ color: "#444656" }}>
                      No activity yet
                    </p>
                  )}
                </div>

                {/* Next follow-up */}
                {lead.nextFollowUpAt && (
                  <div
                    className="mt-4 pt-4 flex items-center gap-3"
                    style={{ borderTop: "1px solid #f2f3ff" }}
                  >
                    <Calendar className="size-4 flex-shrink-0" style={{ color: "#3052FF" }} />
                    <div>
                      <p className="text-[12px] font-medium uppercase tracking-wider" style={{ color: "#444656" }}>
                        Next Follow-up
                      </p>
                      <p className="text-sm font-medium" style={{ color: "#131b2e" }}>
                        {formatDate(lead.nextFollowUpAt)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Marketing Attribution (if present) */}
              {(lead.utmSource || lead.utmMedium || lead.utmCampaign || lead.utmTerm || lead.utmContent || lead.gclid || lead.fbclid || lead.eliClickId || lead.redtrackClickId) && (
                <div
                  className="rounded-xl p-6"
                  style={{
                    background: "#ffffff",
                    boxShadow: "0 12px 40px rgba(19,27,46,0.06)",
                  }}
                >
                  <h3
                    className="text-base font-bold mb-5"
                    style={{ fontFamily: "Manrope, sans-serif" }}
                  >
                    Marketing Attribution
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                    <InfoField label="UTM Source" value={lead.utmSource || "--"} />
                    <InfoField label="UTM Medium" value={lead.utmMedium || "--"} />
                    <InfoField label="UTM Campaign" value={lead.utmCampaign || "--"} />
                    <InfoField label="UTM Term" value={lead.utmTerm || "--"} />
                    <InfoField label="UTM Content" value={lead.utmContent || "--"} />
                    <InfoField label="GCLID" value={lead.gclid || "--"} />
                    <InfoField label="FBCLID" value={lead.fbclid || "--"} />
                    <InfoField label="EliClick ID" value={lead.eliClickId || "--"} />
                    <InfoField label="RedTrack Click ID" value={lead.redtrackClickId || "--"} />
                  </div>
                </div>
              )}

              {/* Notes */}
              {lead.notes && (
                <div
                  className="rounded-xl p-6"
                  style={{
                    background: "#ffffff",
                    boxShadow: "0 12px 40px rgba(19,27,46,0.06)",
                  }}
                >
                  <h3
                    className="text-base font-bold mb-4"
                    style={{ fontFamily: "Manrope, sans-serif" }}
                  >
                    Notes
                  </h3>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "#131b2e" }}>
                    {lead.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-5">
              {/* Assigned Agent */}
              <div
                className="rounded-xl p-6"
                style={{
                  background: "#ffffff",
                  boxShadow: "0 12px 40px rgba(19,27,46,0.06)",
                }}
              >
                <h3
                  className="text-base font-bold mb-5"
                  style={{ fontFamily: "Manrope, sans-serif" }}
                >
                  Assigned Agent
                </h3>
                {lead.assignedTo ? (
                  <>
                    <div className="flex items-center gap-3.5 mb-3">
                      <div
                        className="flex items-center justify-center rounded-full text-white font-semibold text-[15px] flex-shrink-0"
                        style={{
                          width: 44,
                          height: 44,
                          background: "linear-gradient(135deg,#0034e4,#3052ff)",
                        }}
                      >
                        {getInitials(lead.assignedTo.name)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm" style={{ color: "#131b2e" }}>
                          {lead.assignedTo.name}
                        </p>
                        <p className="text-[12.5px]" style={{ color: "#444656" }}>
                          {lead.assignedTo.email}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-3">
                    <div
                      className="flex items-center justify-center rounded-full flex-shrink-0"
                      style={{
                        width: 44,
                        height: 44,
                        background: "#f2f3ff",
                        color: "#444656",
                      }}
                    >
                      <User className="size-5" />
                    </div>
                    <p className="text-sm" style={{ color: "#444656" }}>Unassigned</p>
                  </div>
                )}
              </div>

              {/* Upcoming Tasks (next follow-up) */}
              <div
                className="rounded-xl p-6"
                style={{
                  background: "#ffffff",
                  boxShadow: "0 12px 40px rgba(19,27,46,0.06)",
                }}
              >
                <h3
                  className="text-base font-bold mb-4"
                  style={{ fontFamily: "Manrope, sans-serif" }}
                >
                  Upcoming Tasks
                </h3>
                {lead.nextFollowUpAt ? (
                  <div
                    className="flex items-center gap-3 py-3"
                    style={{ borderBottom: "1px solid #f2f3ff" }}
                  >
                    <div
                      className="w-5 h-5 rounded flex-shrink-0"
                      style={{ background: "#f2f3ff" }}
                    />
                    <p className="flex-1 text-[13.5px]" style={{ color: "#131b2e" }}>
                      Follow-up call
                    </p>
                    <p className="text-[12px]" style={{ color: "#444656" }}>
                      {formatDateShort(lead.nextFollowUpAt)}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: "#444656" }}>No upcoming tasks</p>
                )}
              </div>

              {/* Tags (source + industry as tags) */}
              <div
                className="rounded-xl p-6"
                style={{
                  background: "#ffffff",
                  boxShadow: "0 12px 40px rgba(19,27,46,0.06)",
                }}
              >
                <h3
                  className="text-base font-bold mb-4"
                  style={{ fontFamily: "Manrope, sans-serif" }}
                >
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    lead.industry,
                    formatSourceLabel(lead.source),
                    lead.status.replace(/_/g, " "),
                  ]
                    .filter(Boolean)
                    .map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 rounded-full text-[12px] font-medium"
                        style={{ background: "#f2f3ff", color: "#444656" }}
                      >
                        {tag}
                      </span>
                    ))}
                </div>
              </div>

              {/* Campaign Activity */}
              {lead.campaignContacts.length > 0 && (
                <div
                  className="rounded-xl p-6"
                  style={{
                    background: "#ffffff",
                    boxShadow: "0 12px 40px rgba(19,27,46,0.06)",
                  }}
                >
                  <h3
                    className="text-base font-bold mb-4"
                    style={{ fontFamily: "Manrope, sans-serif" }}
                  >
                    Campaign Activity
                  </h3>
                  <div className="flex flex-col gap-2">
                    {lead.campaignContacts.map((cc) => (
                      <div
                        key={cc.id}
                        className="flex items-center justify-between rounded-lg p-3"
                        style={{ background: "#f2f3ff" }}
                      >
                        <div>
                          <p className="text-sm font-medium" style={{ color: "#131b2e" }}>
                            {cc.campaign.name}
                          </p>
                          <p className="text-[12px]" style={{ color: "#444656" }}>
                            {cc.attempts} attempt{cc.attempts !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {cc.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Debts Tab */}
        <TabsContent value="debts" className="mt-0">
          <div
            className="rounded-xl p-6"
            style={{ background: "#ffffff", boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
          >
            <h3 className="text-base font-bold mb-4" style={{ fontFamily: "Manrope, sans-serif" }}>
              Debt Summary
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <InfoField label="Estimated Total Debt" value={formatCurrency(lead.totalDebtEst)} />
              <InfoField label="Annual Revenue" value={formatCurrency(lead.annualRevenue)} />
              <InfoField label="Monthly Revenue" value={getMonthlyRevenue(lead.annualRevenue)} />
            </div>
          </div>
        </TabsContent>

        {/* Calls Tab */}
        <TabsContent value="calls" className="mt-0">
          {lead.calls.length === 0 ? (
            <div
              className="rounded-xl p-12 text-center"
              style={{ background: "#ffffff", boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
            >
              <Phone className="size-8 mx-auto mb-3" style={{ color: "#444656" }} />
              <p className="mb-3" style={{ color: "#444656" }}>No calls recorded yet.</p>
              <Button
                size="sm"
                style={{ background: "linear-gradient(135deg,#0034e4,#3052ff)", color: "#fff", border: "none" }}
                asChild
              >
                <Link href={`/dialer?leadId=${lead.id}`}>Make First Call</Link>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {lead.calls.map((call) => (
                <div
                  key={call.id}
                  className="rounded-xl p-4"
                  style={{ background: "#ffffff", boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="size-9 rounded-lg flex items-center justify-center"
                        style={{
                          background:
                            call.direction === "OUTBOUND"
                              ? "rgba(48,82,255,0.08)"
                              : "rgba(5,150,105,0.08)",
                          color: call.direction === "OUTBOUND" ? "#3052FF" : "#059669",
                        }}
                      >
                        <Phone className="size-3.5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium" style={{ color: "#131b2e" }}>
                          {call.direction === "OUTBOUND" ? "Outbound" : "Inbound"} Call
                        </p>
                        <p className="text-[12.5px]" style={{ color: "#444656" }}>
                          {call.agent.name} · {formatDate(call.startedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {call.disposition && (
                        <Badge variant="secondary" className="text-xs">
                          {call.disposition.replace(/_/g, " ")}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {call.status.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-[12px]" style={{ color: "#444656" }}>
                        {formatDuration(call.duration)}
                      </span>
                    </div>
                  </div>
                  {call.notes && (
                    <p className="mt-2 text-sm pl-12" style={{ color: "#444656" }}>
                      {call.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="mt-0">
          {lead.campaignContacts.length === 0 ? (
            <div
              className="rounded-xl p-12 text-center"
              style={{ background: "#ffffff", boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
            >
              <p style={{ color: "#444656" }}>No campaign activity.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {lead.campaignContacts.map((cc) => (
                <div
                  key={cc.id}
                  className="rounded-xl p-4 flex items-center justify-between"
                  style={{ background: "#ffffff", boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: "#131b2e" }}>{cc.campaign.name}</p>
                    <p className="text-[12.5px]" style={{ color: "#444656" }}>
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
            </div>
          )}
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-0">
          <div
            className="rounded-xl p-12 text-center"
            style={{ background: "#ffffff", boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
          >
            <p style={{ color: "#444656" }}>No documents uploaded.</p>
          </div>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="mt-0">
          <div
            className="rounded-xl p-6"
            style={{ background: "#ffffff", boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
          >
            <h3 className="text-base font-bold mb-4" style={{ fontFamily: "Manrope, sans-serif" }}>
              Notes
            </h3>
            {lead.notes ? (
              <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "#131b2e" }}>
                {lead.notes}
              </p>
            ) : (
              <p style={{ color: "#444656" }}>No notes added.</p>
            )}
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
