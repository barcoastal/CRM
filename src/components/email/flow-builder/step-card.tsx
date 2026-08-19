"use client";

import type { FlowTreeNode } from "@/lib/flow/flow-tree";

export interface StepStats {
  emails: Record<string, { sent: number; delivered: number; opened: number; clicked: number; openRate: number; clickRate: number }>;
  waiting: Record<string, number>;
}

const ICONS: Record<string, string> = {
  send_email: "M4 6h16v12H4z M4 7l8 6 8-6",
  wait: "M12 8v4l3 2 M12 3a9 9 0 1 0 0.01 0z",
  update_record: "M4 6h16 M4 12h16 M4 18h10",
  create_task: "M9 11l3 3l8-8 M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9",
  decision: "M12 3l9 9-9 9-9-9z",
};

function summary(n: FlowTreeNode): string {
  const c = n.config as Record<string, unknown>;
  switch (n.kind) {
    case "send_email": return (c.templateId ? "Template email" : (c.subject as string)) || "No content yet";
    case "wait": {
      const s = Number(c.waitSeconds ?? 0);
      if (c.until) return `Until ${c.until}`;
      if (s % 86400 === 0 && s > 0) return `Wait ${s / 86400} day(s)`;
      if (s % 3600 === 0 && s > 0) return `Wait ${s / 3600} hour(s)`;
      return s > 0 ? `Wait ${s}s` : "No delay set";
    }
    case "update_record": return `${(c.updates as unknown[])?.length ?? 0} field update(s)`;
    case "create_task": return (c.subject as string) || "Follow up task";
    case "decision": return "Yes / No branch";
    default: return "";
  }
}

function StatLine({ node, stats }: { node: FlowTreeNode; stats: StepStats | null }) {
  if (!stats) return null;
  if (node.kind === "send_email") {
    const e = stats.emails[node.id];
    if (!e || e.sent === 0) return <span className="ec-fb-card-stats ec-fb-card-stats-muted">No sends yet</span>;
    return (
      <span className="ec-fb-card-stats">
        <b>{e.sent}</b> sent<span className="ec-fb-stat-dot">·</span>
        <b>{e.openRate}%</b> open<span className="ec-fb-stat-dot">·</span>
        <b>{e.clickRate}%</b> click
      </span>
    );
  }
  if (node.kind === "wait") {
    const w = stats.waiting[node.id] ?? 0;
    return (
      <span className="ec-fb-card-stats">
        <b>{w}</b> {w === 1 ? "person" : "people"} waiting
      </span>
    );
  }
  return null;
}

export function StepCard({ node, selected, stats, onClick }: { node: FlowTreeNode; selected: boolean; stats: StepStats | null; onClick: () => void }) {
  return (
    <button className={`ec-fb-card${selected ? " ec-fb-card-sel" : ""}`} onClick={onClick}>
      <span className="ec-fb-card-icon">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d={ICONS[node.kind] ?? "M4 6h16v12H4z"} />
        </svg>
      </span>
      <span className="ec-fb-card-main">
        <span className="ec-fb-card-title">{node.label}</span>
        <span className="ec-fb-card-sum">{summary(node)}</span>
        <StatLine node={node} stats={stats} />
      </span>
    </button>
  );
}
