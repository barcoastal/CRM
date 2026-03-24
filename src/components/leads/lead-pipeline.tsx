"use client";

import { useRouter } from "next/navigation";
import { formatCurrency, formatSourceLabel } from "@/components/leads/lead-table";

// ─── Column config ────────────────────────────────────────────────────────────

const PIPELINE_COLUMNS = [
  { status: "NEW", label: "New", color: "#3052FF" },
  { status: "CONTACTED", label: "Contacted", color: "#F59E0B" },
  { status: "QUALIFIED", label: "Qualified", color: "#10B981" },
  { status: "OPPORTUNITY", label: "Proposal", color: "#8B5CF6" },
  { status: "ENROLLED", label: "Enrolled", color: "#059669" },
  { status: "LOST", label: "Lost", color: "#EF4444" },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeadAssignee {
  id: string;
  name: string;
  email: string;
}

interface Lead {
  id: string;
  businessName: string;
  contactName: string;
  totalDebtEst: number | null;
  score: number | null;
  status: string;
  source: string;
  assignedTo: LeadAssignee | null;
  createdAt: string;
}

interface LeadPipelineProps {
  leads: Lead[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Stable avatar background colour derived from a name string */
const AVATAR_COLORS = [
  "#3052FF",
  "#8B5CF6",
  "#10B981",
  "#F59E0B",
  "#0891B2",
  "#059669",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function daysAgo(iso: string): string {
  const diff = Math.floor(
    (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "1 day";
  return `${diff} days`;
}

function columnTotal(leads: Lead[]): string {
  const total = leads.reduce((sum, l) => sum + (l.totalDebtEst ?? 0), 0);
  if (total === 0) return "";
  if (total >= 1_000_000)
    return `$${(total / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M total debt`;
  if (total >= 1_000)
    return `$${Math.round(total / 1000)}K total debt`;
  return `${formatCurrency(total)} total debt`;
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function PipelineCard({ lead, accentColor }: { lead: Lead; accentColor: string }) {
  const router = useRouter();
  const assigneeName = lead.assignedTo?.name ?? "";

  return (
    <div
      className="relative rounded-xl cursor-pointer mb-2"
      style={{
        background: "#ffffff",
        padding: "0.85rem 1rem",
        transition: "box-shadow 0.2s, transform 0.15s",
      }}
      onClick={() => router.push(`/leads/${lead.id}`)}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = "0 12px 40px rgba(19,27,46,0.10)";
        el.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = "none";
        el.style.transform = "translateY(0)";
      }}
    >
      {/* Left colour bar */}
      <span
        className="absolute left-0 rounded-r-[2px]"
        style={{
          top: 8,
          bottom: 8,
          width: 3,
          background: accentColor,
          borderRadius: "0 2px 2px 0",
        }}
      />

      {/* Business name */}
      <div
        className="font-semibold text-[13.5px] pl-2 mb-0.5"
        style={{ color: "#131b2e" }}
      >
        {lead.businessName}
      </div>

      {/* Contact name */}
      <div className="text-[12px] pl-2 mb-2.5" style={{ color: "#444656" }}>
        {lead.contactName}
      </div>

      {/* Debt amount */}
      <div className="flex items-center pl-2 mb-2">
        <span
          className="font-semibold text-[13px]"
          style={{ color: "#131b2e" }}
        >
          {formatCurrency(lead.totalDebtEst)}
        </span>
      </div>

      {/* Footer: source tag + avatar + days */}
      <div className="flex items-center justify-between pl-2">
        <span
          className="text-[11px] font-medium px-2 py-0.5 rounded-[4px]"
          style={{ background: "#f2f3ff", color: "#444656" }}
        >
          {formatSourceLabel(lead.source)}
        </span>
        <div className="flex items-center gap-1.5">
          {assigneeName && (
            <div
              className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[9px] font-semibold text-white flex-shrink-0"
              style={{ background: avatarColor(assigneeName) }}
              title={assigneeName}
            >
              {initials(assigneeName)}
            </div>
          )}
          <span className="text-[11px]" style={{ color: "#444656" }}>
            {daysAgo(lead.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Pipeline Board ───────────────────────────────────────────────────────────

export function LeadPipeline({ leads }: LeadPipelineProps) {
  return (
    <div
      className="flex gap-4 overflow-x-auto pb-4"
      style={{ scrollbarWidth: "thin", scrollbarColor: "#c4c5d9 transparent" }}
    >
      {PIPELINE_COLUMNS.map((column) => {
        const columnLeads = leads.filter((l) => l.status === column.status);
        const totalLabel = columnTotal(columnLeads);

        return (
          <div
            key={column.status}
            className="flex-shrink-0 flex flex-col rounded-xl"
            style={{
              width: 260,
              background: "#eaedff",
              maxHeight: "calc(100vh - 220px)",
            }}
          >
            {/* Column header */}
            <div
              className="flex items-center gap-2 flex-shrink-0"
              style={{ padding: "0.85rem 1rem 0.75rem" }}
            >
              {/* Accent bar */}
              <div
                className="flex-shrink-0"
                style={{
                  width: 3,
                  height: 24,
                  borderRadius: 2,
                  background: column.color,
                }}
              />
              <div className="flex-1 min-w-0">
                <div
                  className="font-bold text-[13px]"
                  style={{
                    color: "#131b2e",
                    fontFamily: "var(--font-manrope, 'Manrope', sans-serif)",
                  }}
                >
                  {column.label}
                </div>
                {totalLabel && (
                  <div className="text-[11.5px] mt-px" style={{ color: "#444656" }}>
                    {totalLabel}
                  </div>
                )}
              </div>
              {/* Count bubble */}
              <div
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold"
                style={{
                  background: "rgba(19,27,46,0.08)",
                  color: "#444656",
                }}
              >
                {columnLeads.length}
              </div>
            </div>

            {/* Scrollable card area */}
            <div
              className="flex-1 overflow-y-auto"
              style={{
                padding: "0 0.5rem 0.5rem",
                scrollbarWidth: "thin",
                scrollbarColor: "#c4c5d9 transparent",
              }}
            >
              {columnLeads.length === 0 ? (
                <p
                  className="text-center py-8 text-[12px]"
                  style={{ color: "#444656" }}
                >
                  No leads
                </p>
              ) : (
                columnLeads.map((lead) => (
                  <PipelineCard
                    key={lead.id}
                    lead={lead}
                    accentColor={column.color}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
