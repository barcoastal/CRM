"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Copy, Send, FileText } from "lucide-react";

interface CalculatorInputs {
  totalDebt: number;
  paymentTerm: number;
  serviceFee: number;
  monthlyBankFee: number;
  bankSetupFee: number;
  paymentFrequency: "Weekly" | "Bi-Weekly" | "Monthly";
  setupFee: number;
  settlementPercent: number;
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

interface PaymentCalculatorProps {
  initialDebt?: number;
  businessName?: string;
  contactEmail?: string;
  compact?: boolean;
}

export function PaymentCalculator({ initialDebt, businessName, contactEmail, compact }: PaymentCalculatorProps = {}) {
  const [proposalEmail, setProposalEmail] = useState(contactEmail || "");
  const [proposalSubject, setProposalSubject] = useState(
    businessName ? `Payment Plan Proposal - ${businessName}` : "Payment Plan Proposal"
  );
  const [proposalMessage, setProposalMessage] = useState("");
  const [sendingProposal, setSendingProposal] = useState(false);

  const [inputs, setInputs] = useState<CalculatorInputs>({
    totalDebt: initialDebt || 100000,
    paymentTerm: 7,
    serviceFee: 55,
    monthlyBankFee: 10,
    bankSetupFee: 15,
    paymentFrequency: "Weekly",
    setupFee: 850,
    settlementPercent: 43,
    downPayment: 0,
    programFeePercent: 20,
    retainerPercentage: 10,
  });

  const updateInput = <K extends keyof CalculatorInputs>(
    key: K,
    value: CalculatorInputs[K]
  ) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

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
    } = inputs;

    const totalSettlement = totalDebt * (settlementPercent / 100);
    const totalProgramFee = totalDebt * (programFeePercent / 100);
    const retainerAmount = totalDebt * (retainerPercentage / 100);

    const totalWithFees = totalSettlement + totalProgramFee + retainerAmount;
    const feesPercent = settlementPercent + programFeePercent + retainerPercentage;
    const estimatedSavings = totalDebt - totalWithFees;
    const savingsPercent = 100 - feesPercent;

    const periodsPerMonth = getPeriodsPerMonth(paymentFrequency);
    const totalPeriods = paymentTerm * periodsPerMonth * 12 / 12; // paymentTerm is in months? No — from screenshot it's 7 with 28 weeks = 7 months
    // paymentTerm = months, totalPeriods = paymentTerm * periodsPerMonth
    const totalPeriodsCalc = paymentTerm * periodsPerMonth;
    const regularPeriods = totalPeriodsCalc - 1; // first period is retainer

    // Total to collect over regular periods
    const totalCollections =
      totalSettlement +
      totalProgramFee +
      serviceFee * totalPeriodsCalc +
      monthlyBankFee * paymentTerm +
      bankSetupFee;

    const periodicPayment = regularPeriods > 0 ? totalCollections / regularPeriods : 0;

    // Week 1 payment
    const firstPeriodPayment = retainerAmount + setupFee + downPayment;

    // Schedule breakdown
    const periodicServiceFee = serviceFee;
    // Bank fee is monthly — spread across periods
    const periodicBankFee = monthlyBankFee / periodsPerMonth;

    // Program fee ratio for splitting available funds
    const programFeeRatio =
      totalDebt - retainerAmount > 0
        ? (totalSettlement + totalProgramFee) / (totalDebt - retainerAmount)
        : 0;

    // Build schedule
    const schedule: ScheduleRow[] = [];
    let remainingProgramFee = totalProgramFee;
    let remainingSavings = totalSettlement; // savings = settlement funds collected

    // Period 1: retainer + setup fee + down payment
    schedule.push({
      period: 1,
      paymentAmount: firstPeriodPayment,
      setupFee: setupFee,
      programFee: 0,
      serviceFee: 0,
      bankFee: 0,
      savings: 0,
    });

    // Periods 2 through totalPeriods
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
      remainingSavings -= periodSavings;

