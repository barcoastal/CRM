import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecordPage, HeaderActions, StatusPill } from "@/components/slds/record-page";
import { Section, FieldGrid } from "@/components/slds/section";
import { genericTone } from "@/lib/slds/status-tones";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await prisma.task.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true } },
      account: { select: { id: true, name: true } },
      opportunity: { select: { id: true, recordType: true, account: { select: { name: true } } } },
      debt: { select: { id: true, creditorName: true } },
      programPlan: { select: { id: true, recordType: true } },
      lead: { select: { id: true, contactName: true, businessName: true } },
      contact: { select: { id: true, fullName: true } },
      case: { select: { id: true, caseNumber: true, subject: true } },
      call: true,
    },
  });
  if (!t) notFound();

  return (
    <RecordPage
      entity="Task"
      entityLabel="Task"
      recordTitle={t.subject}
      recordSubtitle={
        <>
          {t.type} · <StatusPill label={t.status} tone={genericTone(t.status)} /> · {t.priority}
        </>
      }
      highlights={[
        { label: "Type", value: t.type },
        { label: "Due Date", value: t.dueDate?.toLocaleDateString() },
        { label: "Owner", value: t.owner?.name },
        { label: "Disposition", value: t.disposition },
        { label: "Status", value: t.status },
      ]}
      actions={
        <HeaderActions
          buttons={[
            { label: "Edit" },
            { label: "Complete", primary: true },
          ]}
        />
      }
      details={
        <>
          <Section title="Task Information">
            <FieldGrid
              fields={[
                ["Subject", t.subject],
                ["Type", t.type],
                ["Record Type", t.recordType],
                ["Status", <StatusPill key="s" label={t.status} tone={genericTone(t.status)} />],
                ["Priority", t.priority],
                ["Due Date", t.dueDate?.toLocaleString()],
                ["Reminder", t.reminderAt?.toLocaleString()],
                ["Completed", t.completedAt?.toLocaleString()],
                ["Disposition", t.disposition],
                ["Callback Date", t.callbackDate?.toLocaleString()],
                ["Outcome", t.outcome],
                ["Owner", t.owner?.name],
              ]}
            />
            {t.notes && (
              <div style={{ marginTop: 12, fontSize: 13, whiteSpace: "pre-wrap" }}>{t.notes}</div>
            )}
          </Section>
          <Section title="Related">
            <FieldGrid
              fields={[
                ["Account", t.account?.name && <Link key="a" href={`/accounts/${t.account.id}`} style={{ color: "#0176d3" }}>{t.account.name}</Link>],
                ["Opportunity", t.opportunity && <Link key="o" href={`/opportunities/${t.opportunity.id}`} style={{ color: "#0176d3" }}>{t.opportunity.account?.name ?? t.opportunity.recordType}</Link>],
                ["Lead", t.lead && <Link key="l" href={`/leads/${t.lead.id}`} style={{ color: "#0176d3" }}>{t.lead.contactName}</Link>],
                ["Contact", t.contact && <Link key="c" href={`/contacts/${t.contact.id}`} style={{ color: "#0176d3" }}>{t.contact.fullName}</Link>],
                ["Case", t.case && <Link key="cs" href={`/cases/${t.case.id}`} style={{ color: "#0176d3" }}>{t.case.caseNumber}: {t.case.subject}</Link>],
                ["Program Plan", t.programPlan && <Link key="pp" href={`/program-plans/${t.programPlan.id}`} style={{ color: "#0176d3" }}>{t.programPlan.recordType}</Link>],
                ["Debt", t.debt?.creditorName],
                ["Call", t.call && `${t.call.phoneNumber} (${t.call.disposition ?? t.call.status})`],
              ]}
            />
          </Section>
        </>
      }
    />
  );
}
