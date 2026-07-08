import { RelatedList } from "@/components/slds/related-list";
import { LeadHistoryCard } from "@/components/leads/lead-history-card";

export type AsyncOpRow = {
  id: string;
  name: string;
  statement: string | null;
  exceptionMessage: string | null;
  logType: string | null;
};

export type FileRow = {
  id: string;
  name: string;
  type: string;
  createdAt: Date | string;
};

export type NoteRow = {
  id: string;
  title: string;
  body: string | null;
  createdAt: Date | string;
};

export type CampaignHistoryRow = {
  id: string;
  campaignName: string;
  status: string;
  responseDate: Date | string | null;
};

export type LeadHistoryRow = {
  id: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: { name: string } | null;
  changedAt: Date | string;
};

export type OpenActivityRow = {
  id: string;
  kind: "TASK" | "EVENT" | "CALL";
  subject: string;
  status: string | null;
  dueDate: Date | string | null;
  assignedTo: string | null;
};

export type ActivityHistoryRow = {
  id: string;
  kind: "TASK" | "EVENT" | "CALL" | "EMAIL" | "SMS";
  subject: string;
  outcome: string | null;
  completedAt: Date | string;
};

export function LeadRelated({
  asyncOps,
  files,
  notes,
  campaignHistory,
  leadHistory,
  openActivities = [],
  activityHistory = [],
}: {
  asyncOps: AsyncOpRow[];
  files: FileRow[];
  notes: NoteRow[];
  campaignHistory: CampaignHistoryRow[];
  leadHistory: LeadHistoryRow[];
  openActivities?: OpenActivityRow[];
  activityHistory?: ActivityHistoryRow[];
}) {
  return (
    <div>
      <RelatedList
        entity="Account"
        title="Open Activities"
        items={openActivities}
        emptyHint="No open activities"
        renderItem={(a) => (
          <div style={{ display: "grid", gridTemplateColumns: "80px 2fr 1fr 1fr 1fr", gap: 12 }}>
            <div style={{ color: "#747474" }}>{a.kind}</div>
            <div>{a.subject}</div>
            <div>{a.status ?? "-"}</div>
            <div>{a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "-"}</div>
            <div>{a.assignedTo ?? "-"}</div>
          </div>
        )}
      />

      <RelatedList
        entity="Account"
        title="Activity History"
        items={activityHistory}
        emptyHint="No past activities"
        renderItem={(h) => (
          <div style={{ display: "grid", gridTemplateColumns: "80px 2fr 1fr 1fr", gap: 12 }}>
            <div style={{ color: "#747474" }}>{h.kind}</div>
            <div>{h.subject}</div>
            <div>{h.outcome ?? "-"}</div>
            <div>{new Date(h.completedAt).toLocaleString()}</div>
          </div>
        )}
      />

      <RelatedList
        entity="Account"
        title="Async Operations"
        items={asyncOps}
        emptyHint="No async operations to show"
        renderItem={(o) => (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "#747474" }}>Application Log Name</div>
              <div>{o.name}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#747474" }}>Statement</div>
              <div>{o.statement ?? "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#747474" }}>Exception Message</div>
              <div>{o.exceptionMessage ?? "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#747474" }}>Log Type</div>
              <div>{o.logType ?? "—"}</div>
            </div>
          </div>
        )}
      />

      <RelatedList
        entity="Account"
        title="Files"
        items={files}
        emptyHint="No files attached"
        renderItem={(f) => (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{f.name}</span>
            <span style={{ color: "#747474" }}>{f.type}</span>
          </div>
        )}
      />

      <RelatedList
        entity="Account"
        title="Notes"
        items={notes}
        emptyHint="No notes"
        renderItem={(n) => (
          <div>
            <div style={{ fontWeight: 700 }}>{n.title}</div>
            {n.body && <div style={{ color: "#444444" }}>{n.body}</div>}
          </div>
        )}
      />

      <RelatedList
        entity="Campaign"
        title="Campaign History"
        items={campaignHistory}
        emptyHint="No campaign history"
        renderItem={(c) => (
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
            <div>{c.campaignName}</div>
            <div>{c.status}</div>
            <div>{c.responseDate ? new Date(c.responseDate).toLocaleDateString() : "—"}</div>
          </div>
        )}
      />

      <LeadHistoryCard
        rows={leadHistory.map((h) => ({
          id: h.id,
          field: h.field,
          oldValue: h.oldValue,
          newValue: h.newValue,
          changedBy: h.changedBy,
          changedAt: h.changedAt,
        }))}
        entityLabel="Lead History"
        emptyHint="No history yet"
      />
    </div>
  );
}
