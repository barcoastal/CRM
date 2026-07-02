/**
 * Total Payments Summary — right-rail card on the Opportunity / Account detail,
 * mirroring the SF "Total Payments Summary" panel next to the Reschedule Program
 * calculator.
 *
 * Values are computed server-side from the deal's reschedule schedule (same math
 * as the Payment Calculator), so the rail matches SF's numbers to the cent for
 * the deal's real inputs. Fields (in SF order):
 *   Total Program Length, Total Retainer Payment Count, Total Debt,
 *   Total Program Cost, Total Retainer Fee, Total Program Fee, Total Setup Fee,
 *   Total Processor Fee, Total Service Fee, Total Escrow Amount,
 *   Estimated Amount You Save, Total Weekly Payment, Total Weekly Saving.
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

const labelCellStyle: React.CSSProperties = {
  padding: "6px 0",
  color: "#706e6b",
  fontSize: 12,
};
const valueCellStyle: React.CSSProperties = {
  padding: "6px 0",
  textAlign: "right",
  fontWeight: 600,
  fontSize: 12,
};

export function TotalPaymentsSummary(props: TotalPaymentsSummaryProps) {
  const rows: [string, string | null][] = [
    ["Total Program Length", props.programLengthMonths != null ? String(props.programLengthMonths) : null],
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

  const allEmpty =
    props.empty &&
    props.totalProgramCost == null &&
    props.totalProgramFee == null &&
    props.totalWeeklyPayment == null;

  return (
    <article
      style={{
        background: "#fff",
        border: "1px solid #d8dde6",
        borderRadius: 4,
        marginBottom: 8,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          borderBottom: allEmpty ? "none" : "1px solid #ecebea",
        }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#080707", margin: 0 }}>
          Total Payments Summary
        </h3>
        {allEmpty && <span style={{ fontSize: 12, color: "#706e6b" }}>No Records Found</span>}
      </header>
      {!allEmpty && (
        <table style={{ width: "100%", fontSize: 12, padding: "0 12px 8px" }}>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} style={{ borderBottom: "1px solid #f3f3f3" }}>
                <td style={labelCellStyle}>{label}</td>
                <td style={valueCellStyle}>{value ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
