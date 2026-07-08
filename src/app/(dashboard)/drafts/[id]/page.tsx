import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecordPage, HeaderActions, StatusPill } from "@/components/slds/record-page";
import { Section, FieldGrid } from "@/components/slds/section";
import { draftStatusTone } from "@/lib/slds/status-tones";

const DRAFT_PATH = [
  { label: "Scheduled" },
  { label: "Processing" },
  { label: "Success" },
];
const DRAFT_PATH_INDEX: Record<string, number> = {
  SCHEDULED: 0, PROCESSING: 1, SUCCESS: 2, FAILED: 1, RETRYING: 1, CANCELLED: -1,
};

export default async function DraftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await prisma.draft.findUnique({
    where: { id },
    include: {
      programPlan: { include: { account: { select: { id: true, name: true } } } },
      debitSchedule: true,
      parentDraft: true,
      retries: true,
      cases: { include: { owner: { select: { id: true, name: true } } } },
    },
  });
  if (!d) notFound();

  return (
    <RecordPage
      entity="Draft"
      entityLabel="Draft"
      recordTitle={`$${d.amount.toLocaleString()} — ${d.scheduledDate.toLocaleDateString()}`}
      recordSubtitle={<StatusPill label={d.status} tone={draftStatusTone(d.status)} />}
      highlights={[
        { label: "Account", value: <Link href={`/accounts/${d.programPlan.account.id}`} style={{ color: "#0176d3" }}>{d.programPlan.account.name}</Link> },
        { label: "Amount", value: `$${d.amount.toLocaleString()}` },
        { label: "Attempt", value: `${d.attemptNumber}/${d.maxAttempts}` },
        { label: "Scheduled", value: d.scheduledDate.toLocaleDateString() },
        { label: "Return Code", value: d.returnCode },
      ]}
      actions={
        <HeaderActions
          buttons={[
            { label: "Edit" },
            ...(d.status === "FAILED" ? [{ label: "Retry", primary: true }] : []),
            ...(d.status === "SCHEDULED" ? [{ label: "Cancel" }] : []),
          ]}
        />
      }
      pathStages={DRAFT_PATH}
      pathCurrentIndex={Math.max(0, DRAFT_PATH_INDEX[d.status] ?? 0)}
      details={
        <>
          <Section title="Draft Information">
            <FieldGrid
              fields={[
                ["Status", <StatusPill key="s" label={d.status} tone={draftStatusTone(d.status)} />],
                ["Amount", `$${d.amount.toLocaleString()}`],
                ["Scheduled Date", d.scheduledDate.toLocaleString()],
                ["Attempt", `${d.attemptNumber} of ${d.maxAttempts}`],
                ["Processed At", d.processedAt?.toLocaleString()],
                ["Settled At", d.settledAt?.toLocaleString()],
                ["Return Code", d.returnCode],
                ["Return Reason", d.returnReason],
                ["Processor Ref", d.processorReference],
                ["Program Plan", <Link key="pp" href={`/program-plans/${d.programPlan.id}`} style={{ color: "#0176d3" }}>{d.programPlan.recordType}</Link>],
                ["Debit Schedule", d.debitSchedule ? `${d.debitSchedule.frequency} · day ${d.debitSchedule.dayOfMonth ?? "—"}` : null],
                ["Parent Draft", d.parentDraft ? `Attempt ${d.parentDraft.attemptNumber}` : null],
              ]}
            />
            {d.notes && <div style={{ marginTop: 12, fontSize: 13, whiteSpace: "pre-wrap" }}>{d.notes}</div>}
          </Section>

          {d.retries.length > 0 && (
            <Section title={`Retry Attempts (${d.retries.length})`}>
              {d.retries.map((r) => (
                <div key={r.id} style={{ fontSize: 13, padding: "8px 0", borderBottom: "1px solid #f3f3f3" }}>
                  <Link href={`/drafts/${r.id}`} style={{ color: "#0176d3" }}>
                    Attempt {r.attemptNumber}
                  </Link>
                  {" — "}{r.scheduledDate.toLocaleDateString()} · <StatusPill label={r.status} tone={draftStatusTone(r.status)} />
                </div>
              ))}
            </Section>
          )}

          {d.cases.length > 0 && (
            <Section title={`Related Cases (${d.cases.length})`} defaultOpen={false}>
              {d.cases.map((c) => (
                <div key={c.id} style={{ fontSize: 13, padding: "6px 0", borderBottom: "1px solid #f3f3f3" }}>
                  <Link href={`/cases/${c.id}`} style={{ color: "#0176d3", fontWeight: 600 }}>
                    {c.caseNumber}
                  </Link>
                  {" — "}{c.subject} · {c.status}
                </div>
              ))}
            </Section>
          )}
        </>
      }
    />
  );
}
