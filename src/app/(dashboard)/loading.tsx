/**
 * SLDS-style loading stencil shown instantly on route navigation while the
 * server component fetches. Mirrors SF's gray-bar skeleton on list views.
 */
export default function DashboardLoading() {
  const bar = (w: string | number, h = 12): React.CSSProperties => ({
    width: w,
    height: h,
    background: "#ecebea",
    borderRadius: 4,
  });
  return (
    <div style={{ padding: 12 }} aria-busy="true" aria-label="Loading">
      <div
        style={{
          background: "#fff",
          border: "1px solid #c9c9c9",
          borderRadius: 4,
          padding: "12px 16px",
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ ...bar(32, 32), borderRadius: 4 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={bar(90, 10)} />
            <div style={bar(180, 14)} />
          </div>
        </div>
      </div>
      <div
        style={{
          background: "#fff",
          border: "1px solid #c9c9c9",
          borderRadius: 4,
          padding: 16,
        }}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 16,
              padding: "9px 0",
              borderBottom: i === 11 ? "none" : "1px solid #f3f3f3",
            }}
          >
            <div style={bar("22%")} />
            <div style={bar("14%")} />
            <div style={bar("18%")} />
            <div style={bar("12%")} />
            <div style={bar("16%")} />
            <div style={bar("10%")} />
          </div>
        ))}
      </div>
    </div>
  );
}
