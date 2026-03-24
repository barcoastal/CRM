"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const STAGE_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  WORKING_OPPORTUNITY:      { bg: "#e0e7ff", text: "#4338ca" },
  WAITING_FOR_AGREEMENTS:   { bg: "#e0e7ff", text: "#3730a3" },
  READY_TO_CLOSE:           { bg: "#fef3c7", text: "#92400e" },
  CONTRACT_SENT:            { bg: "#d1fae5", text: "#065f46" },
  CONTRACT_SIGNED:          { bg: "#d1fae5", text: "#047857" },
  ARCHIVED:                 { bg: "#f3f4f6", text: "#374151" },
  CLOSED_WON_FIRST_PAYMENT: { bg: "#dcfce7", text: "#166534" },
  CLOSED:                   { bg: "#fee2e2", text: "#991b1b" },
};

const DISPOSITION_COLORS: Record<string, string> = {
  INTERESTED:     "bg-green-100 text-green-800",
  NOT_INTERESTED: "bg-red-100 text-red-800",
  CALLBACK:       "bg-blue-100 text-blue-800",
  NOT_QUALIFIED:  "bg-gray-100 text-gray-800",
  WRONG_NUMBER:   "bg-orange-100 text-orange-800",
  VOICEMAIL:      "bg-purple-100 text-purple-800",
  NO_ANSWER:      "bg-yellow-100 text-yellow-800",
  DNC:            "bg-red-200 text-red-900",
  ENROLLED:       "bg-emerald-100 text-emerald-800",
};

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

function getDaysInStage(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
}

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Sub-components ──────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "#ffffff",
        boxShadow: "0 12px 40px rgba(19,27,46,0.06)",
      }}
    >
      <p
        className="text-[10.5px] font-semibold uppercase tracking-widest mb-1"
        style={{ color: "#444656" }}
      >
        {label}
      </p>
      <p
        className="text-[1.4rem] font-bold leading-none"
        style={{ fontFamily: "Manrope, sans-serif", color: "#131b2e" }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[11.5px] mt-1" style={{ color: "#444656" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div
      className="flex justify-between py-[9px] text-[12.5px]"
      style={{ boxShadow: "0 1px 0 #eaedff" }}
    >
      <span style={{ color: "#444656" }}>{label}</span>
      {href ? (
        <a href={href} style={{ color: "#3052ff" }} className="font-medium hover:underline">
          {value}
        </a>
      ) : (
        <span className="font-medium" style={{ color: "#131b2e" }}>
          {value}
        </span>
      )}
    </div>
  );
}

