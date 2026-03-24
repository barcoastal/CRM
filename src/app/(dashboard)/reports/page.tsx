import { prisma } from "@/lib/prisma";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Debt portfolio status breakdown (derived from allDebts)
function computePortfolioBreakdown(
  allDebts: { enrolledBalance: number; status: string }[]
) {
  const totals: Record<string, number> = {
    ACTIVE: 0,
    SETTLED: 0,
    IN_NEGOTIATION: 0,
    DEFAULT: 0,
  };
  for (const d of allDebts) {
    if (d.status === "SETTLED") totals.SETTLED += d.enrolledBalance;
    else if (d.status === "DEFAULT") totals.DEFAULT += d.enrolledBalance;
    else if (d.status === "IN_NEGOTIATION") totals.IN_NEGOTIATION += d.enrolledBalance;
    else totals.ACTIVE += d.enrolledBalance;
  }
  const grand = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
  return {
    active: { amount: totals.ACTIVE, pct: Math.round((totals.ACTIVE / grand) * 100) },
    settled: { amount: totals.SETTLED, pct: Math.round((totals.SETTLED / grand) * 100) },
    negotiation: { amount: totals.IN_NEGOTIATION, pct: Math.round((totals.IN_NEGOTIATION / grand) * 100) },
    default: { amount: totals.DEFAULT, pct: Math.round((totals.DEFAULT / grand) * 100) },
    grand,
  };
}

