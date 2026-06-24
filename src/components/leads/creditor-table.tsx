/**
 * SF-style creditor table for the Lead "Debt Information" tab.
 *
 * Salesforce renders the per-creditor data (Creditor_1..10 fields) as a table
 * with Total Debt + Total Weekly Payment, not as a flat field dump. This
 * mirrors that: one row per non-empty creditor, totals summed from the rows.
 * Read-only (the data lives in sfDataJson from the migration).
 */
export type CreditorRow = {
  name: string;
  debt: number | null;
  payment: number | null;
  frequency: string | null;
};

function money(n: number | null): string {
  if (n == null) return "—";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CreditorTable({ rows }: { rows: CreditorRow[] }) {
  if (rows.length === 0) {
    return <div className="text-[13px] text-[#706e6b]">No creditors on this lead.</div>;
  }

  const totalDebt = rows.reduce((s, r) => s + (r.debt ?? 0), 0);
  const totalPayment = rows.reduce((s, r) => s + (r.payment ?? 0), 0);

  return (
    <div>
      <div className="flex flex-wrap gap-6 mb-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.4px] text-[#706e6b]">Total Debt</div>
          <div className="text-[15px] font-bold text-[#131b2e]">{money(totalDebt)}</div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.4px] text-[#706e6b]">Total Weekly Payment</div>
          <div className="text-[15px] font-bold text-[#131b2e]">{money(totalPayment)}</div>
        </div>
      </div>

      <table className="w-full border-collapse border border-[#d8dde6]">
        <thead>
          <tr className="bg-[#fafaf9] border-b border-[#d8dde6]">
            {["Creditor", "Debt Amount", "Payment", "Frequency"].map((h) => (
              <th
                key={h}
                className="text-left px-3 py-2 text-[11px] font-bold uppercase tracking-[0.3px] text-[#3e3e3c]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-[#f3f3f3]">
              <td className="px-3 py-2 text-[13px] text-[#080707]">{r.name}</td>
              <td className="px-3 py-2 text-[13px] text-[#080707]">{money(r.debt)}</td>
              <td className="px-3 py-2 text-[13px] text-[#080707]">{money(r.payment)}</td>
              <td className="px-3 py-2 text-[13px] text-[#080707]">{r.frequency || "—"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-[#fafaf9] border-t border-[#d8dde6]">
            <td className="px-3 py-2 text-[13px] font-bold text-[#131b2e]">Total</td>
            <td className="px-3 py-2 text-[13px] font-bold text-[#131b2e]">{money(totalDebt)}</td>
            <td className="px-3 py-2 text-[13px] font-bold text-[#131b2e]">{money(totalPayment)}</td>
            <td className="px-3 py-2" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
