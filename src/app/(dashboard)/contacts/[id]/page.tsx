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
      details={(() => {
        let ctSf: Record<string, unknown> = {};
        try { ctSf = contact.sfDataJson ? JSON.parse(contact.sfDataJson) as Record<string, unknown> : {}; } catch { /* empty */ }
        const sfc = (k: string): string | null => {
          const v = ctSf[k];
          if (v == null || v === "") return null;
          return String(v);
        };
        const sfcDate = (k: string): string | null => {
          const v = sfc(k);
          if (!v) return null;
          const d = new Date(v);
          return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString();
        };
        return (
        <>
          <Section title="Contact Information">
            <FieldGrid
              fields={[
                ["First Name", contact.firstName ?? sfc("FirstName")],
                ["Last Name", contact.lastName ?? sfc("LastName")],
                ["Salutation", sfc("Salutation")],
                ["Title", contact.title ?? sfc("Title")],
                ["Department", sfc("Department")],
                ["Email", contact.email ?? sfc("Email")],
                ["Phone", contact.phone ?? sfc("Phone")],
                ["Mobile Phone", contact.mobilePhone ?? sfc("MobilePhone")],
                ["Other Phone", sfc("OtherPhone")],
                ["Home Phone", sfc("HomePhone")],
                ["Fax", sfc("Fax")],
                ["Birthdate", contact.birthdate?.toLocaleDateString() ?? sfcDate("Birthdate")],
                ["Reports To", sfc("ReportsToId")],
                ["Owner", contact.owner?.name ?? sfc("Owner_Full_Name__c")],
                ["Owner Email", sfc("Owner_Username__c")],
                ["Lead Source", sfc("LeadSource")],
                ["Description", sfc("Description")],
                ["Mailing Street", sfc("MailingStreet")],
                ["Mailing City", sfc("MailingCity")],
                ["Mailing State", sfc("MailingState")],
                ["Mailing Postal Code", sfc("MailingPostalCode")],
                ["Mailing Country", sfc("MailingCountry")],
                ["Other Street", sfc("OtherStreet")],
                ["Other City", sfc("OtherCity")],
                ["Email Bounced Date", sfcDate("EmailBouncedDate")],
                ["Last Activity Date", sfcDate("LastActivityDate")],
                ["DNC Email", sfc("HasOptedOutOfEmail")],
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
        );
      })()}
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
