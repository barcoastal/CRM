/**
 * Total Payments Summary — right rail on the SF Opportunity detail.
 *
 * SF layout reference: docs/sf-screenshots/sf-opp-kenya.png — rail block titled
 * "Total Payments Summary" with the header "No Records Found" when empty. SF
 * surfaces the DS_Total_* roll-ups from Program_Plan__c → Opportunity (these
 * are summary fields rolling up Draft__c & Fee__c records).
 *
 * We compute these client-side from either:
 *   1. The active ProgramPlan's drafts/fees (preferred — matches SF rollups), or
 *   2. The latest saved Payment Calculator snapshot when the program hasn't
 *      been signed yet (so the rail isn't empty during Working Opportunity).
 *
 * Fields mirrored 1:1 with SF Total_Payments_Summary on opportunity detail:
 *   Program Length, Total Debt, Total Program Cost, Total Program Fee,
 *   Total Setup Fee, Total Bank Fee, Total Service Fee, Total Settlement,
 *   Total Weekly Payment.
 */

import { fmtMoney } from "@/lib/opp-formulas";

export interface TotalPaymentsSummaryProps {
  programLengthMonths: number | null;
  totalDebt: number;
  totalProgramCost: number | null;
  totalProgramFee: number | null;
  totalSetupFee: number | null;
  totalBankFee: number | null;
  totalServiceFee: number | null;
  totalSettlement: number | null;
  totalWeeklyPayment: number | null;
  /** When true and all rollups are null, render the SF "No Records Found" empty state. */
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
    [
      "Program Length",
      props.programLengthMonths ? `${props.programLengthMonths} mo` : null,
    ],
    ["Total Debt", `$${props.totalDebt.toLocaleString()}`],
    ["Total Program Cost", fmtMoney(props.totalProgramCost)],
    ["Total Program Fee", fmtMoney(props.totalProgramFee)],
    ["Total Setup Fee", fmtMoney(props.totalSetupFee)],
    ["Total Bank Fee", fmtMoney(props.totalBankFee)],
    ["Total Service Fee", fmtMoney(props.totalServiceFee)],
    ["Total Settlement", fmtMoney(props.totalSettlement)],
    ["Total Weekly Payment", fmtMoney(props.totalWeeklyPayment)],
  ];

  const allEmpty =
    props.empty &&
    props.totalProgramCost == null &&
    props.totalProgramFee == null &&
    props.totalSetupFee == null &&
    props.totalBankFee == null &&
    props.totalServiceFee == null &&
    props.totalSettlement == null;

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
        {allEmpty && (
          <span style={{ fontSize: 12, color: "#706e6b" }}>No Records Found</span>
        )}
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
