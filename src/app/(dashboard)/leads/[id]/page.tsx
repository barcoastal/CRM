import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecordPage, StatusPill } from "@/components/slds/record-page";
import { Section, FieldGrid } from "@/components/slds/section";
import { ActivityChatterRail, type ChatterPost } from "@/components/slds/activity-chatter-rail";
import type { ActivityItem } from "@/components/slds/activity-rail";
import { LeadTabs } from "@/components/leads/lead-tabs";
import { LeadHeaderButtons } from "@/components/leads/lead-header-buttons";
import { PaymentCalculator } from "@/components/leads/payment-calculator";
import { DocumentsUpload } from "@/components/leads/documents-upload";
import { LeadRelated } from "@/components/leads/lead-related";
import { ConvertLeadButton } from "@/components/leads/convert-lead-button";
import { leadStatusTone } from "@/lib/slds/status-tones";
import { LEAD_STATUSES, type LeadStatusV2 } from "@/lib/sf-canonical";

const LEAD_PATH = LEAD_STATUSES.map((s) => ({ label: s }));

function leadPathIndex(status: string): number {
  const i = (LEAD_STATUSES as readonly string[]).indexOf(status);
  if (i >= 0) return i;
  const s = (status ?? "").toUpperCase().replace(/[_ ]+/g, "_");
  if (s === "CONVERTED" || s === "ENROLLED") return 3;
  if (s === "ARCHIVE_DISPOSITION" || s === "DNC" || s === "LOST" || s === "UNQUALIFIED") return 2;
  if (s === "WORKING_LEAD" || s === "CONTACTED" || s === "QUALIFIED" || s === "CALLBACK") return 1;
  return 0;
}

