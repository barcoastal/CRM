import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecordPage, StatusPill } from "@/components/slds/record-page";
import { Section, FieldGrid } from "@/components/slds/section";
import { ActivityChatterRail, type ChatterPost } from "@/components/slds/activity-chatter-rail";
import type { ActivityItem } from "@/components/slds/activity-rail";
import { LeadTabs } from "@/components/leads/lead-tabs";
import { LeadHeaderButtons } from "@/components/leads/lead-header-buttons";
import { PaymentCalculatorV2 } from "@/components/shared/payment-calculator-v2";
import { DocumentsUpload } from "@/components/leads/documents-upload";
import { DebtInformation } from "@/components/leads/debt-information";
import { LeadRelated } from "@/components/leads/lead-related";
import { SfDataSection } from "@/components/slds/sf-data-section";
import { ConvertLeadButton } from "@/components/leads/convert-lead-button";
import { CallButton } from "@/components/dialer/call-button";
import { ComposeEmailButton } from "@/components/emails/compose-email-button";
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
      debts: { orderBy: { createdAt: "asc" } },
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
            ["Phone", <span key="ph" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{lead.phone}<CallButton phone={lead.phone} leadId={lead.id} /></span>],
            ["Email", <span key="em" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{lead.email}{lead.email && <ComposeEmailButton defaultTo={lead.email} leadId={lead.id} label="Email" />}</span>],
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
    <Section title={`Debt Information (${lead.debts.length})`}>
      <DebtInformation
        leadId={lead.id}
        items={lead.debts.map((d) => ({
          id: d.id,
          type: d.type,
          creditorName: d.creditorName,
          amount: d.amount,
          frequency: d.frequency,
          paymentAmount: d.paymentAmount,
          status: d.status,
          notes: d.notes,
        }))}
      />
    </Section>
  );

  const calc = (
    <Section title="Payment Calculator">
      <PaymentCalculatorV2
        saveEndpoint={`/api/leads/${lead.id}/calculator`}
        initial={{
          totalDebt: latestCalc?.totalDebt ?? lead.totalDebtEst ?? 50000,
          termMonths: latestCalc?.programFeePeriod ?? 6,
          firstPaymentDate: latestCalc?.firstPaymentDate
            ? latestCalc.firstPaymentDate.toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10),
        }}
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

  const sfFields = (
    <SfDataSection sfDataJson={lead.sfDataJson} sfId={lead.sfId} />
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
            "All SF Fields": sfFields,
          }}
        />
      }
      rail={<ActivityChatterRail activities={activity} chatter={chatter} />}
    />
  );
}

