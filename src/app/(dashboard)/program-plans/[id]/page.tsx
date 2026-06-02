import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecordPage, HeaderActions, StatusPill } from "@/components/slds/record-page";
import { Section, FieldGrid } from "@/components/slds/section";
import { programPlanStatusTone, draftStatusTone, genericTone } from "@/lib/slds/status-tones";

const PLAN_PATH = [
  { label: "Proposed" },
  { label: "Active" },
  { label: "Paused" },
  { label: "Completed" },
];
const PLAN_PATH_INDEX: Record<string, number> = {
  PROPOSED: 0, ACTIVE: 1, PAUSED: 2, COMPLETED: 3, CANCELLED: -1,
};

export default async function ProgramPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await prisma.programPlan.findUnique({
    where: { id },
    include: {
      account: { select: { id: true, name: true } },
      opportunity: { select: { id: true, recordType: true } },
      processor: true,
      assignedTo: { select: { id: true, name: true } },
      debts: { include: { creditor: { include: { account: { select: { name: true } } } } } },
      debitSchedules: true,
      drafts: { orderBy: { scheduledDate: "desc" }, take: 50 },
      fees: { orderBy: { chargedDate: "desc" }, take: 50 },
    },
  });
  if (!p) notFound();

  return (
    <RecordPage
      entity="ProgramPlan"
      entityLabel="Program Plan"
      recordTitle={`${p.account.name} — ${p.recordType.replace(/_/g, " ")}`}
      recordSubtitle={<StatusPill label={p.status} tone={programPlanStatusTone(p.status)} />}
      highlights={[
        { label: "Account", value: <Link href={`/accounts/${p.account.id}`} style={{ color: "#1589ee" }}>{p.account.name}</Link> },
        { label: "Monthly", value: `$${p.monthlyAmount.toLocaleString()}` },
        { label: "Term", value: `${p.termMonths}mo` },
        { label: "Total Debt", value: p.totalEnrolledDebt ? `$${p.totalEnrolledDebt.toLocaleString()}` : null },
        { label: "Processor", value: p.processor?.name },
      ]}
      actions={<HeaderActions buttons={[{ label: "Edit" }, { label: "Add Draft" }, { label: "Charge Fee" }]} />}
      pathStages={PLAN_PATH}
      pathCurrentIndex={Math.max(0, PLAN_PATH_INDEX[p.status] ?? 0)}
      details={
        <>
          <Section title="Program Plan Information">
            <FieldGrid
              fields={[
                ["Account", <Link key="a" href={`/accounts/${p.account.id}`} style={{ color: "#1589ee" }}>{p.account.name}</Link>],
                ["Product", p.recordType.replace(/_/g, " ")],
                ["Status", <StatusPill key="s" label={p.status} tone={programPlanStatusTone(p.status)} />],
                ["Start Date", p.startDate.toLocaleDateString()],
                ["Term", `${p.termMonths} months`],
                ["Monthly Amount", `$${p.monthlyAmount.toLocaleString()}`],
                ["Total Enrolled Debt", p.totalEnrolledDebt ? `$${p.totalEnrolledDebt.toLocaleString()}` : null],
                ["Processor", p.processor?.name],
                ["Bank Account (last 4)", p.bankAccountLast4],
                ["Routing (last 4)", p.bankRoutingLast4],
                ["Signed Date", p.signedDate?.toLocaleDateString()],
                ["Assigned To", p.assignedTo?.name],
              ]}
            />
            {p.notes && <div style={{ marginTop: 12, fontSize: 13, whiteSpace: "pre-wrap" }}>{p.notes}</div>}
          </Section>

          {p.debts.length > 0 && (
            <Section title={`Debts (${p.debts.length})`}>
              <table style={{ width: "100%", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #ecebea" }}>
                    <th style={th}>Creditor</th>
                    <th style={{ ...th, textAlign: "right" }}>Original</th>
                    <th style={{ ...th, textAlign: "right" }}>Current</th>
                    <th style={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {p.debts.map((d) => (
                    <tr key={d.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                      <td style={td}>{d.creditor?.account?.name ?? d.creditorName}</td>
                      <td style={{ ...td, textAlign: "right" }}>${d.originalBalance.toLocaleString()}</td>
                      <td style={{ ...td, textAlign: "right" }}>${d.currentBalance.toLocaleString()}</td>
                      <td style={td}><StatusPill label={d.status} tone={genericTone(d.status)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {p.drafts.length > 0 && (
            <Section title={`Drafts (${p.drafts.length})`}>
              <table style={{ width: "100%", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #ecebea" }}>
                    <th style={th}>Scheduled</th>
                    <th style={{ ...th, textAlign: "right" }}>Amount</th>
                    <th style={th}>Status</th>
                    <th style={th}>Attempt</th>
                    <th style={th}>Return Code</th>
                  </tr>
                </thead>
                <tbody>
                  {p.drafts.map((d) => (
                    <tr key={d.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                      <td style={td}><Link href={`/drafts/${d.id}`} style={{ color: "#1589ee" }}>{d.scheduledDate.toLocaleDateString()}</Link></td>
                      <td style={{ ...td, textAlign: "right" }}>${d.amount.toLocaleString()}</td>
                      <td style={td}><StatusPill label={d.status} tone={draftStatusTone(d.status)} /></td>
                      <td style={td}>{d.attemptNumber}/{d.maxAttempts}</td>
                      <td style={td}>{d.returnCode ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {p.fees.length > 0 && (
            <Section title={`Fees (${p.fees.length})`} defaultOpen={false}>
              <table style={{ width: "100%", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #ecebea" }}>
                    <th style={th}>Type</th>
                    <th style={th}>Date</th>
                    <th style={{ ...th, textAlign: "right" }}>Amount</th>
                    <th style={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {p.fees.map((f) => (
                    <tr key={f.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                      <td style={td}>{f.recordType.replace(/_/g, " ")}</td>
                      <td style={td}>{f.chargedDate.toLocaleDateString()}</td>
                      <td style={{ ...td, textAlign: "right" }}>${f.amount.toLocaleString()}</td>
                      <td style={td}><StatusPill label={f.status} tone={genericTone(f.status)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {p.debitSchedules.length > 0 && (
            <Section title="Debit Schedule" defaultOpen={false}>
              {p.debitSchedules.map((s) => (
                <div key={s.id} style={{ fontSize: 13, padding: "8px 0", borderBottom: "1px solid #f3f3f3" }}>
                  {s.frequency} · ${s.amount.toLocaleString()} · day {s.dayOfMonth ?? "—"} · next run {s.nextRunDate?.toLocaleDateString() ?? "—"}
                </div>
              ))}
            </Section>
          )}
        </>
      }
    />
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "8px 4px", fontSize: 11, color: "#3e3e3c", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 };
const td: React.CSSProperties = { padding: "8px 4px", verticalAlign: "middle" };
