import { Section } from "@/components/slds/section";

/**
 * "Client Submitted Info" box: what the client sent back through a Request
 * Info link. Shown on the Opportunity, Account and Contact record pages.
 * Values come from DocumentRequest.collectedJson (SSN masked, bank last 4).
 */

export interface SubmittedInfoRequest {
  id: string;
  recipientName: string | null;
  recipientEmail: string;
  completedAt: Date | null;
  collectedJson: unknown;
}

interface Collected {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
  notes?: string;
  ssn?: string;
  ein?: string;
  dob?: string;
  bank?: { name?: string; accountType?: string; routing?: string; accountLast4?: string };
  debts?: Array<{ lender: string; amount: number }>;
}

function fmtDate(d: Date | null): string {
  if (!d) return "";
  return `${d.toLocaleDateString("en-US", { timeZone: "America/New_York" })}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })}`;
}

export function ClientSubmittedInfoCard({ requests }: { requests: SubmittedInfoRequest[] }) {
  const completed = requests.filter((r) => r.collectedJson && r.completedAt);
  if (completed.length === 0) return null;
  const latest = completed[0];
  const c = (latest.collectedJson ?? {}) as Collected;

  const addr = [c.street, c.city, c.state, c.zip].filter(Boolean).join(", ");
  const bank = c.bank
    ? [
        c.bank.name,
        c.bank.accountType,
        c.bank.routing && `routing ${c.bank.routing}`,
        c.bank.accountLast4 && `account ...${c.bank.accountLast4}`,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  const rows: Array<[string, React.ReactNode]> = [];
  rows.push([
    "Submitted",
    `${fmtDate(latest.completedAt)}${latest.recipientName ? ` by ${latest.recipientName}` : ""}`,
  ]);
  if (addr) rows.push(["Address", addr]);
  if (c.phone) rows.push(["Phone", c.phone]);
  if (c.email) rows.push(["Email", c.email]);
  if (c.ssn) rows.push(["SSN", c.ssn]);
  if (c.ein) rows.push(["EIN / TIN", c.ein]);
  if (c.dob) rows.push(["Date of birth", c.dob]);
  if (bank) rows.push(["Bank details", bank]);
  if (c.debts?.length) {
    rows.push([
      `Debts (${c.debts.length})`,
      <span key="debts" style={{ whiteSpace: "pre-wrap" }}>
        {c.debts.map((d) => `${d.lender} - $${Number(d.amount).toLocaleString()}`).join("\n")}
      </span>,
    ]);
  }
  if (c.notes) rows.push(["Client note", <span key="n" style={{ whiteSpace: "pre-wrap" }}>{c.notes}</span>]);

  return (
    <Section title="Client Submitted Info">
      <div>
        {rows.map(([label, value]) => (
          <div
            key={label}
            style={{
              display: "grid",
              gridTemplateColumns: "180px 1fr",
              gap: 12,
              padding: "5px 0",
              borderBottom: "1px solid #f3f3f3",
              fontSize: 13,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "#181818" }}>{label}</div>
            <div style={{ color: "#181818" }}>{value}</div>
          </div>
        ))}
        {completed.length > 1 && (
          <div style={{ paddingTop: 8, fontSize: 12, color: "#747474" }}>
            {completed.length - 1} earlier submission{completed.length > 2 ? "s" : ""} on file.
          </div>
        )}
      </div>
    </Section>
  );
}
