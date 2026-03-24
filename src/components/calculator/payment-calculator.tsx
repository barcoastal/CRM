"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCurrencyWhole(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getPeriodsPerYear(frequency: string): number {
  switch (frequency) {
    case "Weekly": return 52;
    case "Bi-Weekly": return 26;
    case "Monthly": return 12;
    default: return 52;
  }
}

function getPeriodsPerMonth(frequency: string): number {
  switch (frequency) {
    case "Weekly": return 4;
    case "Bi-Weekly": return 2;
    case "Monthly": return 1;
    default: return 4;
  }
}

function getFrequencyLabel(frequency: string): string {
  switch (frequency) {
    case "Weekly": return "Weekly";
    case "Bi-Weekly": return "Bi-Weekly";
    case "Monthly": return "Monthly";
    default: return "Weekly";
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface CalculatorInputs {
  totalDebt: number;
  numCreditors: number;
  interestRate: number;
  settlementPercent: number; // 30–70, default 50
  programDuration: number;   // months: 12–48
  monthlyFee: number;
  // preserved internal fields (used by legacy calculations)
  paymentTerm: number;
  serviceFee: number;
  monthlyBankFee: number;
  bankSetupFee: number;
  paymentFrequency: "Weekly" | "Bi-Weekly" | "Monthly";
  setupFee: number;
  downPayment: number;
  programFeePercent: number;
  retainerPercentage: number;
}

interface ScheduleRow {
  period: number;
  paymentAmount: number;
  setupFee: number;
  programFee: number;
  serviceFee: number;
  bankFee: number;
  savings: number;
}

interface AmortRow {
  month: number;
  payment: number;
  accumulated: number;
  remaining: number;
}

export interface PaymentCalculatorProps {
  initialDebt?: number;
  businessName?: string;
  contactEmail?: string;
  compact?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PaymentCalculator({
  initialDebt,
  businessName,
  contactEmail,
  compact,
}: PaymentCalculatorProps = {}) {
  // ── State ────────────────────────────────────────────────────────────────
  const [inputs, setInputs] = useState<CalculatorInputs>({
    totalDebt: initialDebt || 100000,
    numCreditors: 5,
    interestRate: 22.5,
    settlementPercent: 50,
    programDuration: 36,
    monthlyFee: 500,
    // legacy/internal
    paymentTerm: 7,
    serviceFee: 55,
    monthlyBankFee: 10,
    bankSetupFee: 15,
    paymentFrequency: "Monthly",
    setupFee: 850,
    downPayment: 0,
    programFeePercent: 20,
    retainerPercentage: 10,
  });

  // keep programDuration and paymentTerm in sync so legacy calc works
  const updateInput = <K extends keyof CalculatorInputs>(
    key: K,
    value: CalculatorInputs[K]
  ) => {
    setInputs((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "programDuration") {
        next.paymentTerm = value as number;
      }
      return next;
    });
  };

  // ── Calculations (all original logic preserved) ──────────────────────────
  const calculations = useMemo(() => {
    const {
      totalDebt,
      paymentTerm,
      serviceFee,
      monthlyBankFee,
      bankSetupFee,
      paymentFrequency,
      setupFee,
      settlementPercent,
      downPayment,
      programFeePercent,
      retainerPercentage,
      programDuration,
      monthlyFee,
    } = inputs;

    const totalSettlement = totalDebt * (settlementPercent / 100);
    const totalProgramFee = totalDebt * (programFeePercent / 100);
    const retainerAmount = totalDebt * (retainerPercentage / 100);

    const totalWithFees = totalSettlement + totalProgramFee + retainerAmount;
    const feesPercent = settlementPercent + programFeePercent + retainerPercentage;
    const estimatedSavings = totalDebt - totalWithFees;
    const savingsPercent = 100 - feesPercent;

    const periodsPerMonth = getPeriodsPerMonth(paymentFrequency);
    const totalPeriodsCalc = paymentTerm * periodsPerMonth;
    const regularPeriods = totalPeriodsCalc - 1;

    const totalCollections =
      totalSettlement +
      totalProgramFee +
      serviceFee * totalPeriodsCalc +
      monthlyBankFee * paymentTerm +
      bankSetupFee;

    const periodicPayment = regularPeriods > 0 ? totalCollections / regularPeriods : 0;
    const firstPeriodPayment = retainerAmount + setupFee + downPayment;

    const periodicServiceFee = serviceFee;
    const periodicBankFee = monthlyBankFee / periodsPerMonth;

    const programFeeRatio =
      totalDebt - retainerAmount > 0
        ? (totalSettlement + totalProgramFee) / (totalDebt - retainerAmount)
        : 0;

    const schedule: ScheduleRow[] = [];
    let remainingProgramFee = totalProgramFee;

    schedule.push({
      period: 1,
      paymentAmount: firstPeriodPayment,
      setupFee: setupFee,
      programFee: 0,
      serviceFee: 0,
      bankFee: 0,
      savings: 0,
    });

    for (let i = 2; i <= totalPeriodsCalc; i++) {
      const available = periodicPayment - periodicServiceFee - periodicBankFee;
      let periodProgramFee: number;
      let periodSavings: number;

      if (remainingProgramFee > 0) {
        periodProgramFee = Math.min(available * programFeeRatio, remainingProgramFee);
        periodSavings = available - periodProgramFee;
      } else {
        periodProgramFee = 0;
        periodSavings = available;
      }

      remainingProgramFee -= periodProgramFee;

      schedule.push({
        period: i,
        paymentAmount: periodicPayment,
        setupFee: 0,
        programFee: periodProgramFee,
        serviceFee: periodicServiceFee,
        bankFee: periodicBankFee,
        savings: periodSavings,
      });
    }

    // ── Simple amortization for first 6 months (based on monthlyFee / settlement) ──
    const monthlyPayment =
      programDuration > 0 ? totalSettlement / programDuration : 0;
    const displayMonthlyPayment = monthlyFee > 0 ? monthlyFee : monthlyPayment;

    const amort: AmortRow[] = [];
    let accumulated = 0;
    let remaining = totalSettlement;
    for (let m = 1; m <= Math.min(6, programDuration); m++) {
      const payment = displayMonthlyPayment;
      accumulated += payment;
      remaining = Math.max(0, remaining - payment);
      amort.push({ month: m, payment, accumulated, remaining });
    }

    return {
      totalSettlement,
      totalProgramFee,
      retainerAmount,
      totalWithFees,
      feesPercent,
      estimatedSavings,
      savingsPercent,
      periodicPayment,
      firstPeriodPayment,
      totalPeriods: totalPeriodsCalc,
      schedule,
      frequencyLabel: getFrequencyLabel(paymentFrequency),
      amort,
      displayMonthlyPayment,
    };
  }, [inputs]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page header */}
      {!compact && (
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#131b2e]">
            Settlement Calculator
          </h1>
        </div>
      )}

      {/* Split layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* ── Left: Input form ──────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-coastal p-7">
          <h2 className="font-bold text-[17px] text-[#131b2e] mb-6">Debt Information</h2>

          <div className="space-y-5">

            {/* Total Debt */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#444656] uppercase tracking-wide">
                Total Debt ($)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#444656] font-medium pointer-events-none">
                  $
                </span>
                <input
                  type="number"
                  min={0}
                  value={inputs.totalDebt}
                  onChange={(e) => updateInput("totalDebt", Number(e.target.value))}
                  className="w-full pl-7 pr-3.5 py-2.5 bg-[#f2f3ff] rounded text-[#131b2e] text-lg font-bold focus:outline-none"
                />
              </div>
            </div>

            {/* Number of Creditors */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#444656] uppercase tracking-wide">
                Number of Creditors
              </label>
              <input
                type="number"
                min={1}
                value={inputs.numCreditors}
                onChange={(e) => updateInput("numCreditors", Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-[#f2f3ff] rounded text-[#131b2e] text-sm focus:outline-none"
              />
            </div>

            {/* Average Interest Rate */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#444656] uppercase tracking-wide">
                Average Interest Rate
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={inputs.interestRate}
                  onChange={(e) => updateInput("interestRate", Number(e.target.value))}
                  className="w-full pl-3.5 pr-8 py-2.5 bg-[#f2f3ff] rounded text-[#131b2e] text-sm focus:outline-none"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-[#444656] font-medium pointer-events-none">
                  %
                </span>
              </div>
            </div>

            {/* Settlement Target (range slider) */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#444656] uppercase tracking-wide">
                Settlement Target
              </label>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[#444656]">Settlement %</span>
                <span className="font-extrabold text-xl text-[#3052ff]">
                  {inputs.settlementPercent}%
                </span>
              </div>
              <input
                type="range"
                min={30}
                max={70}
                step={1}
                value={inputs.settlementPercent}
                onChange={(e) => updateInput("settlementPercent", Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none outline-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #3052ff ${((inputs.settlementPercent - 30) / 40) * 100}%, #eaedff ${((inputs.settlementPercent - 30) / 40) * 100}%)`,
                }}
              />
              <div className="flex justify-between text-[11px] text-[#444656]">
                <span>30%</span>
                <span>70%</span>
              </div>
            </div>

            {/* Program Duration */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#444656] uppercase tracking-wide">
                Program Duration
              </label>
              <select
                value={inputs.programDuration}
                onChange={(e) => updateInput("programDuration", Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-[#f2f3ff] rounded text-[#131b2e] text-sm focus:outline-none"
              >
                {[12, 18, 24, 30, 36, 42, 48].map((m) => (
                  <option key={m} value={m}>
                    {m} months
                  </option>
                ))}
              </select>
            </div>

            {/* Monthly Fee */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#444656] uppercase tracking-wide">
                Monthly Fee ($)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#444656] font-medium pointer-events-none">
                  $
                </span>
                <input
                  type="number"
                  min={0}
                  value={inputs.monthlyFee}
                  onChange={(e) => updateInput("monthlyFee", Number(e.target.value))}
                  className="w-full pl-7 pr-3.5 py-2.5 bg-[#f2f3ff] rounded text-[#131b2e] text-sm focus:outline-none"
                />
              </div>
            </div>

            {/* Calculate button */}
            <button
              type="button"
              className="gradient-primary w-full py-3.5 rounded text-white text-sm font-semibold mt-2 cursor-pointer"
              style={{ boxShadow: "0 4px 16px rgba(48,82,255,0.3)" }}
              onClick={() => toast.success("Results updated")}
            >
              Calculate Settlement
            </button>
          </div>
        </div>

        {/* ── Right: Results ────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Results card */}
          <div className="bg-white rounded-xl shadow-coastal p-7">
            <h2 className="font-bold text-[17px] text-[#131b2e] mb-1">Settlement Results</h2>

            {/* Hero: Total Debt */}
            <div className="text-center py-6 border-b border-[#f2f3ff]">
              <p className="text-sm text-[#444656] mb-1">Total Debt</p>
              <p className="text-[38px] font-extrabold text-[#131b2e] leading-none">
                {formatCurrencyWhole(inputs.totalDebt)}
              </p>
            </div>

            {/* Result grid */}
            <div className="grid grid-cols-2 gap-3.5 mt-5 mb-6">
              <div className="bg-[#f2f3ff] rounded-lg p-4">
                <p className="text-xs text-[#444656] mb-1">Estimated Settlement</p>
                <p className="font-bold text-[20px] text-[#131b2e]">
                  {formatCurrencyWhole(calculations.totalSettlement)}
                </p>
              </div>
              <div className="bg-[#f2f3ff] rounded-lg p-4">
                <p className="text-xs text-[#444656] mb-1">Total Savings</p>
                <p className="font-bold text-[20px] text-[#15803d]">
                  {formatCurrencyWhole(calculations.estimatedSavings)}
                </p>
              </div>
              <div className="bg-[#f2f3ff] rounded-lg p-4">
                <p className="text-xs text-[#444656] mb-1">Savings Percentage</p>
                <p className="font-bold text-[20px] text-[#3052ff]">
                  {calculations.savingsPercent}%
                </p>
              </div>
              <div className="bg-[#f2f3ff] rounded-lg p-4">
                <p className="text-xs text-[#444656] mb-1">Monthly Payment</p>
                <p className="font-bold text-[20px] text-[#131b2e]">
                  {formatCurrencyWhole(calculations.displayMonthlyPayment)}
                </p>
              </div>
              <div className="bg-[#f2f3ff] rounded-lg p-4 col-span-2">
                <p className="text-xs text-[#444656] mb-1">Program Duration</p>
                <p className="font-bold text-[20px] text-[#131b2e]">
                  {inputs.programDuration} months
                </p>
              </div>
            </div>

            {/* Bar chart: Original vs Settlement */}
            <div>
              <h3 className="font-bold text-sm text-[#131b2e] mb-4">Debt Comparison</h3>
              <div className="space-y-3">
                {/* Original Debt bar */}
                <div className="flex items-center gap-3.5">
                  <span className="w-24 text-right text-[12.5px] text-[#444656] shrink-0">
                    Original Debt
                  </span>
                  <div className="flex-1 h-8 bg-[#f2f3ff] rounded overflow-hidden relative">
                    <div
                      className="h-full w-full bg-[#c4c5d9] rounded flex items-center px-3"
                    >
                      <span className="text-xs font-semibold text-[#444656]">
                        {formatCurrencyWhole(inputs.totalDebt)}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Settlement bar */}
                <div className="flex items-center gap-3.5">
                  <span className="w-24 text-right text-[12.5px] text-[#444656] shrink-0">
                    Settlement
                  </span>
                  <div className="flex-1 h-8 bg-[#f2f3ff] rounded overflow-hidden relative">
                    <div
                      className="h-full gradient-primary rounded flex items-center px-3"
                      style={{
                        width: `${Math.min(100, inputs.settlementPercent)}%`,
                      }}
                    >
                      <span className="text-xs font-semibold text-white whitespace-nowrap">
                        {formatCurrencyWhole(calculations.totalSettlement)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Amortization table */}
          <div className="bg-white rounded-xl shadow-coastal p-7">
            <h3 className="font-bold text-sm text-[#131b2e] mb-4">
              Payment Schedule (First 6 Months)
            </h3>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#f2f3ff]">
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-[#444656] uppercase tracking-wide rounded-tl">
                    Month
                  </th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-[#444656] uppercase tracking-wide">
                    Payment
                  </th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-[#444656] uppercase tracking-wide">
                    Accumulated
                  </th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-[#444656] uppercase tracking-wide rounded-tr">
                    Remaining
                  </th>
                </tr>
              </thead>
              <tbody>
                {calculations.amort.map((row, i) => (
                  <tr
                    key={row.month}
                    className={i % 2 === 1 ? "bg-[#faf8ff]" : "bg-white"}
                  >
                    <td className="px-3 py-2.5 text-sm text-[#131b2e]">{row.month}</td>
                    <td className="px-3 py-2.5 text-sm text-[#131b2e]">
                      {formatCurrencyWhole(row.payment)}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-[#131b2e]">
                      {formatCurrencyWhole(row.accumulated)}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-[#131b2e]">
                      {formatCurrencyWhole(row.remaining)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
