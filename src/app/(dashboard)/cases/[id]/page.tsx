import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecordPage, HeaderActions, StatusPill } from "@/components/slds/record-page";
import { Section, FieldGrid } from "@/components/slds/section";
import { caseStatusTone } from "@/lib/slds/status-tones";

const CASE_PATH = [
  { label: "New" },
  { label: "In Progress" },
  { label: "Escalated" },
  { label: "Resolved" },
];
function casePathIndex(status: string): number {
  if (status === "RESOLVED" || status === "CLOSED") return 3;
  if (status === "ESCALATED") return 2;
  if (status === "IN_PROGRESS" || status === "WAITING_ON_CUSTOMER" || status === "OPEN") return 1;
  return 0;
}

const PRIORITY_TONE: Record<string, "danger" | "warning" | "info" | "neutral"> = {
  URGENT: "danger", HIGH: "warning", NORMAL: "info", LOW: "neutral",
};

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await prisma.case.findUnique({
    where: { id },
    include: {
      account: { select: { id: true, name: true } },
      contact: { select: { id: true, fullName: true } },
      programPlan: { select: { id: true, recordType: true, status: true } },
      draft: { select: { id: true, scheduledDate: true, amount: true, status: true } },
      owner: { select: { id: true, name: true, email: true } },
      ownerGroup: { select: { developerName: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      comments: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!c) notFound();

  return (
    <RecordPage
      entity="Case"
      entityLabel="Case"
      recordTitle={c.subject}
      recordSubtitle={
        <>
          {c.caseNumber} · {c.recordType.replace(/_/g, " ")} ·{" "}
          <StatusPill label={c.priority} tone={PRIORITY_TONE[c.priority] ?? "neutral"} /> ·{" "}
          <StatusPill label={c.status} tone={caseStatusTone(c.status)} />
        </>
      }
      highlights={[
        { label: "Account", value: c.account?.name && <Link href={`/accounts/${c.account.id}`} style={{ color: "#1589ee" }}>{c.account.name}</Link> },
        { label: "Contact", value: c.contact?.fullName },
        { label: "Owner", value: c.owner?.name ?? c.ownerGroup?.name ?? "(unassigned)" },
        { label: "Level", value: c.escalationLevel },
        { label: "SLA Due", value: c.slaDueAt?.toLocaleDateString() },
      ]}
      actions={
        <HeaderActions
          buttons={[
            { label: "Edit" },
            { label: "Escalate" },
            { label: "Close Case", primary: true },
          ]}
        />
      }
      pathStages={CASE_PATH}
      pathCurrentIndex={casePathIndex(c.status)}
      pathActionLabel="Mark Status as Complete"
      details={
        <>
          <Section title="Case Information">
            <FieldGrid
              fields={[
                ["Case Number", c.caseNumber],
                ["Subject", c.subject],
                ["Type", c.recordType.replace(/_/g, " ")],
                ["Status", <StatusPill key="s" label={c.status} tone={caseStatusTone(c.status)} />],
                ["Priority", <StatusPill key="p" label={c.priority} tone={PRIORITY_TONE[c.priority] ?? "neutral"} />],
                ["Origin", c.origin],
                ["Escalation Level", c.escalationLevel],
                ["Created", c.createdAt.toLocaleString()],
                ["First Response", c.firstResponseAt?.toLocaleString()],
                ["SLA Due", c.slaDueAt?.toLocaleString()],
                ["Resolved", c.resolvedAt?.toLocaleString()],
                ["Closed", c.closedAt?.toLocaleString()],
              ]}
            />
            {c.description && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: "#706e6b", fontWeight: 400, marginBottom: 4 }}>Description</div>
                <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{c.description}</div>
              </div>
            )}
          </Section>

          {c.requiresApproval && (
            <Section title="Approval">
              <FieldGrid
                fields={[
                  ["Requires Approval", "Yes"],
                  ["Approved By", c.approvedBy?.name],
                  ["Approved At", c.approvedAt?.toLocaleString()],
                  ["Notes", c.approvalNotes],
                ]}
              />
            </Section>
          )}

          <Section title={`Case Comments (${c.comments.length})`}>
            {c.comments.length === 0 ? (
              <div style={{ fontSize: 13, color: "#706e6b" }}>No comments yet.</div>
            ) : (
              <ul>
                {c.comments.map((cm) => (
                  <li key={cm.id} style={{ padding: "10px 0", borderBottom: "1px solid #f3f3f3" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 12 }}>{cm.author?.name ?? "(system)"}</span>
                      <span style={{ fontSize: 11, color: "#706e6b" }}>{cm.createdAt.toLocaleString()}</span>
                    </div>
                    <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{cm.body}</div>
                    {!cm.isInternal && (
                      <span style={{ fontSize: 11, color: "#0070d2" }}>Customer-visible</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      }
      rail={
        <>
          <Section title="Related">
            <FieldGrid
              fields={[
                ["Account", c.account?.name && <Link key="a" href={`/accounts/${c.account.id}`} style={{ color: "#1589ee" }}>{c.account.name}</Link>],
                ["Contact", c.contact?.fullName],
                ["Program Plan", c.programPlan && <Link key="pp" href={`/program-plans/${c.programPlan.id}`} style={{ color: "#1589ee" }}>{c.programPlan.recordType.replace(/_/g, " ")}</Link>],
                ["Draft", c.draft && <Link key="d" href={`/drafts/${c.draft.id}`} style={{ color: "#1589ee" }}>${c.draft.amount.toLocaleString()} {c.draft.scheduledDate.toLocaleDateString()}</Link>],
                ["Created By", c.createdBy?.name],
              ]}
            />
          </Section>
        </>
      }
    />
  );
}
