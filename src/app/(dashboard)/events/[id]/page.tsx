import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecordPage, HeaderActions, StatusPill } from "@/components/slds/record-page";
import { Section, FieldGrid } from "@/components/slds/section";
import { genericTone } from "@/lib/slds/status-tones";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await prisma.event.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true } },
      account: { select: { id: true, name: true } },
      contact: { select: { id: true, fullName: true } },
      lead: { select: { id: true, contactName: true, businessName: true } },
      opportunity: { select: { id: true, recordType: true, account: { select: { name: true } } } },
      case: { select: { id: true, caseNumber: true, subject: true } },
    },
  });
  if (!e) notFound();

  return (
    <RecordPage
      entity="Event"
      entityLabel="Event"
      recordTitle={e.subject}
      recordSubtitle={
        <>
          {e.recordType.replace(/_/g, " ")} ·{" "}
          <StatusPill label={e.status} tone={genericTone(e.status)} />
        </>
      }
      highlights={[
        { label: "Start", value: e.startAt.toLocaleString() },
        { label: "End", value: e.endAt.toLocaleString() },
        { label: "Location", value: e.location },
        { label: "All Day", value: e.allDay ? "Yes" : "No" },
        { label: "Owner", value: e.owner?.name },
      ]}
      actions={<HeaderActions buttons={[{ label: "Edit" }, { label: "Cancel" }]} />}
      details={
        <>
          <Section title="Event Information">
            <FieldGrid
              fields={[
                ["Subject", e.subject],
                ["Type", e.recordType.replace(/_/g, " ")],
                ["Status", <StatusPill key="s" label={e.status} tone={genericTone(e.status)} />],
                ["Start", e.startAt.toLocaleString()],
                ["End", e.endAt.toLocaleString()],
                ["All Day", e.allDay ? "Yes" : "No"],
                ["Location", e.location],
                ["Disposition", e.disposition],
                ["Outcome", e.outcome],
                ["Owner", e.owner?.name],
              ]}
            />
            {e.description && (
              <div style={{ marginTop: 12, fontSize: 13, whiteSpace: "pre-wrap" }}>{e.description}</div>
            )}
          </Section>

          <Section title="Related">
            <FieldGrid
              fields={[
                ["Account", e.account && <Link key="a" href={`/accounts/${e.account.id}`} style={{ color: "#1589ee" }}>{e.account.name}</Link>],
                ["Contact", e.contact && <Link key="c" href={`/contacts/${e.contact.id}`} style={{ color: "#1589ee" }}>{e.contact.fullName}</Link>],
                ["Lead", e.lead && <Link key="l" href={`/leads/${e.lead.id}`} style={{ color: "#1589ee" }}>{e.lead.contactName}</Link>],
                ["Opportunity", e.opportunity && <Link key="o" href={`/opportunities/${e.opportunity.id}`} style={{ color: "#1589ee" }}>{e.opportunity.account?.name ?? e.opportunity.recordType}</Link>],
                ["Case", e.case && <Link key="cs" href={`/cases/${e.case.id}`} style={{ color: "#1589ee" }}>{e.case.caseNumber}</Link>],
              ]}
            />
          </Section>
        </>
      }
    />
  );
}
