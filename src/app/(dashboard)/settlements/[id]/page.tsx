import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecordPage, HeaderActions, StatusPill } from "@/components/slds/record-page";
import { Section, FieldGrid } from "@/components/slds/section";
import { settlementStatusTone } from "@/lib/slds/status-tones";

export default async function SettlementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await prisma.settlement.findUnique({
    where: { id },
    include: {
      debt: {
        include: {
          creditor: { include: { account: { select: { name: true } } } },
          opportunity: { select: { id: true, account: { select: { name: true } } } },
          programPlan: { select: { id: true, recordType: true } },
        },
      },
      offer: true,
      approvedBy: { select: { id: true, name: true } },
    },
  });
  if (!s) notFound();

  return (
    <RecordPage
      entity="Settlement"
      entityLabel="Settlement"
      recordTitle={`${s.debt.creditor?.account?.name ?? s.debt.creditorName} — $${s.settledAmount.toLocaleString()}`}
      recordSubtitle={
        <>
          {s.recordType} · <StatusPill label={s.status} tone={settlementStatusTone(s.status)} />
        </>
      }
      highlights={[
        { label: "Original Balance", value: `$${s.debt.originalBalance.toLocaleString()}` },
        { label: "Settled", value: `$${s.settledAmount.toLocaleString()}` },
        { label: "Savings", value: `$${s.savingsAmount.toLocaleString()} (${Math.round(s.savingsPercent * 100)}%)` },
        { label: "Settled Date", value: s.settledDate.toLocaleDateString() },
        { label: "Payoff Due", value: s.payoffDueDate?.toLocaleDateString() },
      ]}
      actions={<HeaderActions buttons={[{ label: "Edit" }, { label: "Mark Paid", primary: true }]} />}
      details={
        <>
          <Section title="Settlement Information">
            <FieldGrid
              fields={[
                ["Type", s.recordType],
                ["Status", <StatusPill key="s" label={s.status} tone={settlementStatusTone(s.status)} />],
                ["Settled Amount", `$${s.settledAmount.toLocaleString()}`],
                ["Savings Amount", `$${s.savingsAmount.toLocaleString()}`],
                ["Savings %", `${Math.round(s.savingsPercent * 100)}%`],
                ["Settled Date", s.settledDate.toLocaleString()],
                ["Payoff Due Date", s.payoffDueDate?.toLocaleString()],
                ["Payoff Paid Date", s.payoffPaidDate?.toLocaleString()],
                ["Approved By", s.approvedBy?.name],
              ]}
            />
            {s.notes && <div style={{ marginTop: 12, fontSize: 13, whiteSpace: "pre-wrap" }}>{s.notes}</div>}
          </Section>

          <Section title="Related">
            <FieldGrid
              fields={[
                ["Creditor", s.debt.creditor?.account?.name ?? s.debt.creditorName],
                ["Debt — Original Balance", `$${s.debt.originalBalance.toLocaleString()}`],
                ["Opportunity", s.debt.opportunity && <Link key="o" href={`/opportunities/${s.debt.opportunity.id}`} style={{ color: "#1589ee" }}>{s.debt.opportunity.account?.name ?? s.debt.opportunity.id}</Link>],
                ["Program Plan", s.debt.programPlan && <Link key="pp" href={`/program-plans/${s.debt.programPlan.id}`} style={{ color: "#1589ee" }}>{s.debt.programPlan.recordType}</Link>],
                ["Source Offer", s.offer && `$${s.offer.amountOffered.toLocaleString()} (${s.offer.direction})`],
              ]}
            />
          </Section>
        </>
      }
    />
  );
}
