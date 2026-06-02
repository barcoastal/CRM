import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecordPage, HeaderActions, StatusPill } from "@/components/slds/record-page";
import { Section, FieldGrid } from "@/components/slds/section";
import { genericTone } from "@/lib/slds/status-tones";

export default async function OfferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await prisma.offer.findUnique({
    where: { id },
    include: {
      debt: {
        include: {
          creditor: { include: { account: { select: { id: true, name: true } } } },
          opportunity: { select: { id: true, account: { select: { name: true } } } },
        },
      },
      settlement: true,
      createdBy: { select: { id: true, name: true } },
      negotiations: { include: { negotiator: { select: { id: true, name: true } } }, orderBy: { date: "desc" } },
    },
  });
  if (!o) notFound();

  return (
    <RecordPage
      entity="Offer"
      entityLabel="Offer"
      recordTitle={`${o.debt.creditor?.account?.name ?? o.debt.creditorName}: $${o.amountOffered.toLocaleString()}`}
      recordSubtitle={
        <>
          {o.direction.replace(/_/g, " ")} · <StatusPill label={o.status} tone={genericTone(o.status)} />
        </>
      }
      highlights={[
        { label: "Amount", value: `$${o.amountOffered.toLocaleString()}` },
        { label: "Offer %", value: `${Math.round(o.percentOffered * 100)}%` },
        { label: "Direction", value: o.direction.replace(/_/g, " ") },
        { label: "Expires", value: o.expiresAt?.toLocaleDateString() },
        { label: "Created By", value: o.createdBy?.name },
      ]}
      actions={
        <HeaderActions
          buttons={[
            { label: "Edit" },
            ...(o.status === "PENDING" || o.status === "COUNTERED"
              ? [{ label: "Accept", primary: true }, { label: "Reject" }]
              : []),
          ]}
        />
      }
      details={
        <>
          <Section title="Offer Information">
            <FieldGrid
              fields={[
                ["Status", <StatusPill key="s" label={o.status} tone={genericTone(o.status)} />],
                ["Direction", o.direction.replace(/_/g, " ")],
                ["Amount Offered", `$${o.amountOffered.toLocaleString()}`],
                ["Percent Offered", `${Math.round(o.percentOffered * 100)}%`],
                ["Counter Amount", o.counterAmount ? `$${o.counterAmount.toLocaleString()}` : null],
                ["Expires", o.expiresAt?.toLocaleString()],
                ["Created By", o.createdBy?.name],
                ["Created At", o.createdAt.toLocaleString()],
              ]}
            />
            {o.termsNotes && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: "#706e6b", marginBottom: 4 }}>Terms / Notes</div>
                <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{o.termsNotes}</div>
              </div>
            )}
          </Section>

          <Section title="Related">
            <FieldGrid
              fields={[
                ["Creditor", o.debt.creditor?.account?.name && <Link key="c" href={`/accounts/${o.debt.creditor.account.id}`} style={{ color: "#1589ee" }}>{o.debt.creditor.account.name}</Link>],
                ["Debt — Original Balance", `$${o.debt.originalBalance.toLocaleString()}`],
                ["Opportunity", o.debt.opportunity && <Link key="op" href={`/opportunities/${o.debt.opportunity.id}`} style={{ color: "#1589ee" }}>{o.debt.opportunity.account?.name ?? o.debt.opportunity.id}</Link>],
                ["Settlement", o.settlement && <Link key="st" href={`/settlements/${o.settlement.id}`} style={{ color: "#1589ee" }}>${o.settlement.settledAmount.toLocaleString()} ({o.settlement.status})</Link>],
              ]}
            />
          </Section>

          {o.negotiations.length > 0 && (
            <Section title={`Negotiation Activity (${o.negotiations.length})`} defaultOpen={false}>
              {o.negotiations.map((n) => (
                <div key={n.id} style={{ fontSize: 13, padding: "8px 0", borderBottom: "1px solid #f3f3f3" }}>
                  <strong>{n.type}</strong> by {n.negotiator.name} on {n.date.toLocaleDateString()} — {n.response}
                  {n.notes && <div style={{ color: "#706e6b", marginTop: 4 }}>{n.notes}</div>}
                </div>
              ))}
            </Section>
          )}
        </>
      }
    />
  );
}
