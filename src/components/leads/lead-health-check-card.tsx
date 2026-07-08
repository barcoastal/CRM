/**
 * Lead Health Check rail card.
 * SF parity: HealthCheckerLead.cls (8 checks, runs only when Status is
 * "New" or "Working Lead"). Each check renders a row with a check/x and a
 * label matching the SF wording.
 */

export interface LeadHealthCheckInput {
  status: string;
  businessName: string | null;
  contactName: string | null;
  industry: string | null;
  totalDebtEst: number | null;
  source: string | null;
  leadSourceLabel: string | null;
  isPaymentAmountPopulated: boolean;
  hasCreditorInfo: boolean;
  callDispositionPopulated: boolean;
}

interface CheckRow {
  label: string;
  ok: boolean;
}

function buildChecks(i: LeadHealthCheckInput): CheckRow[] {
  return [
    { label: "Company Name is populated", ok: !!i.businessName?.trim() },
    {
      label: "First Name Or Last Name is Populated",
      ok: !!i.contactName?.trim() && i.contactName.trim() !== "Unknown",
    },
    { label: "Call Disposition is Populated", ok: i.callDispositionPopulated },
    { label: "Debt Details are Populated", ok: i.hasCreditorInfo },
    {
      label: "Minimum Total Debt requirement is met",
      ok: (i.totalDebtEst ?? 0) >= 30000,
    },
    { label: "Industry is populated", ok: !!i.industry?.trim() },
    { label: "Payment Amount Populated", ok: i.isPaymentAmountPopulated },
    {
      label: "Last Name should not be New Inbound",
      ok: !(i.contactName?.trim().toLowerCase().endsWith("new inbound") ?? false),
    },
    {
      label: "Lead Source is populated",
      ok: !!(i.leadSourceLabel?.trim() || i.source?.trim()),
    },
  ];
}

export function LeadHealthCheckCard(props: LeadHealthCheckInput) {
  // SF only runs the checker for New / Working Lead. For other states we
  // render nothing (card is suppressed).
  const active = props.status === "New" || props.status === "Working Lead";
  if (!active) return null;

  const checks = buildChecks(props);
  const failed = checks.filter((c) => !c.ok).length;

  return (
    <article
      style={{
        background: "#fff",
        border: "1px solid #c9c9c9",
        borderRadius: 4,
        padding: 12,
        marginBottom: 8,
      }}
    >
      <h3
        style={{
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 8,
          color: failed > 0 ? "#c23934" : "#04844b",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 16,
            height: 16,
            background: failed > 0 ? "#c23934" : "#04844b",
            color: "#fff",
            borderRadius: "50%",
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          {failed > 0 ? "!" : "✓"}
        </span>
        Health Check Results
      </h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {checks.map((c) => (
          <li
            key={c.label}
            style={{
              fontSize: 12,
              padding: "4px 0",
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: c.ok ? "#04844b" : "#c23934",
            }}
          >
            <span>{c.ok ? "✓" : "✕"}</span>
            <span>{c.label}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
