import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecordPage } from "@/components/slds/record-page";
import { Section, FieldGrid } from "@/components/slds/section";
import { CaseHeaderButtons } from "@/components/cases/case-header-buttons";

/** SF shows enum-ish values in Title Case ("New", "High"), not raw enums. */
function titleCase(v: string | null | undefined): string | null {
  if (!v) return null;
  return v
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** SF datetime rendering on the case layout: 7/13/2026, 11:49 AM */
function sfDateTime(d: Date | null | undefined): string | null {
  if (!d) return null;
  const date = d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric", timeZone: "America/New_York" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/New_York" });
  return `${date}, ${time}`;
}

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await prisma.case.findUnique({
    where: { id },
    include: {
      account: { select: { id: true, name: true } },
      contact: { select: { id: true, fullName: true, email: true, phone: true } },
      draft: { select: { id: true, scheduledDate: true, amount: true, status: true } },
      owner: { select: { id: true, name: true, email: true } },
      ownerGroup: { select: { developerName: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      comments: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!c) notFound();

  let caseSf: Record<string, unknown> = {};
  try {
    caseSf = c.sfDataJson ? (JSON.parse(c.sfDataJson) as Record<string, unknown>) : {};
  } catch {
    /* empty */
  }
  const sfv = (k: string): string | null => {
    const v = caseSf[k];
    if (v == null || v === "") return null;
    return String(v);
  };

  const ownerDisplay = c.owner?.name ?? c.ownerGroup?.name ?? null;
  const ownerNode = c.owner ? (
    <Link href={`/settings/users/${c.owner.id}`} style={{ color: "#0176d3" }}>{c.owner.name}</Link>
  ) : (
    ownerDisplay
  );
  const accountNode = c.account ? (
    <Link href={`/accounts/${c.account.id}`} style={{ color: "#0176d3" }}>{c.account.name}</Link>
  ) : null;
  const draftNode = c.draft ? (
    <Link href={`/drafts/${c.draft.id}`} style={{ color: "#0176d3" }}>
      ${c.draft.amount.toLocaleString()} {c.draft.scheduledDate.toLocaleDateString()}
    </Link>
  ) : null;

  // Resolve the SF Opportunity__c lookup to our opportunity record.
  let opportunityNode: React.ReactNode = null;
  const oppSfId = sfv("Opportunity__c");
  if (oppSfId) {
    const opp = await prisma.opportunity.findUnique({ where: { sfId: oppSfId }, select: { id: true, name: true, recordType: true } });
    if (opp) {
      opportunityNode = (
        <Link href={`/opportunities/${opp.id}`} style={{ color: "#0176d3" }}>
          {opp.name ?? opp.recordType.replace(/_/g, " ")}
        </Link>
      );
    }
  }

  const priorityDisplay = sfv("Priority") ?? titleCase(c.priority);
  const statusDisplay = sfv("Status") ?? titleCase(c.status);
  const createdByDisplay = c.createdBy?.name
    ? `${c.createdBy.name}, ${sfDateTime(c.createdAt)}`
    : sfDateTime(c.createdAt);

  return (
    <RecordPage
      entity="Case"
      entityLabel="Case"
      recordTitle={c.subject}
      recordSubtitle={undefined}
      // SF case highlights: Priority | Status | Case Number — plain text.
      highlights={[
        { label: "Priority", value: priorityDisplay },
        { label: "Status", value: statusDisplay },
        { label: "Case Number", value: c.caseNumber },
      ]}
      actions={
        <CaseHeaderButtons
          caseId={c.id}
          caseNumber={c.caseNumber}
          currentOwner={ownerDisplay}
          editFields={[
            { label: "Subject", key: "subject", value: c.subject, required: true },
            { label: "Status", key: "status", type: "select", value: c.status, options: ["NEW", "OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "ESCALATED", "RESOLVED", "CLOSED"].map((v) => ({ value: v, label: titleCase(v) ?? v })) },
            { label: "Priority", key: "priority", type: "select", value: c.priority, options: ["LOW", "NORMAL", "HIGH", "URGENT"].map((v) => ({ value: v, label: titleCase(v) ?? v })) },
            { label: "Case Origin", key: "origin", type: "select", value: c.origin, options: ["PHONE", "EMAIL", "WEB", "CHAT", "OTHER"].map((v) => ({ value: v, label: titleCase(v) ?? v })) },
            { label: "Description", key: "description", type: "textarea", value: c.description },
          ]}
        />
      }
      // SF case layout in this org shows NO stage path.
      details={
        <>
          {/* SF Details: one flat two-column section (no headers). Left col then
              right col, interleaved row-major to match the SF pairing. */}
          <Section title="">
            <FieldGrid
              fields={[
                // Row 1: Case Number | Case Origin
                ["Case Number", c.caseNumber],
                ["Case Origin", sfv("Origin") ?? titleCase(c.origin)],
                // Row 2: Subject | Priority
                ["Subject", c.subject],
                ["Priority", priorityDisplay],
                // Row 3: Description | Status
                ["Description", c.description ? <div key="desc" style={{ whiteSpace: "pre-wrap" }}>{c.description}</div> : null],
                ["Status", statusDisplay],
                // Row 4: Account Name | Type
                ["Account Name", accountNode],
                ["Type", sfv("Type")],
                // Row 5: Contact Phone | Case Reason
                ["Contact Phone", sfv("ContactPhone") ?? c.contact?.phone ?? null],
                ["Case Reason", sfv("Reason")],
                // Row 6: Date/Time Opened | Case Record Type
                ["Date/Time Opened", sfDateTime(c.createdAt)],
                ["Case Record Type", titleCase(c.recordType)],
                // Row 7: Draft | Date/Time Closed
                ["Draft", draftNode],
                ["Date/Time Closed", sfDateTime(c.closedAt ?? c.resolvedAt)],
                // Row 8: Opportunity | Case Owner
                ["Opportunity", opportunityNode],
                ["Case Owner", ownerNode],
                // Row 9: Resolution | Last Modified By
                ["Resolution", sfv("Resolution__c")],
                ["Last Modified By", sfDateTime(c.updatedAt)],
                // Row 10: Resolution Summary | (blank)
                ["Resolution Summary", sfv("Resolution_Summary__c")],
                ["", null],
                // Row 11: Created By | (blank)
                ["Created By", createdByDisplay],
                ["", null],
              ]}
            />
          </Section>

          <Section title={`Case Comments (${c.comments.length})`} defaultOpen={c.comments.length > 0}>
            {c.comments.length === 0 ? (
              <div style={{ fontSize: 13, color: "#747474" }}>No comments yet.</div>
            ) : (
              <ul>
                {c.comments.map((cm) => (
                  <li key={cm.id} style={{ padding: "10px 0", borderBottom: "1px solid #f3f3f3" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 12 }}>{cm.author?.name ?? "(system)"}</span>
                      <span style={{ fontSize: 11, color: "#747474" }}>{cm.createdAt.toLocaleString()}</span>
                    </div>
                    <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{cm.body}</div>
                    {!cm.isInternal && (
                      <span style={{ fontSize: 11, color: "#0176d3" }}>Customer-visible</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      }
      // SF case page has NO right rail — the details card sits in the main
      // column with empty page background to its right.
      rail={<div />}
    />
  );
}
