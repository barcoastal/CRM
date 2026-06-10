import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

const ENTITIES = [
  { type: "Lead", description: "Prospect leads captured from marketing, lists, or referrals." },
  { type: "Opportunity", description: "Active deals in the pipeline." },
  { type: "Account", description: "Client and creditor accounts." },
  { type: "Case", description: "Support cases, escalations, account requests." },
  { type: "Task", description: "Activities, follow-ups, dispositions." },
  { type: "Event", description: "Calendar events, meetings, scheduled calls." },
];

export default async function NewValidationRulePickerPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <header style={pageHeader}>
        <div>
          <h1 style={pageTitle}>New Validation Rule</h1>
          <p style={pageSubtitle}>
            Pick the entity this rule should apply to. The builder will let
            you define a condition and an error message that fires when the
            rule matches a record being saved.
          </p>
        </div>
      </header>

      <div style={cardGrid}>
        {ENTITIES.map((e) => (
          <Link
            key={e.type}
            href={`/settings/validation-rules/builder?entityType=${e.type}`}
            style={card}
          >
            <div style={cardTitle}>{e.type}</div>
            <div style={cardDesc}>{e.description}</div>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        <Link href="/settings/validation-rules" style={cancelLink}>
          Back to all rules
        </Link>
      </div>
    </div>
  );
}

const pageHeader: React.CSSProperties = {
  background: "#fff",
  padding: "16px 24px",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  marginBottom: 16,
};
const pageTitle: React.CSSProperties = {
  fontFamily: "Manrope, system-ui, sans-serif",
  fontSize: 22,
  fontWeight: 700,
  margin: 0,
  color: "#0a0a0a",
};
const pageSubtitle: React.CSSProperties = {
  fontFamily: "Manrope, system-ui, sans-serif",
  fontSize: 13,
  color: "#54595e",
  marginTop: 6,
  marginBottom: 0,
  maxWidth: 760,
};
const cardGrid: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
};
const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: 16,
  textDecoration: "none",
  color: "#0a0a0a",
  fontFamily: "Manrope, system-ui, sans-serif",
  display: "block",
};
const cardTitle: React.CSSProperties = { fontSize: 14, fontWeight: 700, marginBottom: 4 };
const cardDesc: React.CSSProperties = { fontSize: 12, color: "#54595e" };
const cancelLink: React.CSSProperties = {
  color: "#3052ff",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "Manrope, system-ui, sans-serif",
};
