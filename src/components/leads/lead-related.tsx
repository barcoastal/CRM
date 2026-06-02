import { RelatedList } from "@/components/slds/related-list";

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

export function LeadRelated({
  asyncOps,
  files,
  notes,
  campaignHistory,
  leadHistory,
}: {
  asyncOps: AsyncOpRow[];
  files: FileRow[];
  notes: NoteRow[];
  campaignHistory: CampaignHistoryRow[];
  leadHistory: LeadHistoryRow[];
}) {
  return (
    <div>
      <RelatedList
        entity="Account"
        title="Async Operations"
        items={asyncOps}
        emptyHint="No async operations to show"
        renderItem={(o) => (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "#706e6b" }}>Application Log Name</div>
              <div>{o.name}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#706e6b" }}>Statement</div>
              <div>{o.statement ?? "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#706e6b" }}>Exception Message</div>
              <div>{o.exceptionMessage ?? "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#706e6b" }}>Log Type</div>
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
            <span style={{ color: "#706e6b" }}>{f.type}</span>
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
            {n.body && <div style={{ color: "#3e3e3c" }}>{n.body}</div>}
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

      <RelatedList
        entity="Account"
        title="Lead History"
        items={leadHistory}
        emptyHint="No history yet"
        renderItem={(h) => (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 12 }}>
            <div>{new Date(h.changedAt).toLocaleString()}</div>
            <div>{h.field}</div>
            <div>{h.changedBy?.name ?? "System"}</div>
            <div style={{ color: "#706e6b" }}>{h.oldValue ?? "—"}</div>
            <div>{h.newValue ?? "—"}</div>
          </div>
        )}
      />
    </div>
  );
}
