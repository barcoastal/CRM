import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecordPage, HeaderActions, StatusPill } from "@/components/slds/record-page";
import { Section, FieldGrid } from "@/components/slds/section";
import { ActivityRail, type ActivityItem } from "@/components/slds/activity-rail";
import { RelatedList } from "@/components/slds/related-list";
import { opportunityStageTone, draftStatusTone, settlementStatusTone, genericTone } from "@/lib/slds/status-tones";

const OPP_STAGES = [
  { label: "Working Opportunity" },
  { label: "Contract Sent" },
  { label: "Contract Signed" },
  { label: "First Payment" },
  { label: "Closed Won" },
];

function oppStageIndex(stage: string): number {
  const s = stage.toUpperCase();
  if (s.includes("CLOSED") && s.includes("WON")) return 4;
  if (s.includes("FIRST PAYMENT") || s.includes("FIRST_PAYMENT")) return 3;
  if (s.includes("CONTRACT") && s.includes("SIGNED")) return 2;
  if (s.includes("CONTRACT") && s.includes("SENT")) return 1;
  return 0;
}

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opp = await prisma.opportunity.findUnique({
    where: { id },
    include: {
      lead: { select: { id: true, businessName: true, contactName: true, phone: true, email: true } },
      account: { select: { id: true, name: true, recordType: true } },
      primaryContact: { select: { id: true, fullName: true } },
      assignedTo: { select: { id: true, name: true } },
      client: true,
      debts: {
        include: {
          creditor: { include: { account: { select: { name: true } } } },
          offers: { include: { settlement: true }, orderBy: { createdAt: "desc" } },
          settlement: true,
          negotiations: { include: { negotiator: { select: { id: true, name: true } } }, orderBy: { date: "desc" } },
        },
        orderBy: { createdAt: "desc" },
      },
      programPlans: {
        include: {
          processor: { select: { name: true, code: true } },
          _count: { select: { drafts: true, fees: true } },
        },
        orderBy: { startDate: "desc" },
      },
      documents: { include: { uploadedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
      tasks: { orderBy: { dueDate: "asc" }, take: 30 },
      events: { orderBy: { startAt: "desc" }, take: 30 },
      emails: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!opp) notFound();

  const activity: ActivityItem[] = [
    ...opp.tasks.map((t) => ({
      id: t.id, type: (t.type === "CALL" ? "CALL" : "TASK") as ActivityItem["type"], subject: t.subject,
      meta: t.outcome ?? null, date: t.dueDate ?? t.completedAt ?? t.createdAt, done: t.status === "COMPLETED",
    })),
    ...opp.events.map((e) => ({
      id: e.id, type: "EVENT" as const, subject: e.subject,
      meta: e.location ?? null, date: e.startAt, done: e.status === "COMPLETED",
    })),
    ...opp.emails.map((m) => ({
      id: m.id, type: "EMAIL" as const, subject: m.subject,
      meta: m.toAddresses, date: m.sentAt ?? m.createdAt, done: m.status === "DELIVERED",
    })),
  ];

  return (
    <RecordPage
      entity="Opportunity"
      entityLabel="Opportunity"
      recordTitle={opp.account?.name ?? opp.lead?.businessName ?? "(unnamed)"}
      recordSubtitle={
        <>
          {opp.recordType.replace(/_/g, " ")} ·{" "}
          <StatusPill label={opp.stage} tone={opportunityStageTone(opp.stage)} />
        </>
      }
      highlights={[
        { label: "Account", value: opp.account?.name ? <Link href={`/accounts/${opp.account.id}`} style={{ color: "#1589ee" }}>{opp.account.name}</Link> : null },
        { label: "Primary Contact", value: opp.primaryContact?.fullName },
        { label: "Total Debt", value: opp.totalDebt ? `$${opp.totalDebt.toLocaleString()}` : null },
        { label: "Close Date", value: opp.expectedCloseDate?.toLocaleDateString() },
        { label: "Owner", value: opp.assignedTo?.name },
      ]}
      actions={
        <HeaderActions
          buttons={[
            { label: "+ Follow" },
            { label: "Edit", href: `/opportunities/${opp.id}/edit` },
            { label: "Disposition" },
            { label: "Send Contract" },
          ]}
        />
      }
      pathStages={OPP_STAGES}
      pathCurrentIndex={oppStageIndex(opp.stage)}
      pathActionLabel="Change Closed Stage"
      details={
        <>
          <Section title="Opportunity Information">
            <FieldGrid
              fields={[
                ["Account", opp.account?.name && (
                  <Link href={`/accounts/${opp.account.id}`} style={{ color: "#1589ee" }}>{opp.account.name}</Link>
                )],
                ["Product", opp.recordType.replace(/_/g, " ")],
                ["Stage", <StatusPill key="s" label={opp.stage} tone={opportunityStageTone(opp.stage)} />],
                ["Total Debt", opp.totalDebt ? `$${opp.totalDebt.toLocaleString()}` : null],
                ["Expected Close", opp.expectedCloseDate?.toLocaleDateString()],
                ["Primary Contact", opp.primaryContact?.fullName],
                ["Owner", opp.assignedTo?.name],
                ["Lead Source", opp.lead?.businessName ? `Lead: ${opp.lead.contactName}` : null],
              ]}
            />
            {opp.notes && (
              <div style={{ marginTop: 12, fontSize: 13, whiteSpace: "pre-wrap", color: "#080707" }}>
                {opp.notes}
              </div>
            )}
          </Section>

          {opp.debts.length > 0 && (
            <Section title={`Debt Details (${opp.debts.length})`}>
              <table style={{ width: "100%", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #ecebea" }}>
                    <th style={th}>Creditor</th>
                    <th style={th}>Account #</th>
                    <th style={{ ...th, textAlign: "right" }}>Original</th>
                    <th style={{ ...th, textAlign: "right" }}>Current</th>
                    <th style={th}>Status</th>
                    <th style={th}>Offers</th>
                  </tr>
                </thead>
                <tbody>
                  {opp.debts.map((d) => (
                    <tr key={d.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                      <td style={td}>{d.creditor?.account?.name ?? d.creditorName}</td>
                      <td style={td}>{d.accountNumber ?? "—"}</td>
                      <td style={{ ...td, textAlign: "right" }}>${d.originalBalance.toLocaleString()}</td>
                      <td style={{ ...td, textAlign: "right" }}>${d.currentBalance.toLocaleString()}</td>
                      <td style={td}><StatusPill label={d.status} tone={genericTone(d.status)} /></td>
                      <td style={td}>{d.offers.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {opp.programPlans.length > 0 && (
            <Section title={`Program Plans (${opp.programPlans.length})`}>
              <table style={{ width: "100%", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #ecebea" }}>
                    <th style={th}>Product</th>
                    <th style={th}>Status</th>
                    <th style={{ ...th, textAlign: "right" }}>Monthly</th>
                    <th style={{ ...th, textAlign: "right" }}>Term</th>
                    <th style={th}>Processor</th>
                    <th style={th}>Drafts</th>
                  </tr>
                </thead>
                <tbody>
                  {opp.programPlans.map((p) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                      <td style={td}><Link href={`/program-plans/${p.id}`} style={{ color: "#1589ee" }}>{p.recordType.replace(/_/g, " ")}</Link></td>
                      <td style={td}><StatusPill label={p.status} tone={genericTone(p.status)} /></td>
                      <td style={{ ...td, textAlign: "right" }}>${p.monthlyAmount.toLocaleString()}</td>
                      <td style={{ ...td, textAlign: "right" }}>{p.termMonths}mo</td>
                      <td style={td}>{p.processor?.name ?? "—"}</td>
                      <td style={td}>{p._count.drafts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {opp.documents.length > 0 && (
            <Section title={`Documents (${opp.documents.length})`} defaultOpen={false}>
              <ul style={{ fontSize: 13 }}>
                {opp.documents.map((doc) => (
                  <li key={doc.id} style={{ padding: "6px 0", borderBottom: "1px solid #f3f3f3" }}>
                    <span style={{ color: "#1589ee" }}>{doc.name}</span>
                    <span style={{ color: "#706e6b", marginLeft: 8 }}>· {doc.type} · {doc.uploadedBy.name}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      }
      rail={
        <>
          {/* Offers / Settlements aggregate from debts */}
          {opp.debts.some((d) => d.offers.length > 0) && (
            <RelatedList
              entity="Offer"
              title="Offers"
              items={opp.debts.flatMap((d) => d.offers.map((o) => ({ ...o, debt: d })))}
              renderItem={(o) => (
                <div>
                  <div style={{ fontSize: 12, color: "#080707", fontWeight: 600 }}>
                    {o.debt.creditor?.account?.name ?? o.debt.creditorName}: ${o.amountOffered.toLocaleString()} ({Math.round(o.percentOffered * 100)}%)
                  </div>
                  <StatusPill label={o.status} tone={genericTone(o.status)} />
                </div>
              )}
              emptyHint="No offers yet."
            />
          )}
          {opp.debts.some((d) => d.settlement) && (
            <RelatedList
              entity="Settlement"
              title="Settlements"
              items={opp.debts.filter((d) => d.settlement).map((d) => ({ ...d.settlement!, debt: d }))}
              renderItem={(s) => (
                <div>
                  <div style={{ fontSize: 12, color: "#080707", fontWeight: 600 }}>
                    {s.debt.creditor?.account?.name ?? s.debt.creditorName}
                  </div>
                  <div style={{ fontSize: 11, color: "#706e6b" }}>
                    Settled ${s.settledAmount.toLocaleString()} ({Math.round(s.savingsPercent * 100)}% savings)
                  </div>
                  <StatusPill label={s.status} tone={settlementStatusTone(s.status)} />
                </div>
              )}
              emptyHint=""
            />
          )}
          <ActivityRail items={activity} />
        </>
      }
    />
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 4px",
  fontSize: 11,
  color: "#3e3e3c",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};
const td: React.CSSProperties = { padding: "8px 4px", verticalAlign: "middle" };