function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-xl p-5", className)}
      style={{ background: "#ffffff", boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
    >
      <p
        className="text-[14px] font-bold mb-4"
        style={{ fontFamily: "Manrope, sans-serif", color: "#131b2e" }}
      >
        {title}
      </p>
      {children}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────

export function OpportunityDetailTabs({ opportunity }: OpportunityDetailTabsProps) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

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

  const stageBadgeColors = STAGE_BADGE_COLORS[opportunity.stage] || { bg: "#f2f3ff", text: "#444656" };

  // Computed values
  const totalDebtFromDebts = opportunity.debts.reduce((sum, d) => sum + d.currentBalance, 0);
  const displayDebt = opportunity.totalDebt || totalDebtFromDebts || opportunity.lead.totalDebtEst || 0;
  const settlementTarget = displayDebt * 0.6;
  const daysInStage = getDaysInStage(opportunity.createdAt);

  const lastCall = opportunity.lead.calls[0];
  const interestedCalls = opportunity.lead.calls.filter((c) => c.disposition === "INTERESTED").length;
  const totalCalls = opportunity.lead.calls.length;

  const settledDebts = opportunity.debts.filter((d) => d.status === "SETTLED" || d.status === "PAID");
  const totalSettled = settledDebts.reduce((sum, d) => sum + (d.settledAmount || 0), 0);
  const totalSavings = settledDebts.reduce((sum, d) => sum + (d.savingsAmount || 0), 0);

  const assigneeName = opportunity.assignedTo?.name ?? "";
  const assigneeInitials = assigneeName ? getInitials(assigneeName) : "?";

  const TABS = [
    { key: "overview", label: "Overview" },
    { key: "lead", label: "Lead Info" },
    { key: "debts", label: `Debts (${opportunity.debts.length})` },
    { key: "negotiations", label: "Negotiations" },
    { key: "documents", label: `Documents (${opportunity.documents.length})` },
    { key: "activities", label: "Activities" },
    { key: "calculator", label: "Calculator" },
    { key: "marketing", label: "Marketing" },
  ];

  return (
    <div className="space-y-5">
      {/* ── Breadcrumb ───────────────────────────────── */}
      <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "#444656" }}>
        <Link href="/opportunities" style={{ color: "#3052ff" }} className="font-medium hover:underline">
          Opportunities
        </Link>
        <span>&rsaquo;</span>
        <span>{opportunity.lead.businessName}</span>
      </div>

      {/* ── Detail Header ────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1
              className="text-[1.5rem] font-bold tracking-tight"
              style={{ fontFamily: "Manrope, sans-serif", color: "#131b2e" }}
            >
              {opportunity.lead.businessName}
            </h1>
            <span
              className="text-[11.5px] font-semibold px-2.5 py-1 rounded"
              style={{ background: stageBadgeColors.bg, color: stageBadgeColors.text }}
            >
              {opportunity.stage.replace(/_/g, " ")}
            </span>
          </div>
          <div
            className="flex gap-5 text-[12.5px]"
            style={{ color: "#444656" }}
          >
            <span>
              Total Debt:{" "}
              <strong style={{ color: "#131b2e" }}>{formatCurrency(displayDebt)}</strong>
            </span>
            <span>
              Expected Close:{" "}
              <strong style={{ color: "#131b2e" }}>{formatDate(opportunity.expectedCloseDate)}</strong>
            </span>
            {opportunity.lead.contactName && (
              <span>
                Contact:{" "}
                <strong style={{ color: "#131b2e" }}>{opportunity.lead.contactName}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={`/opportunities/${opportunity.id}/edit`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded text-[12.5px] font-medium transition-opacity hover:opacity-80"
            style={{ background: "#eaedff", color: "#131b2e", border: "none" }}
          >
            <Pencil className="size-3.5" />
            Edit
          </Link>

          {nextStage && (
            <button
              onClick={() => handleStageChange(nextStage)}
              disabled={updating}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded text-[12.5px] font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ background: "#eaedff", color: "#131b2e", border: "none" }}
            >
              Advance Stage
              <ChevronRight className="size-3.5" />
            </button>
          )}

          {(canEnroll || opportunity.stage === "CONTRACT_SIGNED" || opportunity.stage === "CLOSED_WON_FIRST_PAYMENT") && (
            <button
              onClick={() => setEnrollOpen(true)}
              disabled={!!opportunity.client}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: opportunity.client ? "#6b7280" : "#059669", border: "none" }}
            >
              {opportunity.client ? "Already Enrolled" : "Convert to Client"}
            </button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                disabled={updating}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded text-[12.5px] font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ background: "#eaedff", color: "#131b2e", border: "none" }}
              >
                Set Stage
                <ChevronDown className="size-3.5" />
              </button>
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

      {/* ── Stat Cards ───────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Debt"
          value={formatCurrency(displayDebt)}
          sub={`${opportunity.debts.length} creditor${opportunity.debts.length !== 1 ? "s" : ""}`}
        />
        <StatCard
          label="Settlement Target"
          value={formatCurrency(settlementTarget)}
          sub="60% of total debt"
        />
        <StatCard
          label="Monthly Payment"
          value={displayDebt > 0 ? formatCurrency(Math.round(settlementTarget / 36)) : "--"}
          sub="36 month program"
        />
        <StatCard
          label="Days in Stage"
          value={String(daysInStage)}
          sub="Since created"
        />
      </div>

      {/* ── Tab Nav ──────────────────────────────────── */}
      <div
        className="flex gap-0 border-b"
        style={{ borderColor: "#eaedff" }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="relative px-4 py-2.5 text-[12.5px] font-medium transition-colors"
            style={{
              color: activeTab === tab.key ? "#3052ff" : "#444656",
              fontWeight: activeTab === tab.key ? 600 : 500,
              background: "none",
              border: "none",
            }}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span
                className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t"
                style={{ background: "#3052ff" }}
              />
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════
          TAB: OVERVIEW
      ═══════════════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Left column — timeline + notes */}
          <div className="md:col-span-2 space-y-4">
            <Panel title="Deal Timeline">
              <div className="relative pl-6">
                {/* Vertical line */}
                <div
                  className="absolute left-[5px] top-1 bottom-1 w-[2px]"
                  style={{ background: "#eaedff" }}
                />
                {[
                  {
                    label: "Lead Created",
                    date: formatDateTime(opportunity.lead.createdAt),
                    sub: `Source: ${formatSourceLabel(opportunity.lead.source)}`,
                    done: true,
                    current: false,
                  },
                  {
                    label: "Opportunity Created",
                    date: formatDateTime(opportunity.createdAt),
                    sub: `Assigned to ${opportunity.assignedTo?.name || "Unassigned"}`,
                    done: true,
                    current: false,
                  },
                  ...STAGE_ORDER.filter((s) => s !== "CLOSED" && s !== "ARCHIVED").map((s, i) => {
                    const currentIdx = STAGE_ORDER.indexOf(opportunity.stage as (typeof STAGE_ORDER)[number]);
                    const stepIdx = STAGE_ORDER.indexOf(s);
                    const isDone = stepIdx < currentIdx;
                    const isCurrent = s === opportunity.stage;
                    const isPending = stepIdx > currentIdx;
                    return {
                      label: s === "CLOSED_WON_FIRST_PAYMENT" ? "Won — First Payment" : s.replace(/_/g, " "),
                      date: isCurrent
                        ? `Since ${formatDate(opportunity.updatedAt)}`
                        : isPending
                          ? "Pending"
                          : formatDate(opportunity.updatedAt),
                      sub: isCurrent ? "Current stage" : undefined,
                      done: isDone,
                      current: isCurrent,
                    };
                  }),
                  {
                    label: "Expected Close",
                    date: formatDate(opportunity.expectedCloseDate),
                    sub: opportunity.expectedCloseDate ? undefined : "No date set",
                    done: false,
                    current: false,
                  },
                ].map((item, idx) => (
                  <div key={idx} className="relative mb-4 last:mb-0">
                    {/* Dot */}
                    <div
                      className="absolute left-[-1.4rem] top-[3px] w-3 h-3 rounded-full"
                      style={{
                        background: item.current
                          ? "#3052ff"
                          : item.done
                            ? "#059669"
                            : "#c4c5d9",
                        boxShadow: item.current
                          ? "0 0 0 4px rgba(48,82,255,0.15)"
                          : undefined,
                      }}
                    />
                    <p
                      className="text-[13px] font-semibold"
                      style={{ color: "#131b2e" }}
                    >
                      {item.label}
                    </p>
                    <p className="text-[11.5px] mt-0.5" style={{ color: "#444656" }}>
                      {item.date}
                      {item.sub && ` — ${item.sub}`}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Notes */}
            <Panel title="Notes">
              {opportunity.notes || opportunity.lead.notes ? (
                <div className="space-y-3">
                  {opportunity.notes && (
                    <div
                      className="rounded p-3"
                      style={{ background: "#f2f3ff" }}
                    >
                      <p className="text-[11px] font-semibold mb-1" style={{ color: "#444656" }}>
                        Opportunity Notes
                      </p>
                      <p className="text-[12.5px] leading-relaxed" style={{ color: "#131b2e" }}>
                        {opportunity.notes}
                      </p>
                    </div>
                  )}
                  {opportunity.lead.notes && (
                    <div
                      className="rounded p-3"
                      style={{ background: "#f2f3ff" }}
                    >
                      <p className="text-[11px] font-semibold mb-1" style={{ color: "#444656" }}>
                        Lead Notes
                      </p>
                      <p className="text-[12.5px] leading-relaxed" style={{ color: "#131b2e" }}>
                        {opportunity.lead.notes}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[12.5px]" style={{ color: "#444656" }}>
                  No notes recorded.
                </p>
              )}
            </Panel>
          </div>

          {/* Right column — negotiator + details */}
          <div className="space-y-4">
            <Panel title="Assigned Negotiator">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
                >
                  {assigneeInitials}
                </div>
                <div>
                  <p className="text-[13.5px] font-semibold" style={{ color: "#131b2e" }}>
                    {assigneeName || "Unassigned"}
                  </p>
                  <p className="text-[11.5px]" style={{ color: "#444656" }}>
                    Negotiator
                  </p>
                </div>
              </div>
              {opportunity.assignedTo && (
                <>
                  <InfoRow label="Email" value={opportunity.assignedTo.email} />
                </>
              )}
            </Panel>

            <Panel title="Details">
              <InfoRow
                label="Related Lead"
                value={`LD-${opportunity.lead.id.slice(-8).toUpperCase()}`}
                href={`/leads/${opportunity.lead.id}`}
              />
              <InfoRow label="Source" value={formatSourceLabel(opportunity.lead.source)} />
              <InfoRow label="Industry" value={opportunity.lead.industry || "--"} />
              <InfoRow label="Phone" value={formatPhone(opportunity.lead.phone)} />
              <InfoRow label="Email" value={opportunity.lead.email || "--"} />
              <InfoRow label="EIN" value={opportunity.lead.ein || "--"} />
              <InfoRow label="Lead Score" value={opportunity.lead.score !== null ? String(opportunity.lead.score) : "--"} />
              <InfoRow label="Created" value={formatDate(opportunity.createdAt)} />
              {opportunity.client && (
                <InfoRow
                  label="Client Record"
                  value="View Client"
                  href={`/clients/${opportunity.client.id}`}
                />
              )}
            </Panel>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          TAB: LEAD INFO
      ═══════════════════════════════════════════════════ */}
      {activeTab === "lead" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Panel title="Contact Information">
            <InfoRow label="Contact Name" value={opportunity.lead.contactName} />
            <InfoRow label="Phone" value={formatPhone(opportunity.lead.phone)} />
            <InfoRow label="Email" value={opportunity.lead.email || "--"} />
            <InfoRow label="EIN" value={opportunity.lead.ein || "--"} />
          </Panel>

          <Panel title="Business Information">
            <InfoRow label="Business Name" value={opportunity.lead.businessName} />
            <InfoRow label="Industry" value={opportunity.lead.industry || "--"} />
            <InfoRow label="Annual Revenue" value={formatCurrency(opportunity.lead.annualRevenue)} />
            <InfoRow label="Estimated Debt" value={formatCurrency(opportunity.lead.totalDebtEst)} />
            <InfoRow label="Source" value={formatSourceLabel(opportunity.lead.source)} />
            <InfoRow label="Lead Status" value={opportunity.lead.status.replace(/_/g, " ")} />
            <InfoRow label="Lead Score" value={opportunity.lead.score !== null ? String(opportunity.lead.score) : "--"} />
          </Panel>

          <Panel title="Call Disposition">
            <InfoRow label="Total Calls" value={String(totalCalls)} />
            <InfoRow label="Interested" value={String(interestedCalls)} />
            {lastCall && (
              <>
                <InfoRow label="Last Disposition" value={lastCall.disposition?.replace(/_/g, " ") || "None"} />
                <InfoRow label="Last Agent" value={lastCall.agent.name} />
                <InfoRow label="Last Call Date" value={formatDateTime(lastCall.startedAt)} />
                <InfoRow label="Duration" value={formatDuration(lastCall.duration)} />
              </>
            )}
            {totalCalls > 0 && (
              <div className="pt-3 mt-1" style={{ borderTop: "1px solid #eaedff" }}>
                <p className="text-[11px] font-semibold mb-2" style={{ color: "#444656" }}>
                  Recent Dispositions
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {opportunity.lead.calls.slice(0, 5).map((call) => (
                    <span
                      key={call.id}
                      className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded ${DISPOSITION_COLORS[call.disposition || ""] || "bg-gray-100 text-gray-800"}`}
                    >
                      {call.disposition?.replace(/_/g, " ") || "N/A"}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Follow-Up">
            <InfoRow label="Last Contacted" value={formatDate(opportunity.lead.lastContactedAt)} />
            <InfoRow label="Next Follow-Up" value={formatDate(opportunity.lead.nextFollowUpAt)} />
            <InfoRow label="Lead Created" value={formatDate(opportunity.lead.createdAt)} />
          </Panel>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          TAB: DEBTS
      ═══════════════════════════════════════════════════ */}
      {activeTab === "debts" && (
        <DebtTable
          debts={opportunity.debts}
          opportunityId={opportunity.id}
          onRefresh={handleRefresh}
        />
      )}

      {/* ═══════════════════════════════════════════════════
          TAB: NEGOTIATIONS
      ═══════════════════════════════════════════════════ */}
      {activeTab === "negotiations" && (
        <div className="space-y-5">
          {/* Settlement summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Debts" value={String(opportunity.debts.length)} />
            <StatCard label="Settled" value={String(settledDebts.length)} />
            <StatCard label="Total Settled For" value={formatCurrency(totalSettled)} />
            <StatCard label="Total Savings" value={formatCurrency(totalSavings)} />
          </div>

          {settledDebts.length > 0 && (
            <Panel title="Settlement Details">
              <div className="space-y-2">
                {settledDebts.map((debt) => (
                  <div
                    key={debt.id}
                    className="flex items-center justify-between rounded-lg p-3"
                    style={{ background: "#f2f3ff" }}
                  >
                    <div>
                      <p className="text-[13px] font-semibold" style={{ color: "#131b2e" }}>
                        {debt.creditorName}
                      </p>
                      <p className="text-[11.5px] mt-0.5" style={{ color: "#444656" }}>
                        Original: {formatCurrency(debt.originalBalance)} | Settled: {formatCurrency(debt.settledAmount)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[12.5px] font-semibold" style={{ color: "#059669" }}>
                        {debt.savingsPercent !== null ? `${debt.savingsPercent.toFixed(1)}% savings` : ""}
                      </p>
                      <p className="text-[11.5px]" style={{ color: "#444656" }}>
                        {debt.settledDate ? formatDate(debt.settledDate) : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {opportunity.debts.some((d) => d.negotiations.length > 0) && (
            <Panel title="Negotiation History">
              <div className="space-y-2">
                {opportunity.debts
                  .flatMap((debt) =>
                    debt.negotiations.map((neg) => ({
                      ...neg,
                      creditorName: debt.creditorName,
                    }))
                  )
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 15)
                  .map((neg) => (
                    <div
                      key={neg.id}
                      className="flex items-center justify-between rounded-lg p-3"
                      style={{ background: "#f2f3ff" }}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-semibold" style={{ color: "#131b2e" }}>
                            {neg.creditorName}
                          </p>
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                            style={{ background: "#eaedff", color: "#444656" }}
                          >
                            {neg.type}
                          </span>
                        </div>
                        <p className="text-[11.5px] mt-0.5" style={{ color: "#444656" }}>
                          {neg.offerAmount !== null && `Offer: ${formatCurrency(neg.offerAmount)}`}
                          {neg.counterAmount !== null && ` | Counter: ${formatCurrency(neg.counterAmount)}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded ${
                            neg.response === "ACCEPTED"
                              ? "bg-green-100 text-green-800"
                              : neg.response === "REJECTED"
                                ? "bg-red-100 text-red-800"
                                : neg.response === "COUNTERED"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {neg.response}
                        </span>
                        <p className="text-[11px] mt-1" style={{ color: "#444656" }}>
                          {formatDate(neg.date)}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </Panel>
          )}

          {!settledDebts.length && !opportunity.debts.some((d) => d.negotiations.length > 0) && (
            <div
              className="rounded-xl p-12 text-center"
              style={{ background: "#ffffff", boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
            >
              <DollarSign className="size-8 mx-auto mb-3" style={{ color: "#c4c5d9" }} />
              <p className="text-[13px]" style={{ color: "#444656" }}>
                No negotiations recorded yet.
              </p>
              <p className="text-[12px] mt-1" style={{ color: "#c4c5d9" }}>
                Add debts in the Debts tab to start tracking negotiations.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          TAB: DOCUMENTS
      ═══════════════════════════════════════════════════ */}
      {activeTab === "documents" && (
        <DocumentList
          documents={opportunity.documents}
          opportunityId={opportunity.id}
          onRefresh={handleRefresh}
        />
      )}

      {/* ═══════════════════════════════════════════════════
          TAB: ACTIVITIES
      ═══════════════════════════════════════════════════ */}
      {activeTab === "activities" && (
        <ContactActivityLog
          calls={opportunity.lead.calls}
          campaignContacts={opportunity.lead.campaignContacts}
          leadCreatedAt={opportunity.lead.createdAt}
          lastContactedAt={opportunity.lead.lastContactedAt}
          nextFollowUpAt={opportunity.lead.nextFollowUpAt}
        />
      )}

      {/* ═══════════════════════════════════════════════════
          TAB: CALCULATOR
      ═══════════════════════════════════════════════════ */}
      {activeTab === "calculator" && (
        <PaymentCalculator
          initialDebt={displayDebt}
          businessName={opportunity.lead.businessName}
          contactEmail={opportunity.lead.email || ""}
          compact
        />
      )}

      {/* ═══════════════════════════════════════════════════
          TAB: MARKETING
      ═══════════════════════════════════════════════════ */}
      {activeTab === "marketing" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Interactions"
              value={String(
                opportunity.lead.calls.length +
                  opportunity.lead.campaignContacts.reduce((sum, cc) => sum + cc.attempts, 0)
              )}
            />
            <StatCard label="Calls Made" value={String(opportunity.lead.calls.length)} />
            <StatCard label="Campaigns" value={String(opportunity.lead.campaignContacts.length)} />
            <StatCard label="Last Contact" value={formatDate(opportunity.lead.lastContactedAt)} />
          </div>

          {/* Related */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Panel title="Lead Record">
              <div
                className="flex items-center justify-between rounded-lg p-3"
                style={{ background: "#f2f3ff" }}
              >
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: "#131b2e" }}>
                    {opportunity.lead.businessName}
                  </p>
                  <p className="text-[11.5px] mt-0.5" style={{ color: "#444656" }}>
                    {opportunity.lead.contactName} | Created {formatDate(opportunity.lead.createdAt)}
                  </p>
                  <span
                    className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded mt-1"
                    style={{ background: "#eaedff", color: "#444656" }}
                  >
                    {opportunity.lead.status.replace(/_/g, " ")}
                  </span>
                </div>
                <Link
                  href={`/leads/${opportunity.lead.id}`}
                  className="inline-flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded transition-opacity hover:opacity-80"
                  style={{ background: "#eaedff", color: "#131b2e" }}
                >
                  View Lead
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            </Panel>

            <Panel title="Client Record">
              {opportunity.client ? (
                <div
                  className="flex items-center justify-between rounded-lg p-3"
                  style={{ background: "#f2f3ff" }}
                >
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: "#131b2e" }}>
                      {opportunity.lead.businessName}
                    </p>
                    <span
                      className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded mt-1 bg-green-100 text-green-800"
                    >
                      ENROLLED
                    </span>
                  </div>
                  <Link
                    href={`/clients/${opportunity.client.id}`}
                    className="inline-flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded transition-opacity hover:opacity-80"
                    style={{ background: "#eaedff", color: "#131b2e" }}
                  >
                    View Client
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="rounded-lg p-6 text-center" style={{ background: "#f2f3ff" }}>
                  <p className="text-[12.5px]" style={{ color: "#444656" }}>
                    Not yet enrolled as a client.
                  </p>
                  {canEnroll && (
                    <button
                      onClick={() => setEnrollOpen(true)}
                      className="mt-3 px-4 py-2 rounded text-[12.5px] font-semibold text-white"
                      style={{ background: "#059669", border: "none" }}
                    >
                      Convert to Client
                    </button>
                  )}
                </div>
              )}
            </Panel>
          </div>

          {/* Campaign History */}
          {opportunity.lead.campaignContacts.length > 0 && (
            <Panel title="Campaign History">
              <div className="space-y-2">
                {opportunity.lead.campaignContacts.map((cc) => {
                  const campaignCalls = opportunity.lead.calls.filter(
                    (c) => c.campaign?.id === cc.campaign.id
                  );
                  return (
                    <div
                      key={cc.id}
                      className="rounded-lg p-4"
                      style={{ background: "#f2f3ff" }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-[13px] font-semibold" style={{ color: "#131b2e" }}>
                            {cc.campaign.name}
                          </p>
                          <p className="text-[11.5px]" style={{ color: "#444656" }}>
                            {cc.attempts} attempts | {campaignCalls.length} calls logged
                          </p>
                        </div>
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded"
                          style={{ background: "#eaedff", color: "#444656" }}
                        >
                          {cc.campaign.status}
                        </span>
                      </div>
                      {campaignCalls.length > 0 && (
                        <div className="space-y-1.5">
                          {campaignCalls.slice(0, 5).map((call) => (
                            <div key={call.id} className="flex items-center gap-3 text-[12px]">
                              {call.direction === "OUTBOUND" ? (
                                <ArrowUpRight className="size-3.5 text-blue-500 flex-shrink-0" />
                              ) : (
                                <ArrowDownLeft className="size-3.5 text-green-500 flex-shrink-0" />
                              )}
                              <span style={{ color: "#444656" }} className="w-32 flex-shrink-0">
                                {formatDateTime(call.startedAt)}
                              </span>
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${DISPOSITION_COLORS[call.disposition || ""] || "bg-gray-100 text-gray-800"}`}
                              >
                                {call.disposition?.replace(/_/g, " ") || "N/A"}
                              </span>
                              <span style={{ color: "#444656" }}>
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
            </Panel>
          )}

          {/* Engagement Timeline */}
          <Panel title="Engagement Timeline">
            {opportunity.lead.calls.length > 0 ? (
              <div className="space-y-3">
                {opportunity.lead.calls.slice(0, 15).map((call) => (
                  <div key={call.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          "flex size-8 items-center justify-center rounded-full flex-shrink-0",
                          call.direction === "OUTBOUND" ? "bg-blue-100" : "bg-green-100"
                        )}
                      >
                        {call.direction === "OUTBOUND" ? (
                          <ArrowUpRight className="size-3.5 text-blue-600" />
                        ) : (
                          <ArrowDownLeft className="size-3.5 text-green-600" />
                        )}
                      </div>
                      <div className="flex-1 w-px" style={{ background: "#eaedff" }} />
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium" style={{ color: "#131b2e" }}>
                            {call.direction === "OUTBOUND" ? "Outbound Call" : "Inbound Call"}
                          </span>
                          {call.disposition && (
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${DISPOSITION_COLORS[call.disposition] || "bg-gray-100 text-gray-800"}`}
                            >
                              {call.disposition.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                        <span className="text-[11.5px]" style={{ color: "#444656" }}>
                          {formatDateTime(call.startedAt)}
                        </span>
                      </div>
                      <p className="text-[11.5px] mt-0.5" style={{ color: "#444656" }}>
                        Agent: {call.agent.name}
                        {call.campaign && ` | Campaign: ${call.campaign.name}`}
                        {call.duration && ` | ${formatDuration(call.duration)}`}
                      </p>
                      {call.notes && (
                        <p className="text-[11.5px] mt-1 italic" style={{ color: "#444656" }}>
                          {call.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Mail className="size-8 mx-auto mb-2" style={{ color: "#c4c5d9" }} />
                <p className="text-[13px]" style={{ color: "#444656" }}>
                  No engagement history yet.
                </p>
              </div>
            )}
          </Panel>
        </div>
      )}

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
