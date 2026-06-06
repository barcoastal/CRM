import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecordPage } from "@/components/slds/record-page";
import { ActivityChatterRail, type ChatterPost } from "@/components/slds/activity-chatter-rail";
import type { ActivityItem } from "@/components/slds/activity-rail";
import { RelatedList } from "@/components/slds/related-list";
import { SfDataSection } from "@/components/slds/sf-data-section";
import { ContactTabs } from "@/components/contacts/contact-tabs";
import { ContactHeaderButtons } from "@/components/contacts/contact-header-buttons";
import { ContactSection } from "@/components/contacts/contact-section";
import { ContactFieldGrid } from "@/components/contacts/contact-field-grid";
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

  // ---------- sfDataJson helpers ----------
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
  const sfcBool = (k: string): string | null => {
    const v = sfc(k);
    if (v == null) return null;
    const lower = v.toLowerCase();
    if (lower === "true" || lower === "1") return "Yes";
    if (lower === "false" || lower === "0") return "No";
    return v;
  };

  // ---------- Resolve Reports To via SF id ----------
  let reportsToNode: React.ReactNode = null;
  const reportsToSfId = sfc("ReportsToId");
  const reportsToCachedName = sfc("ReportsTo_Full_Name__c") ?? sfc("ReportsTo_Name__c");
  if (reportsToSfId) {
    const reportsTo = await prisma.contact.findUnique({
      where: { sfId: reportsToSfId },
      select: { id: true, fullName: true },
    });
    if (reportsTo) {
      reportsToNode = (
        <Link href={`/contacts/${reportsTo.id}`} style={{ color: "#1589ee" }}>
          {reportsTo.fullName}
        </Link>
      );
    } else if (reportsToCachedName) {
      reportsToNode = reportsToCachedName;
    }
    // Otherwise leave null so the dash renders (avoid leaking a raw SF id).
  } else if (reportsToCachedName) {
    reportsToNode = reportsToCachedName;
  }

  // ---------- Owner cleanup ----------
  // Bar saw "1.0" showing in Owner — guard against numeric fallthrough from JSON.
  const ownerName = contact.owner?.name ?? sfc("Owner_Full_Name__c") ?? sfc("Owner_Name__c");
  const ownerNode: React.ReactNode = ownerName && !/^[0-9.]+$/.test(ownerName) ? ownerName : null;

  // ---------- Activities & Chatter ----------
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

  // ---------- Address composition ----------
  const mailingLines = [
    sfc("MailingStreet"),
    [sfc("MailingCity"), sfc("MailingState"), sfc("MailingPostalCode")].filter(Boolean).join(", "),
    sfc("MailingCountry"),
  ].filter((l) => l && l.length > 0);
  const mailingAddress = mailingLines.length > 0 ? (
    <div style={{ color: "#1589ee", whiteSpace: "pre-line" }}>{mailingLines.join("\n")}</div>
  ) : null;

  const otherLines = [
    sfc("OtherStreet"),
    [sfc("OtherCity"), sfc("OtherState"), sfc("OtherPostalCode")].filter(Boolean).join(", "),
    sfc("OtherCountry"),
  ].filter((l) => l && l.length > 0);
  const otherAddress = otherLines.length > 0 ? (
    <div style={{ color: "#1589ee", whiteSpace: "pre-line" }}>{otherLines.join("\n")}</div>
  ) : null;

  // ---------- Contact Information fields — order matches SF screenshot ----------
  // Left col then right col, interleaved (FieldGrid renders in row-major order).
  const phoneVal = contact.phone ?? sfc("Phone");
  const emailVal = contact.email ?? sfc("Email");
  const nameNode = (
    <span>
      {contact.fullName}
      {sfc("Salutation") ? "" : ""}
    </span>
  );
  const accountNameNode = contact.primaryAccount ? (
    <Link href={`/accounts/${contact.primaryAccount.id}`} style={{ color: "#1589ee" }}>
      {contact.primaryAccount.name}
    </Link>
  ) : null;

  const contactInformationFields: [string, React.ReactNode][] = [
    ["Contact Owner", ownerNode],
    [
      "Phone",
      phoneVal ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#1589ee" }}>{phoneVal}</span>
          <CallButton phone={phoneVal} />
        </span>
      ) : null,
    ],
    ["Name", nameNode],
    ["Home Phone", sfc("HomePhone")],
    ["Account Name", accountNameNode],
    ["Mobile", contact.mobilePhone ?? sfc("MobilePhone")],
    ["Title", contact.title ?? sfc("Title")],
    ["Other Phone", sfc("OtherPhone")],
    ["Department", sfc("Department")],
    ["Fax", sfc("Fax")],
    ["Birthdate", contact.birthdate?.toLocaleDateString() ?? sfcDate("Birthdate")],
    [
      "Email",
      emailVal ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <a href={`mailto:${emailVal}`} style={{ color: "#1589ee" }}>{emailVal}</a>
          <ComposeEmailButton defaultTo={emailVal} label="" />
        </span>
      ) : null,
    ],
    ["Reports To", reportsToNode],
    ["SSN", sfc("SSN__c") ?? sfc("SSN")],
    ["Lead Source", sfc("LeadSource")],
    ["Preferred Method of Contact", sfc("Preferred_Method_of_Contact__c") ?? sfc("Preferred_Method__c")],
    ["Lead Id", sfc("Lead_Id__c") ?? sfc("LeadId__c") ?? sfc("Lead_ID__c")],
    ["Assistant", sfc("AssistantName")],
    ["Verified Phone Number", sfcBool("Verified_Phone_Number__c")],
    ["Asst. Phone", sfc("AssistantPhone")],
    ["Sync To Account Engagement", sfcBool("pi__pardot_hard_bounced__c") ?? sfcBool("Sync_to_Pardot__c") ?? sfcBool("Sync_To_Account_Engagement__c")],
    ["", null], // pad right col so Mailing/Other line up
    ["Mailing Address", mailingAddress],
    ["Other Address", otherAddress],
  ];

  const detailsPanel = (
    <>
      <ContactSection title="Contact Information">
        <ContactFieldGrid fields={contactInformationFields} />
      </ContactSection>

      {contact.primaryAccount && (
        <ContactSection title="Account Information" defaultOpen={false}>
          <ContactFieldGrid
            fields={[
              ["Primary Account", accountNameNode],
              ["Account Type", contact.primaryAccount.recordType.replace(/_/g, " ")],
              ["Client Status", contact.primaryAccount.clientStatus],
              ["Stage", contact.primaryAccount.stage],
              ["Account Phone", contact.primaryAccount.phone],
              ["Account Email", contact.primaryAccount.email],
              [
                "Parent Account",
                contact.primaryAccount.parentAccount?.name ? (
                  <Link
                    href={`/accounts/${contact.primaryAccount.parentAccount.id}`}
                    style={{ color: "#1589ee" }}
                  >
                    {contact.primaryAccount.parentAccount.name}
                  </Link>
                ) : null,
              ],
            ]}
          />
        </ContactSection>
      )}

      <ContactSection title="System Information" defaultOpen={false}>
        <ContactFieldGrid
          fields={[
            ["Owner Email", contact.owner?.email ?? sfc("Owner_Username__c")],
            ["Created Date", sfcDate("CreatedDate") ?? contact.createdAt.toLocaleDateString()],
            ["Last Modified", sfcDate("LastModifiedDate") ?? contact.updatedAt.toLocaleDateString()],
            ["Description", sfc("Description")],
          ]}
        />
      </ContactSection>
    </>
  );

  const marketingPanel = (
    <ContactSection title="Account Engagement">
      <ContactFieldGrid
        fields={[
          ["Email Opt Out", sfcBool("HasOptedOutOfEmail")],
          ["Account Engagement Grade", sfc("pi__grade__c")],
          ["Account Engagement Campaign", sfc("pi__campaign__c")],
          ["First Referrer Type", sfc("pi__first_touch_url__c") ?? sfc("pi__first_referrer_type__c")],
          ["Account Engagement Comments", sfc("pi__comments__c")],
          ["Hard Bounced", sfcBool("pi__pardot_hard_bounced__c")],
          ["Last Activity", sfcDate("pi__last_activity__c")],
          ["Account Engagement Score", sfc("pi__score__c")],
          ["First Activity", sfcDate("pi__first_activity__c")],
          ["Conversion Date", sfcDate("pi__conversion_date__c")],
          ["Created from URL", sfc("pi__created_from_url__c")],
          ["Notes", sfc("pi__notes__c")],
          ["Email Bounced Reason", sfc("EmailBouncedReason")],
          ["Email Bounced Date", sfcDate("EmailBouncedDate")],
          ["Last Activity Date", sfcDate("LastActivityDate")],
          ["DNC Email", sfcBool("HasOptedOutOfEmail")],
          ["DNC Fax", sfcBool("HasOptedOutOfFax")],
          ["Do Not Call", sfcBool("DoNotCall")],
        ]}
      />
    </ContactSection>
  );

  const relatedFooter = (
    <ContactSection title="Related Records" defaultOpen={false}>
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
    </ContactSection>
  );

  const allSfFooter = (
    <details style={{ marginTop: 8 }}>
      <summary style={{ cursor: "pointer", color: "#1589ee", fontSize: 12, padding: "4px 0" }}>
        View all Salesforce fields
      </summary>
      <div style={{ marginTop: 8 }}>
        <SfDataSection sfDataJson={contact.sfDataJson} sfId={contact.sfId} />
      </div>
    </details>
  );

  const detailsFooter = (
    <>
      {relatedFooter}
      {allSfFooter}
    </>
  );

  return (
    <RecordPage
      entity="Contact"
      entityLabel="Contact"
      recordTitle={contact.fullName}
      recordSubtitle={contact.title ?? undefined}
      highlights={[
        { label: "Title", value: contact.title },
        {
          label: "Account Name",
          value: contact.primaryAccount?.name && (
            <Link href={`/accounts/${contact.primaryAccount.id}`} style={{ color: "#1589ee" }}>
              {contact.primaryAccount.name}
            </Link>
          ),
        },
        { label: "Phone", value: contact.phone ?? sfc("Phone") },
        { label: "Email", value: contact.email ?? sfc("Email") },
        { label: "Contact Owner", value: ownerNode },
      ]}
      actions={<ContactHeaderButtons contactId={contact.id} />}
      details={
        <ContactTabs
          panels={{
            Details: detailsPanel,
            Marketing: marketingPanel,
          }}
          detailsFooter={detailsFooter}
        />
      }
      rail={
        <>
          <ActivityChatterRail activities={activity} chatter={chatter} />
        </>
      }
    />
  );
}
