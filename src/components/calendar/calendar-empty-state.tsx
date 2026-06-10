/**
 * Empty placeholder when no owners are selected. Tells the user to pick
 * someone from the toolbar so the grid does not appear broken.
 */
export function CalendarEmptyState() {
  return (
    <div style={wrap}>
      <div style={card}>
        <div style={title}>No users selected</div>
        <div style={body}>
          Pick a user from the toolbar to see their events. You can also use the
          Just mine, My team, or Everyone presets.
        </div>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 48,
  background: "#fff",
  border: "1px solid #ecebea",
  borderTop: 0,
  minHeight: 360,
};
const card: React.CSSProperties = {
  textAlign: "center",
  maxWidth: 420,
};
const title: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: "#080707",
  marginBottom: 6,
};
const body: React.CSSProperties = {
  fontSize: 13,
  color: "#706e6b",
  lineHeight: 1.5,
};