export default async function ReportsPage() {
  const [clients, settledDebts, allDebts, missedPayments] = await Promise.all([
    prisma.client.findMany({
      include: {
        lead: { select: { businessName: true, contactName: true } },
        assignedNegotiator: { select: { name: true } },
      },
    }),
    prisma.debt.findMany({
      where: { status: "SETTLED" },
      select: { settledAmount: true, enrolledBalance: true, savingsPercent: true },
    }),
    prisma.debt.findMany({
      select: { enrolledBalance: true, status: true },
    }),
    prisma.payment.count({ where: { status: "MISSED" } }),
  ]);

  const activeClients = clients.filter((c) => c.status === "ACTIVE").length;
  const totalSettledAmount = settledDebts.reduce(
    (sum, d) => sum + (d.settledAmount ?? 0),
    0
  );
  const totalEnrolledInSettled = settledDebts.reduce(
    (sum, d) => sum + d.enrolledBalance,
    0
  );
  const avgSavingsPercent =
    settledDebts.length > 0
      ? settledDebts.reduce((sum, d) => sum + (d.savingsPercent ?? 0), 0) /
        settledDebts.length
      : 0;
  const atRiskClients = clients.filter(
    (c) => c.status === "DROPPED" || c.status === "ON_HOLD"
  ).length;

  const portfolio = computePortfolioBreakdown(allDebts);

  // Mock data for charts / agent performance (not yet in DB)
  const monthlyBars = [
    { label: "Oct", val: "$210K", heightPct: 50 },
    { label: "Nov", val: "$180K", heightPct: 43 },
    { label: "Dec", val: "$340K", heightPct: 81 },
    { label: "Jan", val: "$420K", heightPct: 100 },
    { label: "Feb", val: "$380K", heightPct: 90 },
    { label: "Mar", val: "$390K", heightPct: 93 },
  ];

  const funnelSteps = [
    { label: "New", count: 1247, widthPct: 100, color: "linear-gradient(135deg,#0034e4,#3052ff)", pct: "" },
    { label: "Contacted", count: 834, widthPct: 67, color: "#3052ff", pct: "66.9%" },
    { label: "Qualified", count: 412, widthPct: 33, color: "#5570ff", pct: "49.4%" },
    { label: "Proposal", count: 156, widthPct: 12.5, color: "#7a8fff", pct: "37.9%" },
    { label: "Enrolled", count: 89, widthPct: 7.1, color: "#a0adff", pct: "57.1%" },
  ];

  const agentRows = [
    { name: "Sarah Mitchell", calls: 342, converted: 28, revenue: "$412,000", rate: "8.2%", tier: "high" },
    { name: "James Rodriguez", calls: 298, converted: 24, revenue: "$386,000", rate: "8.1%", tier: "high" },
    { name: "Emily Chen", calls: 276, converted: 19, revenue: "$324,000", rate: "6.9%", tier: "high" },
    { name: "Marcus Johnson", calls: 312, converted: 21, revenue: "$298,000", rate: "6.7%", tier: "med" },
    { name: "Lisa Park", calls: 254, converted: 16, revenue: "$267,000", rate: "6.3%", tier: "med" },
    { name: "David Thompson", calls: 289, converted: 15, revenue: "$234,000", rate: "5.2%", tier: "med" },
    { name: "Rachel Adams", calls: 198, converted: 9, revenue: "$178,000", rate: "4.5%", tier: "low" },
    { name: "Kevin Wright", calls: 167, converted: 7, revenue: "$142,000", rate: "4.2%", tier: "low" },
  ];

  const rateBadgeClass: Record<string, string> = {
    high: "bg-[rgba(26,125,55,0.1)] text-[#1a7d37]",
    med: "bg-[rgba(180,140,0,0.1)] text-[#8a6d00]",
    low: "bg-[rgba(148,43,0,0.1)] text-[#942b00]",
  };

  return (
    <div className="space-y-7">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <h1
          className="text-[24px] font-bold tracking-tight text-[#131b2e]"
          style={{ fontFamily: "var(--font-sans, Manrope, sans-serif)" }}
        >
          Reports
        </h1>
        <div className="flex items-center gap-2 bg-[#f2f3ff] px-4 py-2 rounded-[0.25rem] text-[13px] font-medium text-[#444656] cursor-pointer select-none shadow-coastal">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          Last 30 Days
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Active Clients */}
        <div className="bg-white rounded-xl px-6 py-5 shadow-coastal relative overflow-hidden">
          <div
            className="absolute left-0 top-0 bottom-0 w-[3px]"
            style={{ background: "#3052FF" }}
          />
          <div className="text-[11px] font-semibold text-[#444656] uppercase tracking-[0.5px] mb-2">
            Active Clients
          </div>
          <div
            className="text-[28px] font-extrabold text-[#131b2e] leading-none"
            style={{ fontFamily: "var(--font-sans, Manrope, sans-serif)" }}
          >
            {activeClients}
          </div>
          <div className="text-[12px] text-[#444656] mt-1">
            {clients.length} total enrolled
          </div>
        </div>

        {/* Total Settled */}
        <div className="bg-white rounded-xl px-6 py-5 shadow-coastal relative overflow-hidden">
          <div
            className="absolute left-0 top-0 bottom-0 w-[3px]"
            style={{ background: "#3052FF" }}
          />
          <div className="text-[11px] font-semibold text-[#444656] uppercase tracking-[0.5px] mb-2">
            Total Settled
          </div>
          <div
            className="text-[28px] font-extrabold text-[#131b2e] leading-none"
            style={{ fontFamily: "var(--font-sans, Manrope, sans-serif)" }}
          >
            {formatCurrency(totalSettledAmount)}
          </div>
          <div className="text-[12px] text-[#444656] mt-1">
            of {formatCurrency(totalEnrolledInSettled)} enrolled
          </div>
        </div>

        {/* Avg Savings */}
        <div className="bg-white rounded-xl px-6 py-5 shadow-coastal relative overflow-hidden">
          <div
            className="absolute left-0 top-0 bottom-0 w-[3px]"
            style={{ background: "#3052FF" }}
          />
          <div className="text-[11px] font-semibold text-[#444656] uppercase tracking-[0.5px] mb-2">
            Average Savings
          </div>
          <div
            className="text-[28px] font-extrabold text-[#131b2e] leading-none"
            style={{ fontFamily: "var(--font-sans, Manrope, sans-serif)" }}
          >
            {avgSavingsPercent > 0
              ? `${avgSavingsPercent.toFixed(1)}%`
              : "--"}
          </div>
          <div className="text-[12px] text-[#444656] mt-1">
            {settledDebts.length} debt{settledDebts.length !== 1 ? "s" : ""}{" "}
            settled
          </div>
        </div>

        {/* At-Risk */}
        <div className="bg-white rounded-xl px-6 py-5 shadow-coastal relative overflow-hidden">
          <div
            className="absolute left-0 top-0 bottom-0 w-[3px]"
            style={{ background: "#942b00" }}
          />
          <div className="text-[11px] font-semibold text-[#444656] uppercase tracking-[0.5px] mb-2">
            At-Risk Clients
          </div>
          <div
            className="text-[28px] font-extrabold leading-none"
            style={{
              fontFamily: "var(--font-sans, Manrope, sans-serif)",
              color: "#942b00",
            }}
          >
            {atRiskClients}
          </div>
          <div className="text-[12px] text-[#444656] mt-1">
            {missedPayments} missed payment
            {missedPayments !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* ── Charts Row ── */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Settlement Performance Bar Chart */}
        <div className="bg-white rounded-xl p-6 shadow-coastal">
          <h3
            className="text-[15px] font-bold text-[#131b2e] mb-5"
            style={{ fontFamily: "var(--font-sans, Manrope, sans-serif)" }}
          >
            Settlement Performance
          </h3>
          <div className="flex items-end gap-4 h-[200px] pt-2">
            {monthlyBars.map((bar) => (
              <div
                key={bar.label}
                className="flex-1 flex flex-col items-center gap-2 h-full justify-end"
              >
                <span className="text-[11px] font-semibold text-[#131b2e]">
                  {bar.val}
                </span>
                <div
                  className="w-full rounded-t-[4px] min-h-[4px]"
                  style={{
                    height: `${bar.heightPct}%`,
                    background: "linear-gradient(180deg, #3052ff, #0034e4)",
                  }}
                />
                <span className="text-[11px] font-medium text-[#444656]">
                  {bar.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Lead Conversion Funnel */}
        <div className="bg-white rounded-xl p-6 shadow-coastal">
          <h3
            className="text-[15px] font-bold text-[#131b2e] mb-5"
            style={{ fontFamily: "var(--font-sans, Manrope, sans-serif)" }}
          >
            Lead Conversion Funnel
          </h3>
          <div className="flex flex-col gap-[6px]">
            {funnelSteps.map((step) => (
              <div key={step.label} className="flex items-center gap-3">
                <span className="w-[76px] text-right text-[12px] font-medium text-[#444656] shrink-0">
                  {step.label}
                </span>
                <div className="flex-1 relative">
                  <div
                    className="h-9 rounded-[4px] flex items-center px-3 text-[12px] font-semibold text-white overflow-hidden"
                    style={{
                      width: `${step.widthPct}%`,
                      background: step.color,
                      minWidth: "32px",
                    }}
                  >
                    {step.count}
                  </div>
                </div>
                <span className="w-[44px] text-[11px] text-[#444656] shrink-0">
                  {step.pct}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Agent Performance Table ── */}
      <div className="bg-white rounded-xl p-6 shadow-coastal">
        <h3
          className="text-[15px] font-bold text-[#131b2e] mb-4"
          style={{ fontFamily: "var(--font-sans, Manrope, sans-serif)" }}
        >
          Agent Performance
        </h3>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Agent Name", "Calls Made", "Leads Converted", "Revenue Generated", "Conversion Rate"].map(
                (h, i) => (
                  <th
                    key={h}
                    className={`text-left text-[11px] font-semibold text-[#444656] uppercase tracking-[0.5px] py-[10px] px-4 bg-[#f2f3ff] ${
                      i === 0 ? "rounded-l-[4px]" : ""
                    } ${i === 4 ? "rounded-r-[4px]" : ""}`}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {agentRows.map((row, idx) => (
              <tr key={row.name}>
                <td
                  className={`px-4 py-3 text-[13px] font-semibold text-[#131b2e] ${
                    idx % 2 === 1 ? "bg-[#faf8ff]" : "bg-white"
                  }`}
                >
                  {row.name}
                </td>
                <td
                  className={`px-4 py-3 text-[13px] text-[#131b2e] ${
                    idx % 2 === 1 ? "bg-[#faf8ff]" : "bg-white"
                  }`}
                >
                  {row.calls}
                </td>
                <td
                  className={`px-4 py-3 text-[13px] text-[#131b2e] ${
                    idx % 2 === 1 ? "bg-[#faf8ff]" : "bg-white"
                  }`}
                >
                  {row.converted}
                </td>
                <td
                  className={`px-4 py-3 text-[13px] font-semibold text-[#0034e4] ${
                    idx % 2 === 1 ? "bg-[#faf8ff]" : "bg-white"
                  }`}
                >
                  {row.revenue}
                </td>
                <td
                  className={`px-4 py-3 ${
                    idx % 2 === 1 ? "bg-[#faf8ff]" : "bg-white"
                  }`}
                >
                  <span
                    className={`inline-block px-[10px] py-[3px] rounded-[4px] text-[12px] font-semibold ${
                      rateBadgeClass[row.tier]
                    }`}
                  >
                    {row.rate}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Portfolio Section ── */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Debt Portfolio Breakdown */}
        <div className="bg-white rounded-xl p-6 shadow-coastal">
          <h3
            className="text-[15px] font-bold text-[#131b2e] mb-5"
            style={{ fontFamily: "var(--font-sans, Manrope, sans-serif)" }}
          >
            Debt Portfolio Breakdown
          </h3>
          {/* Stacked bar */}
          <div className="h-8 rounded-[4px] flex overflow-hidden mb-4">
            <div
              className="flex items-center justify-center text-[11px] font-semibold text-white"
              style={{ width: `${portfolio.active.pct || 45}%`, background: "#0034e4" }}
            >
              {portfolio.active.pct || 45}%
            </div>
            <div
              className="flex items-center justify-center text-[11px] font-semibold text-white"
              style={{ width: `${portfolio.settled.pct || 35}%`, background: "#3052ff" }}
            >
              {portfolio.settled.pct || 35}%
            </div>
            <div
              className="flex items-center justify-center text-[11px] font-semibold text-white"
              style={{
                width: `${portfolio.negotiation.pct || 15}%`,
                background: "#7a8fff",
              }}
            >
              {portfolio.negotiation.pct || 15}%
            </div>
            <div
              className="flex items-center justify-center text-[11px] font-semibold text-white"
              style={{
                width: `${portfolio.default.pct || 5}%`,
                background: "#942b00",
                minWidth: portfolio.default.pct ? undefined : "5%",
              }}
            >
              {portfolio.default.pct || 5}%
            </div>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-4">
            {[
              { color: "#0034e4", label: `Active (${portfolio.active.pct || 45}%)` },
              { color: "#3052ff", label: `Settled (${portfolio.settled.pct || 35}%)` },
              { color: "#7a8fff", label: `In Negotiation (${portfolio.negotiation.pct || 15}%)` },
              { color: "#942b00", label: `Default (${portfolio.default.pct || 5}%)` },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-[6px] text-[12px] font-medium text-[#444656]">
                <div
                  className="w-[10px] h-[10px] rounded-[2px] shrink-0"
                  style={{ background: item.color }}
                />
                {item.label}
              </div>
            ))}
          </div>
        </div>

        {/* Portfolio Summary with CSS donut */}
        <div className="bg-white rounded-xl p-6 shadow-coastal">
          <h3
            className="text-[15px] font-bold text-[#131b2e] mb-5"
            style={{ fontFamily: "var(--font-sans, Manrope, sans-serif)" }}
          >
            Portfolio Summary
          </h3>
          <div className="flex items-center gap-8">
            {/* SVG Donut */}
            <div className="relative w-[140px] h-[140px] shrink-0">
              <svg viewBox="0 0 140 140" width="140" height="140">
                <circle
                  cx="70" cy="70" r="54"
                  fill="none" stroke="#0034e4" strokeWidth="18"
                  strokeDasharray="152.68 339.29"
                  strokeDashoffset="-84.82"
                  transform="rotate(-90 70 70)"
                />
                <circle
                  cx="70" cy="70" r="54"
                  fill="none" stroke="#3052ff" strokeWidth="18"
                  strokeDasharray="118.75 339.29"
                  strokeDashoffset="-237.5"
                  transform="rotate(-90 70 70)"
                />
                <circle
                  cx="70" cy="70" r="54"
                  fill="none" stroke="#7a8fff" strokeWidth="18"
                  strokeDasharray="50.89 339.29"
                  strokeDashoffset="-356.25"
                  transform="rotate(-90 70 70)"
                />
                <circle
                  cx="70" cy="70" r="54"
                  fill="none" stroke="#942b00" strokeWidth="18"
                  strokeDasharray="16.96 339.29"
                  strokeDashoffset="-407.15"
                  transform="rotate(-90 70 70)"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className="text-[22px] font-extrabold text-[#131b2e] leading-none"
                  style={{ fontFamily: "var(--font-sans, Manrope, sans-serif)" }}
                >
                  {formatCurrency(allDebts.reduce((s, d) => s + d.enrolledBalance, 0))}
                </span>
                <span className="text-[11px] text-[#444656] mt-1">Total Debt</span>
              </div>
            </div>
            {/* Legend */}
            <div className="flex flex-col gap-[10px]">
              {[
                { color: "#0034e4", label: "Active", val: formatCurrency(portfolio.active.amount) },
                { color: "#3052ff", label: "Settled", val: formatCurrency(portfolio.settled.amount) },
                { color: "#7a8fff", label: "Negotiation", val: formatCurrency(portfolio.negotiation.amount) },
                { color: "#942b00", label: "Default", val: formatCurrency(portfolio.default.amount) },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div
                    className="w-[10px] h-[10px] rounded-[2px] shrink-0"
                    style={{ background: item.color }}
                  />
                  <span className="text-[12px] text-[#444656] w-[90px]">{item.label}</span>
                  <span className="text-[13px] font-bold text-[#131b2e]">{item.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
