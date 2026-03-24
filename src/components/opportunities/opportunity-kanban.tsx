"use client";

import { useRouter } from "next/navigation";

interface Opportunity {
  id: string;
  stage: string;
  totalDebt: number | null;
  expectedCloseDate: string | null;
  createdAt: string;
  lead: {
    id: string;
    businessName: string;
    contactName: string;
    phone: string;
    email: string | null;
    totalDebtEst: number | null;
  };
  assignedTo: { id: string; name: string; email: string } | null;
}

interface OpportunityKanbanProps {
  opportunities: Opportunity[];
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "--";
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${Math.round(value / 1_000)}K`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyFull(value: number | null): string {
  if (value === null || value === undefined) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDaysInStage(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const STAGE_ACCENT_COLORS: Record<string, string> = {
  WORKING_OPPORTUNITY: "#6366f1",
  WAITING_FOR_AGREEMENTS: "#3052ff",
  READY_TO_CLOSE: "#f59e0b",
  CONTRACT_SENT: "#10b981",
  CONTRACT_SIGNED: "#059669",
  CLOSED_WON_FIRST_PAYMENT: "#059669",
  ARCHIVED: "#6b7280",
  CLOSED: "#ef4444",
};

const AVATAR_COLORS = [
  "#6366f1",
  "#3052ff",
  "#8b5cf6",
  "#ec4899",
  "#10b981",
  "#f59e0b",
  "#059669",
  "#ef4444",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// Map actual DB stages to the 6 kanban columns
const KANBAN_COLUMNS = [
  {
    key: "qualification",
    label: "Qualification",
    stages: ["WORKING_OPPORTUNITY"],
    accent: "#6366f1",
  },
  {
    key: "proposal",
    label: "Proposal",
    stages: ["WAITING_FOR_AGREEMENTS"],
    accent: "#3052ff",
  },
  {
    key: "negotiation",
    label: "Negotiation",
    stages: ["READY_TO_CLOSE"],
    accent: "#f59e0b",
  },
  {
    key: "closing",
    label: "Closing",
    stages: ["CONTRACT_SENT", "CONTRACT_SIGNED"],
    accent: "#10b981",
  },
  {
    key: "won",
    label: "Won",
    stages: ["CLOSED_WON_FIRST_PAYMENT"],
    accent: "#059669",
  },
  {
    key: "lost",
    label: "Lost",
    stages: ["ARCHIVED", "CLOSED"],
    accent: "#ef4444",
  },
];

export function OpportunityKanban({ opportunities }: OpportunityKanbanProps) {
  const router = useRouter();

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[600px]">
      {KANBAN_COLUMNS.map((col) => {
        const colOpps = opportunities.filter((opp) => col.stages.includes(opp.stage));
        const colTotal = colOpps.reduce((sum, opp) => {
          const debt = opp.totalDebt ?? opp.lead.totalDebtEst ?? 0;
          return sum + debt;
        }, 0);

        return (
          <div key={col.key} className="min-w-[260px] flex-1 flex flex-col">
            {/* Column Header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: col.accent }}
                />
                <span className="text-[13px] font-bold text-[#131b2e]">{col.label}</span>
                <span
                  className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: "#eaedff", color: "#444656" }}
                >
                  {colOpps.length}
                </span>
              </div>
              {colTotal > 0 && (
                <span className="text-[12px] text-[#444656] font-medium">
                  {formatCurrency(colTotal)}
                </span>
              )}
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2.5 flex-1">
              {colOpps.length === 0 ? (
                <div
                  className="rounded-xl flex-1 min-h-[120px] flex items-center justify-center"
                  style={{
                    background: "#f2f3ff",
                    border: "1.5px dashed #c4c5d9",
                  }}
                >
                  <span className="text-[12px] text-[#444656]">No opportunities</span>
                </div>
              ) : (
                colOpps.map((opp) => {
                  const debt = opp.totalDebt ?? opp.lead.totalDebtEst;
                  const days = getDaysInStage(opp.createdAt);
                  const assigneeName = opp.assignedTo?.name ?? "";
                  const avatarColor = assigneeName
                    ? getAvatarColor(assigneeName)
                    : "#3052ff";
                  const initials = assigneeName ? getInitials(assigneeName) : "?";
                  const accentColor =
                    STAGE_ACCENT_COLORS[opp.stage] || col.accent;

                  return (
                    <div
                      key={opp.id}
                      onClick={() => router.push(`/opportunities/${opp.id}`)}
                      className="relative rounded-xl cursor-pointer transition-all duration-150"
                      style={{
                        background: "#ffffff",
                        boxShadow: "0 12px 40px rgba(19,27,46,0.06)",
                        paddingLeft: "1rem",
                        paddingRight: "1rem",
                        paddingTop: "0.85rem",
                        paddingBottom: "0.85rem",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLDivElement).style.boxShadow =
                          "0 16px 48px rgba(19,27,46,0.1)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLDivElement).style.boxShadow =
                          "0 12px 40px rgba(19,27,46,0.06)";
                      }}
                    >
                      {/* Left color accent */}
                      <div
                        className="absolute left-0 rounded-l-xl"
                        style={{
                          top: "8px",
                          bottom: "8px",
                          width: "3px",
                          borderRadius: "0 2px 2px 0",
                          background: accentColor,
                        }}
                      />

                      {/* Business name */}
                      <p
                        className="text-[13.5px] font-bold mb-1 truncate"
                        style={{ color: "#131b2e", fontFamily: "Manrope, sans-serif" }}
                      >
                        {opp.lead.businessName}
                      </p>

                      {/* Total debt */}
                      <p
                        className="text-[15px] font-semibold mb-2.5"
                        style={{ color: "#131b2e" }}
                      >
                        {formatCurrencyFull(debt)}
                      </p>

                      {/* Footer */}
                      <div className="flex items-center justify-between">
                        {/* Negotiator avatar */}
                        {assigneeName ? (
                          <div
                            className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-white flex-shrink-0"
                            style={{
                              background: avatarColor,
                              fontSize: "10px",
                              fontWeight: 700,
                            }}
                            title={assigneeName}
                          >
                            {initials}
                          </div>
                        ) : (
                          <div
                            className="w-[26px] h-[26px] rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: "#eaedff", fontSize: "10px" }}
                          >
                            ?
                          </div>
                        )}

                        {/* Date + days badge */}
                        <div className="flex items-center gap-1.5">
                          {opp.expectedCloseDate && (
                            <span
                              className="text-[11px]"
                              style={{ color: "#444656" }}
                            >
                              {formatDate(opp.expectedCloseDate)}
                            </span>
                          )}
                          <span
                            className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                            style={{ background: "#eaedff", color: "#444656" }}
                          >
                            {col.key === "won"
                              ? "Won"
                              : col.key === "lost"
                                ? "Lost"
                                : `${days}d`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
