import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecordPage, HeaderActions } from "@/components/slds/record-page";
import { Section, FieldGrid } from "@/components/slds/section";
import { ActivityRail, type ActivityItem } from "@/components/slds/activity-rail";
import { RelatedList } from "@/components/slds/related-list";
import { SfDataSection } from "@/components/slds/sf-data-section";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      primaryAccount: true,
      owner: { select: { id: true, name: true, email: true } },
      accountRelations: { include: { account: { select: { id: true, name: true, recordType: true } } } },
      tasks: { orderBy: { dueDate: "asc" }, take: 30 },
      events: { orderBy: { startAt: "desc" }, take: 30 },
      emails: { orderBy: { createdAt: "desc" }, take: 20 },
      sms: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!contact) notFound();

  const activity: ActivityItem[] = [
    ...contact.tasks.map((t) => ({
      id: t.id, type: (t.type === "CALL" ? "CALL" : "TASK") as ActivityItem["type"],
      subject: t.subject, meta: t.outcome ?? null,
      date: t.dueDate ?? t.completedAt ?? t.createdAt, done: t.status === "COMPLETED",
    })),
    ...contact.events.map((e) => ({
      id: e.id, type: "EVENT" as const, subject: e.subject, meta: e.location ?? null,
      date: e.startAt, done: e.status === "COMPLETED",
    })),
    ...contact.emails.map((m) => ({
      id: m.id, type: "EMAIL" as const, subject: m.subject, meta: m.toAddresses,
      date: m.sentAt ?? m.createdAt, done: m.status === "DELIVERED",
    })),
    ...contact.sms.map((m) => ({
      id: m.id, type: "SMS" as const, subject: m.body.slice(0, 80),
      meta: `${m.direction === "OUTBOUND" ? "→" : "←"} ${m.toNumber}`,
      date: m.sentAt ?? m.createdAt, done: m.status === "DELIVERED",
    })),
  ];

  return (
    <RecordPage
      entity="Contact"
      entityLabel="Contact"
      recordTitle={contact.fullName}
      recordSubtitle={contact.title ?? undefined}
      highlights={[
        { label: "Phone", value: contact.phone },
        { label: "Email", value: contact.email },
        { label: "Title", value: contact.title },
        { label: "Account", value: contact.primaryAccount?.name && (
          <Link href={`/accounts/${contact.primaryAccount.id}`} style={{ color: "#1589ee" }}>{contact.primaryAccount.name}</Link>
        ) },
        { label: "Owner", value: contact.owner?.name },
      ]}
      actions={
        <HeaderActions buttons={[{ label: "+ Follow" }, { label: "Edit" }, { label: "New Task" }, { label: "New Event" }]} />
      }
      details={
        <>
          <Section title="Contact Information">
            <FieldGrid
              fields={[
                ["First Name", contact.firstName],
                ["Last Name", contact.lastName],
                ["Title", contact.title],
                ["Email", contact.email],
                ["Phone", contact.phone],
                ["Mobile Phone", contact.mobilePhone],
                ["Birthdate", contact.birthdate?.toLocaleDateString()],
                ["Owner", contact.owner?.name],
              ]}
            />
          </Section>
          {contact.primaryAccount && (
            <Section title="Account Information">
              <FieldGrid
                fields={[
                  ["Primary Account", <Link key="a" href={`/accounts/${contact.primaryAccount.id}`} style={{ color: "#1589ee" }}>{contact.primaryAccount.name}</Link>],
                  ["Account Type", contact.primaryAccount.recordType.replace(/_/g, " ")],
                  ["Account Phone", contact.primaryAccount.phone],
                  ["Account Email", contact.primaryAccount.email],
                ]}
              />
            </Section>
          )}
          <SfDataSection sfDataJson={contact.sfDataJson} sfId={contact.sfId} />
        </>
      }
      rail={
        <>
          <RelatedList
            entity="Account"
            title="Related Accounts"
            items={contact.accountRelations.map((r) => ({ id: r.id, role: r.role, account: r.account }))}
            renderItem={(r) => (
              <div>
                <Link href={`/accounts/${r.account.id}`} style={{ color: "#1589ee", fontWeight: 600 }}>
                  {r.account.name}
                </Link>
                {r.role && <div style={{ fontSize: 11, color: "#706e6b" }}>{r.role}</div>}
              </div>
            )}
            emptyHint="No other accounts."
          />
          <ActivityRail items={activity} />
        </>
      }
    />
  );
}
