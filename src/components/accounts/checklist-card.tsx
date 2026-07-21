/**
 * SF-parity "Checklist" rail card: the stage checklist tasks for the account
 * (SF Task record type Checklist_Item), with the "N of M tasks completed"
 * footer exactly like the org's widget.
 */
export interface ChecklistItem {
  id: string;
  subject: string;
  dueDate: string | null;
  assignedTo: string | null;
  done: boolean;
}

export function ChecklistCard({ stage, items }: { stage: string; items: ChecklistItem[] }) {
  if (items.length === 0) return null;
  const doneCount = items.filter((i) => i.done).length;
  return (
    <article
      style={{
        background: "#fff",
        border: "1px solid #c9c9c9",
        borderRadius: 4,
        marginBottom: 12,
        overflow: "hidden",
        boxShadow: "0 2px 2px 0 rgba(0,0,0,.05)",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid #e5e5e5" }}>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 4, background: "#0b827c" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="#fff" strokeWidth="2" fill="none" /></svg>
        </span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#181818" }}>Checklist - {stage}</div>
        </div>
      </header>
      <div style={{ maxHeight: 260, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#fafaf9", borderBottom: "1px solid #e5e5e5" }}>
              {["", "Task", "Due Date", "Assigned"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontSize: 10, fontWeight: 700, color: "#444444", textTransform: "uppercase", letterSpacing: 0.4 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                <td style={{ padding: "6px 10px", width: 22 }}>
                  {i.done ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2e844a" strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg>
                  ) : (
                    <span style={{ display: "inline-block", width: 12, height: 12, border: "1.5px solid #c9c9c9", borderRadius: 3 }} />
                  )}
                </td>
                <td style={{ padding: "6px 10px", color: i.done ? "#747474" : "#181818" }}>{i.subject}</td>
                <td style={{ padding: "6px 10px", color: "#444444", whiteSpace: "nowrap" }}>{i.dueDate ?? "-"}</td>
                <td style={{ padding: "6px 10px", color: "#444444", whiteSpace: "nowrap" }}>{i.assignedTo ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer style={{ padding: "8px 14px", borderTop: "1px solid #e5e5e5", fontSize: 12, color: "#444444", textAlign: "center" }}>
        {doneCount} of {items.length} tasks are completed.
      </footer>
    </article>
  );
}
