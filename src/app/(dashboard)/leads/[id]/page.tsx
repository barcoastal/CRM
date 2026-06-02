import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecordPage, HeaderActions, StatusPill } from "@/components/slds/record-page";
import { Section, FieldGrid } from "@/components/slds/section";
import { ActivityRail, type ActivityItem } from "@/components/slds/activity-rail";
import { RelatedList } from "@/components/slds/related-list";
import { ConvertLeadButton } from "@/components/leads/convert-lead-button";
import { leadStatusTone } from "@/lib/slds/status-tones";

// SF-canonical Lead status path — 1:1 with cdcrm.lightning.force.com
const LEAD_PATH = [
  { label: "New" },
  { label: "Working Lead" },
  { label: "Archive Disposition" },
  { label: "Converted" },
];

function leadPathIndex(status: string): number {
  const s = (status ?? "").toUpperCase().replace(/[_ ]+/g, "_");
  if (s === "CONVERTED" || s === "ENROLLED") return 3;
  if (s === "ARCHIVE_DISPOSITION" || s === "DNC" || s === "LOST" || s === "UNQUALIFIED") return 2;
  if (s === "WORKING_LEAD" || s === "CONTACTED" || s === "QUALIFIED" || s === "CALLBACK") return 1;
  return 0;
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      calls: { include: { agent: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 20 },
      campaignContacts: { include: { campaign: { select: { id: true, name: true } } } },
      tasks: { orderBy: { dueDate: "asc" }, take: 30 },
      events: { orderBy: { startAt: "desc" }, take: 30 },
      emails: { orderBy: { createdAt: "desc" }, take: 20 },
      sms: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!lead) notFound();

  const activity: ActivityItem[] = [
    ...lead.calls.map((c) => ({
      id: c.id, type: "CALL" as const, subject: `Call to ${c.phoneNumber}`,
      meta: `${c.disposition ?? "—"} · ${c.agent.name}`,
      date: c.startedAt, done: c.status === "COMPLETED",
    })),
    ...lead.tasks.map((t) => ({
      id: t.id, type: (t.type === "CALL" ? "CALL" : "TASK") as ActivityItem["type"], subject: t.subject,
      meta: t.outcome ?? t.disposition ?? null,
      date: t.dueDate ?? t.completedAt ?? t.createdAt, done: t.status === "COMPLETED",
    })),
    ...lead.events.map((e) => ({
      id: e.id, type: "EVENT" as const, subject: e.subject,
      meta: e.location ?? null, date: e.startAt, done: e.status === "COMPLETED",
    })),
    ...lead.emails.map((m) => ({
      id: m.id, type: "EMAIL" as const, subject: m.subject,
      meta: `${m.direction === "OUTBOUND" ? "To" : "From"} ${m.toAddresses}`,
      date: m.sentAt ?? m.createdAt, done: m.status === "DELIVERED" || m.status === "OPENED",
    })),
    ...lead.sms.map((m) => ({
      id: m.id, type: "SMS" as const, subject: m.body.slice(0, 80),
      meta: `${m.direction === "OUTBOUND" ? "→" : "←"} ${m.toNumber}`,
      date: m.sentAt ?? m.createdAt, done: m.status === "DELIVERED",
    })),
  ];

  const converted =
    lead.convertedAccountId && lead.convertedContactId
      ? {
          accountId: lead.convertedAccountId,
          contactId: lead.convertedContactId,
          opportunityId: lead.convertedOpportunityId,
        }
      : undefined;

  return (
    <RecordPage
      entity="Lead"
      entityLabel="Lead"
      recordTitle={lead.contactName || lead.businessName}
      recordSubtitle={
        <>
          {lead.recordType.replace(/_/g, " ")} · <StatusPill label={lead.status} tone={leadStatusTone(lead.status)} />
        </>
      }
      highlights={[
        { label: "Company", value: lead.businessName },
        { label: "Phone", value: lead.phone },
        { label: "Email", value: lead.email },
        { label: "Est. Debt", value: lead.totalDebtEst ? `$${lead.totalDebtEst.toLocaleString()}` : null },
        { label: "Owner", value: lead.assignedTo?.name },
      ]}
      actions={
        <HeaderActions
          buttons={[
            { label: "+ Follow" },
            { label: "Edit" },
            { label: "New Task" },
            { label: "New Event" },
          ]}
        />
      }
      pathStages={LEAD_PATH}
      pathCurrentIndex={Math.max(0, leadPathIndex(lead.status))}
      pathActionLabel={converted ? "Converted" : "Mark Status as Complete"}
      details={
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

          {(lead.utmSource || lead.utmCampaign || lead.gclid || lead.fbclid || lead.eliClickId) && (
            <Section title="Marketing Attribution" defaultOpen={false}>
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
          )}

          {lead.notes && (
            <Section title="Notes" defaultOpen={false}>
              <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{lead.notes}</div>
            </Section>
          )}
        </>
      }
      rail={
        <>
          {lead.campaignContacts.length > 0 && (
            <RelatedList
              entity="Campaign"
              title="Campaigns"
              items={lead.campaignContacts as readonly { id: string; campaign: { id: string; name: string }; status: string; attempts: number }[]}
              renderItem={(c) => (
                <div>
                  <Link href={`/campaigns/${c.campaign.id}`} style={{ color: "#1589ee", fontWeight: 600 }}>
                    {c.campaign.name}
                  </Link>
                  <div style={{ fontSize: 11, color: "#706e6b" }}>
                    {c.status} · {c.attempts} attempt{c.attempts === 1 ? "" : "s"}
                  </div>
                </div>
              )}
              emptyHint="No campaigns."
            />
          )}
          <ActivityRail items={activity} />
        </>
      }
    />
  );
}