function currentStageOrDefault(status: string): LeadStatusV2 {
  return (LEAD_STATUSES as readonly string[]).includes(status)
    ? (status as LeadStatusV2)
    : "New";
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      calls: { include: { agent: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 20 },
      campaignContacts: { include: { campaign: { select: { id: true, name: true, status: true } } } },
      tasks: { orderBy: { createdAt: "desc" }, take: 50 },
      events: { orderBy: { startAt: "desc" }, take: 30 },
      emails: { orderBy: { createdAt: "desc" }, take: 20 },
      sms: { orderBy: { createdAt: "desc" }, take: 20 },
      paymentCalculations: { orderBy: { savedAt: "desc" }, take: 1 },
      history: {
        orderBy: { changedAt: "desc" },
        take: 100,
        include: { changedBy: { select: { name: true } } },
      },
      documents: {
        orderBy: { createdAt: "desc" },
        include: { uploadedBy: { select: { name: true } } },
      },
    },
  });
  if (!lead) notFound();

  const latestCalc = lead.paymentCalculations[0];

  const activity: ActivityItem[] = [
    ...lead.calls.map((c) => ({
      id: c.id,
      type: "CALL" as const,
      subject: `Call to ${c.phoneNumber}`,
      meta: `${c.disposition ?? "—"} · ${c.agent.name}`,
      date: c.startedAt,
      done: c.status === "COMPLETED",
    })),
    ...lead.tasks.map((t) => ({
      id: t.id,
      type: (t.type === "CALL" ? "CALL" : "TASK") as ActivityItem["type"],
      subject: t.subject,
      meta: t.outcome ?? t.disposition ?? null,
      date: t.dueDate ?? t.completedAt ?? t.createdAt,
      done: t.status === "COMPLETED",
    })),
    ...lead.events.map((e) => ({
      id: e.id,
      type: "EVENT" as const,
      subject: e.subject,
      meta: e.location ?? null,
      date: e.startAt,
      done: e.status === "COMPLETED",
    })),
    ...lead.emails.map((m) => ({
      id: m.id,
      type: "EMAIL" as const,
      subject: m.subject,
      meta: `${m.direction === "OUTBOUND" ? "To" : "From"} ${m.toAddresses}`,
      date: m.sentAt ?? m.createdAt,
      done: m.status === "DELIVERED" || m.status === "OPENED",
    })),
    ...lead.sms.map((m) => ({
      id: m.id,
      type: "SMS" as const,
      subject: m.body.slice(0, 80),
      meta: `${m.direction === "OUTBOUND" ? "→" : "←"} ${m.toNumber}`,
      date: m.sentAt ?? m.createdAt,
      done: m.status === "DELIVERED",
    })),
  ];

  const chatter: ChatterPost[] = lead.emails.map((m) => ({
    id: m.id,
    authorName: m.direction === "OUTBOUND" ? "You" : m.fromAddress,
    body: `${m.subject}\n\n${m.bodyText ?? m.bodyHtml?.replace(/<[^>]+>/g, "") ?? ""}`,
    createdAt: m.sentAt ?? m.createdAt,
  }));

  const converted =
    lead.convertedAccountId && lead.convertedContactId
      ? {
          accountId: lead.convertedAccountId,
          contactId: lead.convertedContactId,
          opportunityId: lead.convertedOpportunityId,
        }
      : undefined;

  const stage = currentStageOrDefault(lead.status);

  const details = (
    <>
      <ConvertLeadButton leadId={lead.id} converted={converted} />
      <Section title="Lead Information">
        <FieldGrid
          fields={[
            ["Business Name", lead.businessName],
            ["Contact Name", lead.contactName],
            ["Phone", lead.phone],
            ["Email", lead.email],
            ["EIN", lead.ein],
            ["Industry", lead.industry],
            ["Annual Revenue", lead.annualRevenue ? `$${lead.annualRevenue.toLocaleString()}` : null],
            ["Est. Total Debt", lead.totalDebtEst ? `$${lead.totalDebtEst.toLocaleString()}` : null],
            ["Lead Source", lead.source],
            ["Status", <StatusPill key="s" label={lead.status} tone={leadStatusTone(lead.status)} />],
            ["Owner", lead.assignedTo?.name],
            ["Last Contacted", lead.lastContactedAt?.toLocaleDateString()],
            ["Next Follow-up", lead.nextFollowUpAt?.toLocaleDateString()],
            ["Score", lead.score ? `${lead.score}/100` : null],
          ]}
        />
        {lead.scoreReason && (
          <div style={{ marginTop: 12, fontSize: 12, color: "#706e6b" }}>
            <strong>Score reason:</strong> {lead.scoreReason}
          </div>
        )}
      </Section>
      {lead.notes && (
        <Section title="Notes" defaultOpen={false}>
          <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{lead.notes}</div>
        </Section>
      )}
    </>
  );

  const debtInfo = (
    <Section title="Debt Information">
      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#fafaf9", borderBottom: "1px solid #d8dde6" }}>
            <th style={th}>Type</th>
            <th style={th}>Amount</th>
            <th style={th}>Frequency</th>
            <th style={th}>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#706e6b" }}>
              No debt information entered yet.
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "1px solid #d8dde6", background: "#fafaf9" }}>
            <td style={{ ...td, fontWeight: 700 }}>Total</td>
            <td style={{ ...td, fontWeight: 700 }}>$0.00</td>
            <td style={td} />
            <td style={td} />
          </tr>
        </tfoot>
      </table>
    </Section>
  );

  const calc = (
    <Section title="Payment Calculator">
      <PaymentCalculator
        leadId={lead.id}
        initial={
          latestCalc
            ? {
                totalDebt: latestCalc.totalDebt ?? "",
                setupFee: latestCalc.setupFee ?? "",
                serviceFee: latestCalc.serviceFee ?? "",
                monthlyBankFee: latestCalc.monthlyBankFee ?? "",
                settlementPercentage: latestCalc.settlementPercentage ?? "",
                programFeePercent: latestCalc.programFeePercent ?? "",
                programFeePeriod: latestCalc.programFeePeriod ?? "",
                retainerPercentage: latestCalc.retainerPercentage ?? "",
              }
            : undefined
        }
      />
    </Section>
  );

  const documents = (
    <Section title={`Files (${lead.documents.length})`}>
      <DocumentsUpload
        leadId={lead.id}
        items={lead.documents.map((d) => ({
          id: d.id,
          name: d.name,
          type: d.type,
          fileSize: d.fileSize,
          createdAt: d.createdAt.toISOString(),
          uploadedBy: d.uploadedBy ? { name: d.uploadedBy.name } : null,
        }))}
      />
    </Section>
  );

  const related = (
    <LeadRelated
      asyncOps={[]}
      files={lead.documents.map((d) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        createdAt: d.createdAt,
      }))}
      notes={
        lead.notes
          ? [{ id: "notes-1", title: "Notes", body: lead.notes, createdAt: lead.updatedAt }]
          : []
      }
      campaignHistory={lead.campaignContacts.map((c) => ({
        id: c.id,
        campaignName: c.campaign.name,
        status: c.status,
        responseDate: c.lastAttempt,
      }))}
      leadHistory={lead.history.map((h) => ({
        id: h.id,
        field: h.field,
        oldValue: h.oldValue,
        newValue: h.newValue,
        changedBy: h.changedBy,
        changedAt: h.changedAt,
      }))}
    />
  );

  const marketing = (
    <Section title="Marketing Attribution">
      <FieldGrid
        fields={[
          ["UTM Source", lead.utmSource],
          ["UTM Medium", lead.utmMedium],
          ["UTM Campaign", lead.utmCampaign],
          ["UTM Term", lead.utmTerm],
          ["UTM Content", lead.utmContent],
          ["Google Click ID", lead.gclid],
          ["Facebook Click ID", lead.fbclid],
          ["Eli Click ID", lead.eliClickId],
          ["Redtrack ID", lead.redtrackClickId],
        ]}
      />
    </Section>
  );

  return (
    <RecordPage
      entity="Lead"
      entityLabel="Lead"
      recordTitle={lead.contactName || lead.businessName}
      recordSubtitle={
        <>
          {lead.recordType.replace(/_/g, " ")} ·{" "}
          <StatusPill label={lead.status} tone={leadStatusTone(lead.status)} />
        </>
      }
      highlights={[
        { label: "Title", value: null },
        { label: "Company", value: lead.businessName },
        { label: "Phone (2)", value: lead.phone },
        { label: "Email", value: lead.email },
        { label: "Lead Id", value: lead.id.slice(-8).toUpperCase() },
      ]}
      actions={<LeadHeaderButtons leadId={lead.id} currentStage={stage} />}
      pathStages={LEAD_PATH}
      pathCurrentIndex={Math.max(0, leadPathIndex(lead.status))}
      pathActionLabel={converted ? "Converted" : "Mark Status as Complete"}
      details={
        <LeadTabs
          panels={{
            Details: details,
            "Debt Information": debtInfo,
            "Payment Calculator": calc,
            Documents: documents,
            Related: related,
            Marketing: marketing,
          }}
        />
      }
      rail={<ActivityChatterRail activities={activity} chatter={chatter} />}
    />
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  fontWeight: 700,
  fontSize: 12,
  color: "#3e3e3c",
  textTransform: "uppercase",
  letterSpacing: 0.3,
};
const td: React.CSSProperties = {
  padding: "10px 12px",
  color: "#080707",
};
