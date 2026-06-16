import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecordPage, HeaderActions, StatusPill } from "@/components/slds/record-page";
import { Section, FieldGrid } from "@/components/slds/section";
import { caseStatusTone } from "@/lib/slds/status-tones";
import { PathSidePanelServer } from "@/components/path/path-side-panel-server";

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

/** Map a Case status enum to the matching path stage label used by PathGuidance. */
function caseStageLabel(status: string): string {
  if (status === "RESOLVED" || status === "CLOSED") return "Resolved";
  if (status === "ESCALATED") return "Escalated";
  if (status === "IN_PROGRESS" || status === "WAITING_ON_CUSTOMER" || status === "OPEN") return "In Progress";
  return "New";
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
      contact: { select: { id: true, fullName: true, email: true } },
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

  const ownerDisplay = c.owner?.name ?? c.ownerGroup?.name ?? null;
  const escalatedDisplay = c.status === "ESCALATED" ? "Yes" : "No";
  const contactNode = c.contact?.fullName ? (
    <Link key="ct" href={`/contacts/${c.contact.id}`} style={{ color: "#1589ee" }}>{c.contact.fullName}</Link>
  ) : null;

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
        { label: "Owner", value: ownerDisplay ?? "(unassigned)" },
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
          <PathSidePanelServer
            entityType="Case"
            stage={caseStageLabel(c.status)}
            record={c as unknown as Record<string, unknown>}
          />

          {/* SF Case Layout - Description Information (single column) */}
          <Section title="Description Information">
            <FieldGrid
              columns={1}
              fields={[
                ["Subject", c.subject],
                ["Description", c.description ? (
                  <div key="desc" style={{ whiteSpace: "pre-wrap" }}>{c.description}</div>
                ) : null],
              ]}
            />
          </Section>

          {/* SF Case Layout - Case Information (two-column top-to-bottom).
              Left col fields, then right col fields, interleaved row by row. */}
          <Section title="Case Information">
            <FieldGrid
              fields={[
                // Row 1: Owner | Status
                ["Owner", ownerDisplay],
                ["Status", <StatusPill key="s" label={c.status} tone={caseStatusTone(c.status)} />],
                // Row 2: Case Reason | Case Origin
                ["Case Reason", null],
                ["Case Origin", c.origin],
                // Row 3: Component | Priority
                ["Component", null],
                ["Priority", <StatusPill key="p" label={c.priority} tone={PRIORITY_TONE[c.priority] ?? "neutral"} />],
                // Row 4: Escalated | Assigned To
                ["Escalated", escalatedDisplay],
                ["Assigned To", null],
                // Row 5: Resolution | (empty)
                ["Resolution", null],
                ["", null],
                // Row 6: Resolution Summary | (empty)
                ["Resolution Summary", null],
                ["", null],
              ]}
            />
          </Section>

          {/* SF Case Layout - Additional Information */}
          <Section title="Additional Information">
            <FieldGrid
              fields={[
                ["Internal Comments", c.comments.length > 0 ? `${c.comments.length} comment${c.comments.length === 1 ? "" : "s"}` : null],
                ["", null],
              ]}
            />
          </Section>

          {/* SF Case Layout - Web Information */}
          <Section title="Web Information">
            <FieldGrid
              fields={[
                ["Web Email", c.contact?.email ?? null],
                ["Contact Name", contactNode],
              ]}
            />
          </Section>

          {/* SF Case Layout - System Information */}
          <Section title="System Information">
            <FieldGrid
              fields={[
                ["Created By", c.createdBy?.name ? `${c.createdBy.name}, ${c.createdAt.toLocaleString()}` : c.createdAt.toLocaleString()],
                ["Last Modified By", c.updatedAt.toLocaleString()],
              ]}
            />
          </Section>

          {/* CRM-native: SLA + lifecycle timestamps not in SF layout but useful */}
          <Section title="SLA & Lifecycle" defaultOpen={false}>
            <FieldGrid
              fields={[
                ["Case Number", c.caseNumber],
                ["Type", c.recordType.replace(/_/g, " ")],
                ["Escalation Level", c.escalationLevel],
                ["First Response", c.firstResponseAt?.toLocaleString() ?? null],
                ["SLA Due", c.slaDueAt?.toLocaleString() ?? null],
                ["Resolved", c.resolvedAt?.toLocaleString() ?? null],
                ["Closed", c.closedAt?.toLocaleString() ?? null],
              ]}
            />
          </Section>

          {c.requiresApproval && (
            <Section title="Approval">
              <FieldGrid
                fields={[
                  ["Requires Approval", "Yes"],
                  ["Approved By", c.approvedBy?.name ?? null],
                  ["Approved At", c.approvedAt?.toLocaleString() ?? null],
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
                ["Account", c.account?.name ? <Link key="a" href={`/accounts/${c.account.id}`} style={{ color: "#1589ee" }}>{c.account.name}</Link> : null],
                ["Contact", c.contact?.fullName ?? null],
                ["Program Plan", c.programPlan ? <Link key="pp" href={`/program-plans/${c.programPlan.id}`} style={{ color: "#1589ee" }}>{c.programPlan.recordType.replace(/_/g, " ")}</Link> : null],
                ["Draft", c.draft ? <Link key="d" href={`/drafts/${c.draft.id}`} style={{ color: "#1589ee" }}>${c.draft.amount.toLocaleString()} {c.draft.scheduledDate.toLocaleDateString()}</Link> : null],
                ["Created By", c.createdBy?.name ?? null],
              ]}
            />
          </Section>
        </>
      }
    />
  );
}
