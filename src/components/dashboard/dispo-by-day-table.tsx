"use client";

export interface DispoRow {
  day: string;
  status: string;
  count: number;
  isSubtotal: boolean;
}

export function DispoByDayTable({
  title,
  rows,
  reportLink,
  asOf,
  statusLabel = "Lead Status",
  maxRows = 40,
}: {
  title: string;
  rows: DispoRow[];
  reportLink?: string;
  asOf?: string;
  statusLabel?: string;
  maxRows?: number;
}) {
  // Group rows by day so we can render a single Created Date cell per day
  // (matches the SF "Drilldown by row" layout).
  const groups = new Map<string, DispoRow[]>();
  for (const row of rows.slice(0, maxRows)) {
    if (!groups.has(row.day)) groups.set(row.day, []);
    groups.get(row.day)!.push(row);
  }

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #dddbda",
        borderRadius: 4,
        display: "flex",
        flexDirection: "column",
        minHeight: 360,
      }}
    >
      <header
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid #dddbda",
          background: "#fafaf9",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: "#080707" }}>
          {title}
        </div>
      </header>
      <div style={{ flex: 1, overflow: "auto", maxHeight: 340 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead style={{ position: "sticky", top: 0, background: "#fafaf9" }}>
            <tr>
              {["Created Date", statusLabel, "Record Count"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: h === "Record Count" ? "right" : "left",
                    padding: "6px 8px",
                    borderBottom: "1px solid #dddbda",
                    color: "#3e3e3c",
                    fontWeight: 600,
                    background: "#fafaf9",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from(groups.entries()).flatMap(([day, dayRows]) =>
              dayRows.map((row, idx) => (
                <tr
                  key={`${day}-${row.status}-${idx}`}
                  style={{
                    background: row.isSubtotal ? "#f3f3f3" : idx % 2 === 0 ? "#fff" : "#fafafa",
                    fontWeight: row.isSubtotal ? 600 : 400,
                  }}
                >
                  <td
                    style={{
                      padding: "5px 8px",
                      borderBottom: "1px solid #eaeaea",
                      color: idx === 0 ? "#080707" : "#706e6b",
                    }}
                  >
                    {idx === 0 ? day : ""}
                  </td>
                  <td
                    style={{
                      padding: "5px 8px",
                      borderBottom: "1px solid #eaeaea",
                      color: row.isSubtotal ? "#080707" : "#0070d2",
                    }}
                  >
                    {row.status}
                  </td>
                  <td
                    style={{
                      padding: "5px 8px",
                      borderBottom: "1px solid #eaeaea",
                      textAlign: "right",
                      color: "#080707",
                    }}
                  >
                    {row.count.toLocaleString()}
                  </td>
                </tr>
              )),
            )}
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  style={{ padding: 16, textAlign: "center", color: "#706e6b" }}
                >
                  No data in selected range
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <footer
        style={{
          borderTop: "1px solid #dddbda",
          padding: "6px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 11,
          color: "#706e6b",
          background: "#fafaf9",
        }}
      >
        {reportLink ? (
          <a
            href={reportLink}
            style={{ color: "#0070d2", textDecoration: "none", fontWeight: 600 }}
          >
            View Report ({title})
          </a>
        ) : (
          <span>View Report ({title})</span>
        )}
        <span>{asOf ?? ""}</span>
      </footer>
    </div>
  );
}
