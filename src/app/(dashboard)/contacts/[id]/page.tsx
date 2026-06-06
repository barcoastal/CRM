import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecordPage } from "@/components/slds/record-page";
import { Section, FieldGrid } from "@/components/slds/section";
import { ActivityChatterRail, type ChatterPost } from "@/components/slds/activity-chatter-rail";
import type { ActivityItem } from "@/components/slds/activity-rail";
import { RelatedList } from "@/components/slds/related-list";
import { SfDataSection } from "@/components/slds/sf-data-section";
import { ContactTabs } from "@/components/contacts/contact-tabs";
import { ContactHeaderButtons } from "@/components/contacts/contact-header-buttons";
import { CallButton } from "@/components/dialer/call-button";
import { ComposeEmailButton } from "@/components/emails/compose-email-button";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      primaryAccount: {
        select: {
          id: true,
          name: true,
          recordType: true,
          phone: true,
          email: true,
          clientStatus: true,
          stage: true,
          parentAccount: { select: { id: true, name: true } },
        },
      },
      owner: { select: { id: true, name: true, email: true } },
      accountRelations: { include: { account: { select: { id: true, name: true, recordType: true } } } },
      primaryForOpportunity: {
        select: { id: true, name: true, recordType: true, stage: true, totalDebt: true, version: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      cases: { orderBy: { createdAt: "desc" }, take: 20 },
      tasks: { orderBy: { dueDate: "asc" }, take: 50 },
      events: { orderBy: { startAt: "desc" }, take: 30 },
      emails: { orderBy: { createdAt: "desc" }, take: 30 },
      sms: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
  if (!contact) notFound();

  const activity: ActivityItem[] = [
    ...contact.tasks.map((t) => ({
      id: t.id,
      type: (t.type === "CALL" ? "CALL" : "TASK") as ActivityItem["type"],
      subject: t.subject,
      meta: t.outcome ?? t.disposition ?? null,
      date: t.dueDate ?? t.completedAt ?? t.createdAt,
      done: t.status === "COMPLETED",
    })),
    ...contact.events.map((e) => ({
      id: e.id,
      type: "EVENT" as const,
      subject: e.subject,
      meta: e.location ?? null,
      date: e.startAt,
      done: e.status === "COMPLETED",
    })),
    ...contact.emails.map((m) => ({
      id: m.id,
      type: "EMAIL" as const,
      subject: m.subject,
      meta: `${m.direction === "OUTBOUND" ? "To" : "From"} ${m.toAddresses}`,
      date: m.sentAt ?? m.createdAt,
      done: m.status === "DELIVERED",
    })),
    ...contact.sms.map((m) => ({
      id: m.id,
      type: "SMS" as const,
      subject: m.body.slice(0, 80),
      meta: `${m.direction === "OUTBOUND" ? "→" : "←"} ${m.toNumber}`,
      date: m.sentAt ?? m.createdAt,
      done: m.status === "DELIVERED",
    })),
  ];

  const chatter: ChatterPost[] = contact.emails.map((m) => ({
    id: m.id,
    authorName: m.direction === "OUTBOUND" ? "You" : m.fromAddress,
    body: `${m.subject}\n\n${m.bodyText ?? m.bodyHtml?.replace(/<[^>]+>/g, "") ?? ""}`,
    createdAt: m.sentAt ?? m.createdAt,
  }));

  let ctSf: Record<string, unknown> = {};
  try {
    ctSf = contact.sfDataJson ? (JSON.parse(contact.sfDataJson) as Record<string, unknown>) : {};
  } catch {
    /* empty */
  }
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

  const detailsPanel = (
    <>
      <Section title="Contact Information">
        <FieldGrid
          fields={[
            ["Name", contact.fullName],
            ["Salutation", sfc("Salutation")],
            ["First Name", contact.firstName ?? sfc("FirstName")],
            ["Last Name", contact.lastName ?? sfc("LastName")],
            ["Title", contact.title ?? sfc("Title")],
            ["Department", sfc("Department")],
            [
              "Phone",
              <span key="ph" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                {contact.phone ?? sfc("Phone")}
                {(contact.phone ?? sfc("Phone")) && (
                  <CallButton phone={contact.phone ?? sfc("Phone")} />
                )}
              </span>,
            ],
            ["Mobile Phone", contact.mobilePhone ?? sfc("MobilePhone")],
            ["Home Phone", sfc("HomePhone")],
            ["Other Phone", sfc("OtherPhone")],
            ["Fax", sfc("Fax")],
            [
              "Email",
              <span key="em" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                {contact.email ?? sfc("Email")}
                {(contact.email ?? sfc("Email")) && (
                  <ComposeEmailButton defaultTo={(contact.email ?? sfc("Email"))!} label="Email" />
                )}
              </span>,
            ],
            ["Birthdate", contact.birthdate?.toLocaleDateString() ?? sfcDate("Birthdate")],
            ["Reports To", sfc("ReportsToId")],
            ["Owner", contact.owner?.name ?? sfc("Owner_Full_Name__c")],
            ["Owner Email", contact.owner?.email ?? sfc("Owner_Username__c")],
            ["Lead Source", sfc("LeadSource")],
            ["Description", sfc("Description")],
          ]}
        />
      </Section>

      {contact.primaryAccount && (
        <Section title="Account Information">
          <FieldGrid
            fields={[
              [
                "Primary Account",
                <Link key="a" href={`/accounts/${contact.primaryAccount.id}`} style={{ color: "#1589ee" }}>
                  {contact.primaryAccount.name}
                </Link>,
              ],
              ["Account Type", contact.primaryAccount.recordType.replace(/_/g, " ")],
              ["Client Status", contact.primaryAccount.clientStatus],
              ["Stage", contact.primaryAccount.stage],
              ["Account Phone", contact.primaryAccount.phone],
              ["Account Email", contact.primaryAccount.email],
              [
                "Parent Account",
                contact.primaryAccount.parentAccount?.name && (
                  <Link
                    key="parent"
                    href={`/accounts/${contact.primaryAccount.parentAccount.id}`}
                    style={{ color: "#1589ee" }}
                  >
                    {contact.primaryAccount.parentAccount.name}
                  </Link>
                ),
              ],
            ]}
          />
        </Section>
      )}

      <Section title="Address" defaultOpen={false}>
        <FieldGrid
          fields={[
            ["Mailing Street", sfc("MailingStreet")],
            ["Mailing City", sfc("MailingCity")],
            ["Mailing State", sfc("MailingState")],
            ["Mailing Postal Code", sfc("MailingPostalCode")],
            ["Mailing Country", sfc("MailingCountry")],
            ["Other Street", sfc("OtherStreet")],
            ["Other City", sfc("OtherCity")],
            ["Other State", sfc("OtherState")],
            ["Other Postal Code", sfc("OtherPostalCode")],
            ["Other Country", sfc("OtherCountry")],
          ]}
        />
      </Section>
    </>
  );

  const marketingPanel = (
    <>
      <Section title="Account Engagement (Pardot)">
        <FieldGrid
          fields={[
            ["Email Opt Out", sfc("HasOptedOutOfEmail") === "true" ? "Yes" : sfc("HasOptedOutOfEmail")],
            ["Email Bounced Reason", sfc("EmailBouncedReason")],
            ["Email Bounced Date", sfcDate("EmailBouncedDate")],
            ["Last Activity Date", sfcDate("LastActivityDate")],
            ["Account Engagement Score", sfc("pi__score__c")],
            ["Account Engagement Grade", sfc("pi__grade__c")],
            ["Account Engagement Campaign", sfc("pi__campaign__c")],
            ["Account Engagement First Activity", sfcDate("pi__first_activity__c")],
            ["Account Engagement Last Activity", sfcDate("pi__last_activity__c")],
            ["Account Engagement Comments", sfc("pi__comments__c")],
            ["Notes", sfc("pi__notes__c")],
            ["Created from URL", sfc("pi__created_from_url__c")],
            ["Conversion Date", sfcDate("pi__conversion_date__c")],
            ["DNC Email", sfc("HasOptedOutOfEmail")],
            ["DNC Fax", sfc("HasOptedOutOfFax")],
            ["Do Not Call", sfc("DoNotCall")],
          ]}
        />
      </Section>
    </>
  );

  const activitiesPanel = (
    <Section title={`Activities (${activity.length})`}>
      {activity.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "#706e6b" }}>No activity recorded.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fafaf9", borderBottom: "1px solid #d8dde6" }}>
              <th style={th}>Date</th>
              <th style={th}>Type</th>
              <th style={th}>Subject</th>
              <th style={th}>Detail</th>
            </tr>
          </thead>
          <tbody>
            {[...activity]
              .sort((a, b) => b.date.getTime() - a.date.getTime())
              .map((a) => (
                <tr key={a.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                  <td style={td}>{a.date.toLocaleString()}</td>
                  <td style={td}>{a.type}</td>
                  <td style={td}>{a.subject}</td>
                  <td style={td}>{a.meta ?? ""}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </Section>
  );

  const relatedPanel = (
    <>
      <RelatedList
        entity="Opportunity"
        title={`Opportunities as Primary Contact (${contact.primaryForOpportunity.length})`}
        items={contact.primaryForOpportunity}
        renderItem={(o) => (
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12 }}>
            <Link href={`/opportunities/${o.id}`} style={{ color: "#1589ee" }}>
              {o.name ?? o.recordType.replace(/_/g, " ")}
            </Link>
            <span>v{o.version}</span>
            <span>{o.stage}</span>
            <span>${o.totalDebt?.toLocaleString() ?? ""}</span>
          </div>
        )}
        emptyHint="No opportunities."
      />
      <RelatedList
        entity="Account"
        title={`Related Accounts (${contact.accountRelations.length})`}
        items={contact.accountRelations.map((r) => ({ id: r.id, role: r.role, account: r.account }))}
        renderItem={(r) => (
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
            <Link href={`/accounts/${r.account.id}`} style={{ color: "#1589ee" }}>
              {r.account.name}
            </Link>
            <span>{r.account.recordType.replace(/_/g, " ")}</span>
            <span style={{ color: "#706e6b" }}>{r.role ?? ""}</span>
          </div>
        )}
        emptyHint="No other accounts."
      />
      <RelatedList
        entity="Case"
        title={`Cases (${contact.cases.length})`}
        items={contact.cases}
        renderItem={(c) => (
          <div>
            <Link href={`/cases/${c.id}`} style={{ color: "#1589ee" }}>
              {c.subject}
            </Link>
            <span style={{ color: "#706e6b", marginLeft: 8 }}>· {c.status}</span>
          </div>
        )}
        emptyHint="No cases."
      />
      <RelatedList
        entity="Task"
        title={`Open Tasks (${contact.tasks.filter((t) => t.status !== "COMPLETED").length})`}
        items={contact.tasks.filter((t) => t.status !== "COMPLETED")}
        renderItem={(t) => (
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
            <span>{t.subject}</span>
            <span>{t.type}</span>
            <span style={{ color: "#706e6b" }}>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : ""}</span>
          </div>
        )}
        emptyHint="No open tasks."
      />
    </>
  );

  const sfPanel = <SfDataSection sfDataJson={contact.sfDataJson} sfId={contact.sfId} />;

  return (
    <RecordPage
      entity="Contact"
      entityLabel="Contact"
      recordTitle={contact.fullName}
      recordSubtitle={contact.title ?? undefined}
      highlights={[
        { label: "Title", value: contact.title },
        { label: "Account Name", value: contact.primaryAccount?.name && (
          <Link href={`/accounts/${contact.primaryAccount.id}`} style={{ color: "#1589ee" }}>{contact.primaryAccount.name}</Link>
        ) },
        { label: "Phone", value: contact.phone ?? sfc("Phone") },
        { label: "Email", value: contact.email ?? sfc("Email") },
        { label: "Contact Owner", value: contact.owner?.name },
      ]}
      actions={<ContactHeaderButtons contactId={contact.id} />}
      details={
        <ContactTabs
          panels={{
            Details: detailsPanel,
            Marketing: marketingPanel,
            Activities: activitiesPanel,
            "Related Records": relatedPanel,
            "All SF Fields": sfPanel,
          }}
        />
      }
      rail={
        <>
          <RelatedList
            entity="Account"
            title="Account Hierarchy"
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
          <RelatedList
            entity="Opportunity"
            title="Primary Opportunities"
            items={contact.primaryForOpportunity}
            renderItem={(o) => (
              <div>
                <Link href={`/opportunities/${o.id}`} style={{ color: "#1589ee", fontWeight: 600 }}>
                  {o.name ?? o.recordType.replace(/_/g, " ")}
                </Link>
                <div style={{ fontSize: 11, color: "#706e6b" }}>v{o.version} · {o.stage}</div>
              </div>
            )}
            emptyHint="No opportunities."
          />
          <ActivityChatterRail activities={activity} chatter={chatter} />
        </>
      }
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
  fontSize: 13,
};