      // Bank fee: include setup fee on first bank charge (period 2), regular after
      const bankFeeForPeriod = i === 2 ? periodicBankFee + bankSetupFee / periodsPerMonth : periodicBankFee;

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
    };
  }, [inputs]);

  return (
    <div className="space-y-6">
      {!compact && (
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Payment Calculator</h2>
          <p className="text-muted-foreground">
            {businessName
              ? `Payment schedule for ${businessName}`
              : "Calculate debt settlement payment schedules"}
          </p>
        </div>
      )}

      {/* Input Fields */}
      <Card>
        <CardHeader>
          <CardTitle>Program Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="totalDebt">Total Debt ($)</Label>
              <Input
                id="totalDebt"
                type="number"
                min={0}
                value={inputs.totalDebt}
                onChange={(e) => updateInput("totalDebt", Number(e.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="paymentTerm">Payment Term (Months)</Label>
              <Input
                id="paymentTerm"
                type="number"
                min={1}
                value={inputs.paymentTerm}
                onChange={(e) => updateInput("paymentTerm", Number(e.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="serviceFee">Service Fee ($)</Label>
              <Input
                id="serviceFee"
                type="number"
                min={0}
                value={inputs.serviceFee}
                onChange={(e) => updateInput("serviceFee", Number(e.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="monthlyBankFee">Monthly Bank Fee ($)</Label>
              <Input
                id="monthlyBankFee"
                type="number"
                min={0}
                value={inputs.monthlyBankFee}
                onChange={(e) => updateInput("monthlyBankFee", Number(e.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bankSetupFee">Bank Setup Fee ($)</Label>
              <Input
                id="bankSetupFee"
                type="number"
                min={0}
                value={inputs.bankSetupFee}
                onChange={(e) => updateInput("bankSetupFee", Number(e.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="paymentFrequency">Payment Frequency</Label>
              <Select
                value={inputs.paymentFrequency}
                onValueChange={(v) =>
                  updateInput("paymentFrequency", v as CalculatorInputs["paymentFrequency"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Weekly">Weekly</SelectItem>
                  <SelectItem value="Bi-Weekly">Bi-Weekly</SelectItem>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="setupFee">Setup Fee ($)</Label>
              <Input
                id="setupFee"
                type="number"
                min={0}
                value={inputs.setupFee}
                onChange={(e) => updateInput("setupFee", Number(e.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="settlementPercent">Settlement Percent (%)</Label>
              <Input
                id="settlementPercent"
                type="number"
                min={0}
                max={100}
                value={inputs.settlementPercent}
                onChange={(e) => updateInput("settlementPercent", Number(e.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="downPayment">Down Payment ($)</Label>
              <Input
                id="downPayment"
                type="number"
                min={0}
                value={inputs.downPayment}
                onChange={(e) => updateInput("downPayment", Number(e.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="programFeePercent">Program Fee Percent (%)</Label>
              <Input
                id="programFeePercent"
                type="number"
                min={0}
                max={100}
                value={inputs.programFeePercent}
                onChange={(e) => updateInput("programFeePercent", Number(e.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="retainerPercentage">Retainer Percentage (%)</Label>
              <Input
                id="retainerPercentage"
                type="number"
                min={0}
                max={100}
                value={inputs.retainerPercentage}
                onChange={(e) => updateInput("retainerPercentage", Number(e.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Retainer Amount</Label>
              <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm font-medium">
                {formatCurrencyWhole(calculations.retainerAmount)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Settlement Amt</p>
            <p className="text-2xl font-bold">
              {formatCurrencyWhole(calculations.totalSettlement)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Program Fee</p>
            <p className="text-2xl font-bold">
              {formatCurrencyWhole(calculations.totalProgramFee)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Total Amount With Fees ({calculations.feesPercent}%)
            </p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrencyWhole(calculations.totalWithFees)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Estimated Amount You Save ({calculations.savingsPercent}%)
            </p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrencyWhole(calculations.estimatedSavings)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payment Amount */}
      <Card className="border-primary">
        <CardContent className="pt-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {calculations.frequencyLabel} Payments
            </p>
            <p className="text-3xl font-bold">
              {formatCurrency(calculations.periodicPayment)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">First Payment (Retainer + Setup)</p>
            <p className="text-xl font-semibold">
              {formatCurrency(calculations.firstPeriodPayment)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Payment Schedule Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead className="text-right">
                    {calculations.frequencyLabel} Payment
                  </TableHead>
                  <TableHead className="text-right">Setup Fee</TableHead>
                  <TableHead className="text-right">
                    {calculations.frequencyLabel} Program Fee
                  </TableHead>
                  <TableHead className="text-right">
                    {calculations.frequencyLabel} Service Fee
                  </TableHead>
                  <TableHead className="text-right">Bank Fee</TableHead>
                  <TableHead className="text-right">
                    {calculations.frequencyLabel} Savings
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calculations.schedule.map((row) => (
                  <TableRow
                    key={row.period}
                    className={row.period === 1 ? "bg-muted/50 font-medium" : ""}
                  >
                    <TableCell>{row.period}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.paymentAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.setupFee > 0 ? formatCurrency(row.setupFee) : "--"}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.programFee > 0 ? formatCurrency(row.programFee) : "--"}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.serviceFee > 0 ? formatCurrency(row.serviceFee) : "--"}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.bankFee > 0 ? formatCurrency(row.bankFee) : "--"}
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-600 dark:text-green-400">
                      {row.savings > 0 ? formatCurrency(row.savings) : "--"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Send Proposal Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            Send Proposal
          </CardTitle>
          <CardDescription>
            Compose and send a payment plan proposal to the client
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email and Subject Fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="proposalEmail">Recipient Email</Label>
              <Input
                id="proposalEmail"
                type="email"
                placeholder="client@example.com"
                value={proposalEmail}
                onChange={(e) => setProposalEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proposalSubject">Subject</Label>
              <Input
                id="proposalSubject"
                type="text"
                value={proposalSubject}
                onChange={(e) => setProposalSubject(e.target.value)}
              />
            </div>
          </div>

          {/* Message textarea */}
          <div className="space-y-1.5">
            <Label htmlFor="proposalMessage">Message</Label>
            <Textarea
              id="proposalMessage"
              placeholder="Write your personalized message to the client..."
              value={proposalMessage}
              onChange={(e) => setProposalMessage(e.target.value)}
              rows={5}
            />
          </div>

          <Separator />

          {/* Calculation Summary Preview */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Proposal Summary Preview</Label>
            <div className="rounded-md border bg-muted/50 p-4 text-sm font-mono whitespace-pre-wrap">
              {`PAYMENT PLAN PROPOSAL
Business: ${businessName || "N/A"}
Total Debt: ${formatCurrencyWhole(inputs.totalDebt)}
Settlement Amount (${inputs.settlementPercent}%): ${formatCurrencyWhole(calculations.totalSettlement)}
Program Fee (${inputs.programFeePercent}%): ${formatCurrencyWhole(calculations.totalProgramFee)}
Total With Fees: ${formatCurrencyWhole(calculations.totalWithFees)}
Estimated Savings: ${formatCurrencyWhole(calculations.estimatedSavings)} (${calculations.savingsPercent}%)

Payment Schedule:
${calculations.frequencyLabel} Payment: ${formatCurrency(calculations.periodicPayment)}
First Payment (Retainer + Setup): ${formatCurrency(calculations.firstPeriodPayment)}
Program Length: ${inputs.paymentTerm} months / ${calculations.totalPeriods} payments`}
              {proposalMessage ? `\n\n${proposalMessage}` : ""}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                const summaryText = `PAYMENT PLAN PROPOSAL
Business: ${businessName || "N/A"}
Total Debt: ${formatCurrencyWhole(inputs.totalDebt)}
Settlement Amount (${inputs.settlementPercent}%): ${formatCurrencyWhole(calculations.totalSettlement)}
Program Fee (${inputs.programFeePercent}%): ${formatCurrencyWhole(calculations.totalProgramFee)}
Total With Fees: ${formatCurrencyWhole(calculations.totalWithFees)}
Estimated Savings: ${formatCurrencyWhole(calculations.estimatedSavings)} (${calculations.savingsPercent}%)

Payment Schedule:
${calculations.frequencyLabel} Payment: ${formatCurrency(calculations.periodicPayment)}
First Payment (Retainer + Setup): ${formatCurrency(calculations.firstPeriodPayment)}
Program Length: ${inputs.paymentTerm} months / ${calculations.totalPeriods} payments${proposalMessage ? `\n\n${proposalMessage}` : ""}`;

                navigator.clipboard.writeText(summaryText).then(() => {
                  toast.success("Proposal copied to clipboard");
                }).catch(() => {
                  toast.error("Failed to copy to clipboard");
                });
              }}
            >
              <Copy className="size-4 mr-2" />
              Copy to Clipboard
            </Button>

            <Button
              disabled={sendingProposal || !proposalEmail}
              onClick={async () => {
                if (!proposalEmail) {
                  toast.error("Please enter a recipient email address");
                  return;
                }
                if (!proposalSubject) {
                  toast.error("Please enter a subject");
                  return;
                }

                setSendingProposal(true);
                try {
                  const calculationSummary = {
                    businessName: businessName || "N/A",
                    totalDebt: inputs.totalDebt,
                    settlementPercent: inputs.settlementPercent,
                    settlementAmount: calculations.totalSettlement,
                    programFeePercent: inputs.programFeePercent,
                    programFee: calculations.totalProgramFee,
                    totalWithFees: calculations.totalWithFees,
                    estimatedSavings: calculations.estimatedSavings,
                    savingsPercent: calculations.savingsPercent,
                    frequency: calculations.frequencyLabel,
                    periodicPayment: calculations.periodicPayment,
                    firstPayment: calculations.firstPeriodPayment,
                    programLengthMonths: inputs.paymentTerm,
                    totalPayments: calculations.totalPeriods,
                  };

                  const res = await fetch("/api/proposals/send", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      email: proposalEmail,
                      subject: proposalSubject,
                      message: proposalMessage,
                      calculationSummary,
                    }),
                  });

                  if (res.ok) {
                    toast.success("Proposal sent successfully");
                  } else {
                    const data = await res.json();
                    toast.error(data.error || "Failed to send proposal");
                  }
                } catch {
                  toast.error("Failed to send proposal");
                } finally {
                  setSendingProposal(false);
                }
              }}
            >
              <Send className="size-4 mr-2" />
              {sendingProposal ? "Sending..." : "Send Email"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
