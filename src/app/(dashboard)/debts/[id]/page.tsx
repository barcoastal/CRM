import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecordPage, StatusPill } from "@/components/slds/record-page";
import { Section, FieldGrid } from "@/components/slds/section";
import { ActivityChatterRail } from "@/components/slds/activity-chatter-rail";
import type { ActivityItem } from "@/components/slds/activity-rail";
import { genericTone } from "@/lib/slds/status-tones";

/**
 * Debt Detail record page - 1:1 with the SF Debt Detail layout: header with
 * enrolled amount, Details field grid in SF field order, Activity rail.
 */
export default async function DebtDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const debt = await prisma.debt.findUnique({
    where: { id },
    include: {
      opportunity: { select: { id: true, name: true, account: { select: { id: true, name: true } }, assignedTo: { select: { name: true } } } },
      programPlan: { select: { id: true, recordType: true } },
    },
  });
  if (!debt) notFound();

  let sf: Record<string, unknown> = {};
  try { sf = debt.sfDataJson ? JSON.parse(debt.sfDataJson) as Record<string, unknown> : {}; } catch { /* empty */ }
  const g = (k: string): string | null => {
    const v = sf[k];
    return v == null || v === "" ? null : String(v);
  };
  const usd = (n: number | null | undefined): string | null =>
    n != null ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null;

  const tasks = await prisma.task.findMany({ where: { debtId: debt.id }, orderBy: { createdAt: "desc" }, take: 30 });
  const activity: ActivityItem[] = tasks.map((t) => ({
    id: t.id,
    type: (t.type === "CALL" ? "CALL" : "TASK") as ActivityItem["type"],
    subject: t.subject,
    meta: t.outcome ?? t.disposition ?? null,
    date: t.dueDate ?? t.completedAt ?? t.createdAt,
    done: t.status === "COMPLETED",
  }));

  return (
    <RecordPage
      entity="Opportunity"
      entityLabel="Debt Details"
      recordTitle={debt.name ?? debt.creditorName}
      recordSubtitle={<StatusPill label={debt.status} tone={genericTone(debt.status)} />}
      highlights={[
        { label: "Creditor", value: debt.creditorName },
        { label: "Enrolled Debt Amount", value: usd(debt.enrolledBalance) },
        { label: "Payment", value: usd(debt.paymentAmount) },
        { label: "Account", value: debt.opportunity?.account ? <Link href={`/accounts/${debt.opportunity.account.id}`} style={{ color: "#0176d3" }}>{debt.opportunity.account.name}</Link> : null },
      ]}
      details={
        <Section title="Details">
          {/* SF Debt Detail layout order (verified against the live page). */}
          <FieldGrid
            fields={[
              ["Debt Name", debt.name ?? debt.creditorName],
              ["Owner", debt.opportunity?.assignedTo?.name ?? g("OwnerId")],
              ["Opportunity", debt.opportunity ? <Link key="o" href={`/opportunities/${debt.opportunity.id}`} style={{ color: "#0176d3" }}>{debt.opportunity.name}</Link> : null],
              ["Enrolled Debt Amount", usd(debt.enrolledBalance)],
              ["Program Plan", debt.programPlan ? <Link key="p" href={`/program-plans/${debt.programPlan.id}`} style={{ color: "#0176d3" }}>{debt.programPlan.recordType.replace(/_/g, " ")}</Link> : null],
              ["Payment", usd(debt.paymentAmount)],
              ["Current Creditor", g("Current_Creditor__r.Name") ?? debt.creditorName],
              ["Payment Frequency", debt.paymentFrequency],
              ["Collection Agency", g("Collection_Agency__r.Name")],
              ["Account Number", debt.accountNumber],
              ["Account", debt.opportunity?.account ? <Link key="a" href={`/accounts/${debt.opportunity.account.id}`} style={{ color: "#0176d3" }}>{debt.opportunity.account.name}</Link> : null],
              ["Debt Status", g("Debt_Status__c") ?? debt.status],
              ["Original Creditor", g("Original_Creditor__r.Name")],
              ["Legal Status", debt.legalStatus],
              ["Lien Position", debt.lienPosition],
              ["Negotiation Status", debt.negotiationStatus],
              ["Settlement Priority", g("Settlement_Priority__c")],
              ["Legal Network", g("Legal_Network__c")],
              ["Settlement Amount", usd(debt.settledAmount)],
              ["Total Savings", usd(debt.savingsAmount)],
              ["Settlement Percentage", g("Settlement_Percentage__c") ? `${g("Settlement_Percentage__c")}%` : null],
              ["Total Savings Percentage", debt.savingsPercent != null ? `${debt.savingsPercent}%` : null],
              ["Actual Debt Amount", usd(debt.currentBalance)],
              ["Show Debt Detail On Account", g("Valid_Debt_Detail__c") === "true" ? "Yes" : g("Valid_Debt_Detail__c") === "false" ? "No" : null],
            ]}
          />
        </Section>
      }
      rail={<ActivityChatterRail activities={activity} chatter={[]} />}
    />
  );
}
