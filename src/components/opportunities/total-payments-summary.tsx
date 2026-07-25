/**
 * Total Payments Summary — right-rail card on the Opportunity / Account detail,
 * mirroring the SF "Total Payments Summary" panel next to the Reschedule Program
 * calculator.
 *
 * Rendering matches the SF card exactly (per side-by-side screenshots):
 * UPPERCASE labels with an info icon, a vertical divider between the label and
 * value columns, zebra-striped rows, LEFT-aligned regular-weight values.
 *
 * Values are computed server-side from the deal's reschedule schedule (same math
 * as the Payment Calculator), so the rail matches SF's numbers to the cent for
 * the deal's real inputs.
 */

import { fmtMoney } from "@/lib/opp-formulas";

export interface TotalPaymentsSummaryProps {
  programLengthMonths: number | null;
  retainerPaymentCount: number | null;
  totalDebt: number;
  totalProgramCost: number | null;
  totalRetainerFee: number | null;
  totalProgramFee: number | null;
  totalSetupFee: number | null;
  totalProcessorFee: number | null;
  totalServiceFee: number | null;
  totalEscrowAmount: number | null;
  estimatedYouSave: number | null;
  totalWeeklyPayment: number | null;
  totalWeeklySaving: number | null;
  /** When true and the rollups are empty, render the SF "No Records Found" state. */
  empty?: boolean;
}

function InfoIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      aria-hidden="true"
      // display:inline defeats Tailwind preflight's `svg { display: block }`,
      // which otherwise wraps the icon onto its own line below the label.
      style={{ display: "inline", marginLeft: 5, flexShrink: 0, verticalAlign: "-2px" }}
    >
      <circle cx="8" cy="8" r="7.25" fill="#747474" />
      <rect x="7" y="6.8" width="2" height="5.2" rx="0.6" fill="#fff" />
      <circle cx="8" cy="4.6" r="1.1" fill="#fff" />
    </svg>
  );
}

export function TotalPaymentsSummary(props: TotalPaymentsSummaryProps) {
  // SF card labels, verbatim (first row is "PROGRAM LENGTH", not "Total ...").
  const rows: [string, string | null][] = [
    ["Program Length", props.programLengthMonths != null ? String(props.programLengthMonths) : null],
    ["Total Retainer Payment Count", props.retainerPaymentCount != null ? String(props.retainerPaymentCount) : null],
    ["Total Debt", `$${props.totalDebt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
    ["Total Program Cost", fmtMoney(props.totalProgramCost)],
    ["Total Retainer Fee", fmtMoney(props.totalRetainerFee)],
    ["Total Program Fee", fmtMoney(props.totalProgramFee)],
    ["Total Setup Fee", fmtMoney(props.totalSetupFee)],
    ["Total Processor Fee", fmtMoney(props.totalProcessorFee)],
    ["Total Service Fee", fmtMoney(props.totalServiceFee)],
    ["Total Escrow Amount", fmtMoney(props.totalEscrowAmount)],
    ["Estimated Amount You Save", fmtMoney(props.estimatedYouSave)],
    ["Total Weekly Payment", fmtMoney(props.totalWeeklyPayment)],
    ["Total Weekly Saving", fmtMoney(props.totalWeeklySaving)],
  ];

  // `empty` is authoritative: SF shows "No Records Found" until payment
  // records exist, even though we could compute defaults.
  const allEmpty = !!props.empty;

  return (
    <article
      style={{
        background: "#fff",
        border: "1px solid #c9c9c9",
        borderRadius: 4,
        marginBottom: 8,
        overflow: "hidden",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          borderBottom: allEmpty ? "none" : "1px solid #c9c9c9",
        }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#181818", margin: 0 }}>
          Total Payments Summary
        </h3>
      </header>
      {allEmpty && (
        <div style={{ padding: "20px 12px", textAlign: "center", fontSize: 13, color: "#444444" }}>
          No Records Found
        </div>
      )}
      {!allEmpty && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <tbody>
            {rows.map(([label, value], i) => (
              <tr
                key={label}
                style={{
                  // SF zebra striping: first row shaded, then alternating.
                  background: i % 2 === 0 ? "#f3f3f3" : "#fff",
                }}
              >
                <td
                  style={{
                    padding: "8px 12px",
                    color: "#444444",
                    fontSize: 11.5,
                    textTransform: "uppercase",
                    letterSpacing: 0.2,
                    // SF vertical divider between the label and value columns.
                    borderRight: "1px solid #c9c9c9",
                    width: "60%",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {label}
                  <InfoIcon />
                </td>
                <td
                  style={{
                    padding: "8px 12px",
                    color: "#181818",
                    fontSize: 13,
                    fontWeight: 400,
                    textAlign: "left",
                  }}
                >
                  {value ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
