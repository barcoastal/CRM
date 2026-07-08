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
        border: "1px solid #c9c9c9",
        borderRadius: 4,
        display: "flex",
        flexDirection: "column",
        minHeight: 360,
      }}
    >
      <header
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid #c9c9c9",
          background: "#fafaf9",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: "#181818" }}>
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
                    borderBottom: "1px solid #c9c9c9",
                    color: "#444444",
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
                      color: idx === 0 ? "#181818" : "#747474",
                    }}
                  >
                    {idx === 0 ? day : ""}
                  </td>
                  <td
                    style={{
                      padding: "5px 8px",
                      borderBottom: "1px solid #eaeaea",
                      color: row.isSubtotal ? "#181818" : "#0176d3",
                    }}
                  >
                    {row.status}
                  </td>
                  <td
                    style={{
                      padding: "5px 8px",
                      borderBottom: "1px solid #eaeaea",
                      textAlign: "right",
                      color: "#181818",
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
                  style={{ padding: 16, textAlign: "center", color: "#747474" }}
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
          borderTop: "1px solid #c9c9c9",
          padding: "6px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 11,
          color: "#747474",
          background: "#fafaf9",
        }}
      >
        {reportLink ? (
          <a
            href={reportLink}
            style={{ color: "#0176d3", textDecoration: "none", fontWeight: 600 }}
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
