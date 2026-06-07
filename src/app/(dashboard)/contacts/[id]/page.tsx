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
import { ContactFieldGrid, CE } from "@/components/contacts/contact-field-grid";
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

  // SF Contact Details — field pairs verified against docs/sf-screenshots/sf-contact-detail.png
  // (Jennifer Stamos Sample). Even index = left col, odd index = right col.
  // Labels match SF verbatim ("Phone" not "Business Phone", "Mobile" not
  // "Mobile Phone", "Fax" not "Business Fax", "Birthdate" not "Date of Birth",
  // "Assistant" not "Assistant's Name").
  const contactInformationFields: import("@/components/contacts/contact-field-grid").ContactGridField[] = [
    // Row 1: Contact Owner | Phone
    ["Contact Owner", ownerNode],
    [
      "Phone",
      phoneVal ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#1589ee" }}>{phoneVal}</span>
          <CallButton phone={phoneVal} />
        </span>
      ) : null,
      { fieldKey: "phone", type: "phone", rawValue: contact.phone ?? phoneVal },
    ],
    // Row 2: Name | Home Phone
    CE("Name", nameNode, "fullName", "text", { rawValue: contact.fullName }),
    CE("Home Phone", sfc("HomePhone"), "HomePhone", "phone"),
    // Row 3: Account Name | Mobile
    ["Account Name", accountNameNode],
    CE("Mobile", contact.mobilePhone ?? sfc("MobilePhone"), "mobilePhone", "phone", { rawValue: contact.mobilePhone }),
    // Row 4: Title | Other Phone
    CE("Title", contact.title ?? sfc("Title"), "title", "text", { rawValue: contact.title }),
    CE("Other Phone", sfc("OtherPhone"), "OtherPhone", "phone"),
    // Row 5: Department | Fax
    CE("Department", sfc("Department"), "Department"),
    CE("Fax", sfc("Fax"), "Fax"),
    // Row 6: Birthdate | Email
    CE("Birthdate", contact.birthdate?.toLocaleDateString() ?? sfcDate("Birthdate"), "birthdate", "date", { rawValue: contact.birthdate ?? null }),
    [
      "Email",
      emailVal ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <a href={`mailto:${emailVal}`} style={{ color: "#1589ee" }}>{emailVal}</a>
          <ComposeEmailButton defaultTo={emailVal} label="" />
        </span>
      ) : null,
      { fieldKey: "email", type: "email", rawValue: contact.email ?? emailVal },
    ],
    // Row 7: Reports To | SSN
    ["Reports To", reportsToNode],
    CE("SSN", sfc("SSN__c") ?? sfc("SSN_Encrypted__c") ?? sfc("SSN"), "SSN__c"),
    // Row 8: Lead Source | Preferred Method of Contact
    CE("Lead Source", sfc("LeadSource"), "LeadSource"),
    CE("Preferred Method of Contact", sfc("Preferred_Method_of_Contact__c") ?? sfc("Preferred_Method__c"), "Preferred_Method_of_Contact__c"),
    // Row 9: Lead Id | Assistant
    ["Lead Id", sfc("Lead_Number__c") ?? sfc("Lead_Id__c") ?? sfc("LeadId__c") ?? sfc("Lead_ID__c")],
    CE("Assistant", sfc("AssistantName"), "AssistantName"),
    // Row 10: Verified Phone Number | Asst. Phone
    CE("Verified Phone Number", sfcBool("Verified_Phone_Number__c"), "Verified_Phone_Number__c", "checkbox"),
    CE("Asst. Phone", sfc("AssistantPhone"), "AssistantPhone", "phone"),
    // Row 11: Sync To Account Engagement | (empty right — SF leaves blank)
    CE("Sync To Account Engagement", sfcBool("Sync_To_Account_Engagement__c") ?? sfcBool("Sync_to_Pardot__c"), "Sync_To_Account_Engagement__c", "checkbox"),
    ["__PAD__", null],
    // Row 12: Mailing Address | Other Address
    ["Mailing Address", mailingAddress],
    ["Other Address", otherAddress],
  ];

  const detailsPanel = (
    <>
      <ContactSection title="Contact Information">
        <ContactFieldGrid fields={contactInformationFields} entityType="contact" entityId={contact.id} />
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

      <ContactSection title="Additional Information" defaultOpen={false}>
        <ContactFieldGrid
          entityType="contact"
          entityId={contact.id}
          fields={[
            CE("First Name", sfc("FirstName"), "firstName", "text", { rawValue: contact.firstName }),
            CE("Last Name", sfc("LastName"), "lastName", "text", { rawValue: contact.lastName }),
            CE("Middle Name", sfc("MiddleName"), "MiddleName"),
            CE("Salutation", sfc("Salutation"), "Salutation"),
            CE("Suffix", sfc("Suffix"), "Suffix"),
            ["First Call Date", sfcDate("FirstCallDateTime")],
            ["First Email Date", sfcDate("FirstEmailDateTime")],
            CE("High UCC RISK", sfcBool("High_UCC_RISK__c"), "High_UCC_RISK__c", "checkbox"),
            CE("Closer FIrst Name`", sfc("Closer_FIrst_Name__c"), "Closer_FIrst_Name__c"),
            CE("SMS Opt Out", sfcBool("smagicinteract__SMSOptOut__c"), "smagicinteract__SMSOptOut__c", "checkbox"),
            CE("External Legacy CRM Id", sfc("External_Legacy_CRM_Id__c"), "External_Legacy_CRM_Id__c"),
            CE("Important", sfcBool("IsPriorityRecord"), "IsPriorityRecord", "checkbox"),
            ["Is Email Bounced", sfcBool("IsEmailBounced")],
            ["Is Person Account", sfcBool("IsPersonAccount")],
          ]}
        />
      </ContactSection>

      <ContactSection title="System Information" defaultOpen={false}>
        <ContactFieldGrid
          fields={[
            ["Contact ID", sfc("Id") ?? contact.sfId],
            ["Account ID", sfc("AccountId")],
            ["Owner ID", sfc("OwnerId")],
            ["Reports To ID", sfc("ReportsToId")],
            ["Master Record ID", sfc("MasterRecordId")],
            ["Individual ID", sfc("IndividualId")],
            ["Activity Metric ID", sfc("ActivityMetricId")],
            ["Owner Email", contact.owner?.email ?? sfc("Owner_Username__c")],
            ["Created Date", sfcDate("CreatedDate") ?? contact.createdAt.toLocaleDateString()],
            ["Created By ID", sfc("CreatedById")],
            ["Last Modified Date", sfcDate("LastModifiedDate") ?? contact.updatedAt.toLocaleDateString()],
            ["Last Modified By ID", sfc("LastModifiedById")],
            ["Contact Description", sfc("Description")],
          ]}
        />
      </ContactSection>
    </>
  );

  const marketingPanel = (
    <>
      <ContactSection title="Account Engagement">
        {/* SF Account Engagement section — pair-by-pair from SF Jennifer Stamos. */}
        <ContactFieldGrid
          fields={[
            // Row 1: Email Opt Out | Account Engagement Grade
            ["Email Opt Out", sfcBool("HasOptedOutOfEmail")],
            ["Account Engagement Grade", sfc("pi__grade__c")],
            // Row 2: Account Engagement Campaign | Account Engagement First Referrer Type
            ["Account Engagement Campaign", sfc("pi__campaign__c")],
            ["Account Engagement First Referrer Type", sfc("pi__first_referrer_type__c")],
            // Row 3: Account Engagement Comments | Account Engagement Hard Bounced
            ["Account Engagement Comments", sfc("pi__comments__c")],
            ["Account Engagement Hard Bounced", sfcBool("pi__pardot_hard_bounced__c")],
            // Row 4: Account Engagement Conversion Date | Account Engagement Last Activity
            ["Account Engagement Conversion Date", sfcDate("pi__conversion_date__c")],
            ["Account Engagement Last Activity", sfcDate("pi__last_activity__c")],
            // Row 5: Account Engagement Created Date | Account Engagement Last Scored At
            ["Account Engagement Created Date", sfcDate("pi__created_date__c")],
            ["Account Engagement Last Scored At", sfcDate("pi__last_scored_at__c")],
            // Row 6: Account Engagement First Activity | Account Engagement Notes
            ["Account Engagement First Activity", sfcDate("pi__first_activity__c")],
            ["Account Engagement Notes", sfc("pi__notes__c")],
            // Row 7: Account Engagement First Referrer | Account Engagement Score
            ["Account Engagement First Referrer", sfc("pi__first_referrer__c") ?? sfc("pi__first_touch_url__c")],
            ["Account Engagement Score", sfc("pi__score__c")],
            // Row 8: Account Engagement First Referrer Query | Account Engagement URL
            ["Account Engagement First Referrer Query", sfc("pi__first_referrer_query__c") ?? sfc("pi__first_search__c")],
            ["Account Engagement URL", sfc("pi__url__c")],
            // Row 9: Created By | Last Modified By
            ["Created By", `${sfc("CreatedBy_Full_Name__c") ?? ""}${sfcDate("CreatedDate") ? `, ${sfcDate("CreatedDate")}` : ""}`.trim() || sfcDate("CreatedDate")],
            ["Last Modified By", `${sfc("LastModifiedBy_Full_Name__c") ?? ""}${sfcDate("LastModifiedDate") ? `, ${sfcDate("LastModifiedDate")}` : ""}`.trim() || sfcDate("LastModifiedDate")],
          ]}
        />
        {/* Description (full width) — SF renders Description as a full-row
            below the Account Engagement pair grid. */}
        <div style={{ padding: "8px 0", display: "grid", gridTemplateColumns: "minmax(120px, 165px) 1fr 24px", gap: 12, alignItems: "start" }}>
          <div style={{ fontSize: 12, color: "#3e3e3c", paddingTop: 1 }}>Description</div>
          <div style={{ fontSize: 13, color: "#080707", whiteSpace: "pre-wrap" }}>{sfc("Description") ?? ""}</div>
          <div />
        </div>
      </ContactSection>

      <ContactSection title="Google Analytics" defaultOpen={false}>
        <ContactFieldGrid
          fields={[
            ["Google Analytics Campaign", sfc("pi__utm_campaign__c")],
            ["Google Analytics Source", sfc("pi__utm_source__c")],
            ["Google Analytics Medium", sfc("pi__utm_medium__c")],
            ["Google Analytics Content", sfc("pi__utm_content__c")],
            ["Google Analytics Term", sfc("pi__utm_term__c")],
          ]}
        />
      </ContactSection>
    </>
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
        { label: "Title", value: contact.title ?? sfc("Title") },
        {
          label: "Account Name",
          value: contact.primaryAccount?.name && (
            <Link href={`/accounts/${contact.primaryAccount.id}`} style={{ color: "#0176d3", textDecoration: "none" }}>
              {contact.primaryAccount.name}
            </Link>
          ),
        },
        { label: "Phone", value: contact.phone ?? sfc("Phone") },
        { label: "Mobile", value: contact.mobilePhone ?? sfc("MobilePhone") },
        {
          label: "Email",
          value: emailVal ? (
            <a href={`mailto:${emailVal}`} style={{ color: "#0176d3", textDecoration: "none" }}>
              {emailVal}
            </a>
          ) : null,
        },
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
