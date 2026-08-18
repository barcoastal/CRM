import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecordPage, StatusPill } from "@/components/slds/record-page";
import { PathSidePanelServer } from "@/components/path/path-side-panel-server";
import { Section, FieldGrid } from "@/components/slds/section";
import { E } from "@/components/slds/field-helpers";
import { ActivityChatterRail, type ChatterPost } from "@/components/slds/activity-chatter-rail";
import type { ActivityItem } from "@/components/slds/activity-rail";
import { LeadTabs } from "@/components/leads/lead-tabs";
import { RecordEmailActivity } from "@/components/email/record-email-activity";
import { LeadHeaderButtons } from "@/components/leads/lead-header-buttons";
import { LeadHealthCheckCard } from "@/components/leads/lead-health-check-card";
import { PaymentCalculatorV2 } from "@/components/shared/payment-calculator-v2";
import { DocumentsUpload } from "@/components/leads/documents-upload";
import { DebtInformation } from "@/components/leads/debt-information";
import { CreditorTable } from "@/components/leads/creditor-table";
import { LeadRelated } from "@/components/leads/lead-related";
import { SfDataSection } from "@/components/slds/sf-data-section";
import { RecordNotes } from "@/components/shared/record-notes";
import { resolveSfUserNames, isSfUserId } from "@/lib/sf-users";
import { NotesRailCard } from "@/components/shared/notes-rail-card";
import { fetchChainNotes } from "@/lib/notes";
import { CallButton } from "@/components/dialer/call-button";
import { ComposeEmailButton } from "@/components/emails/compose-email-button";
import { leadStatusTone } from "@/lib/slds/status-tones";
import { LEAD_STATUSES, type LeadStatusV2 } from "@/lib/sf-canonical";
import Link from "next/link";

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

/** Map a Lead.status value to the canonical PathGuidance stage label. */
function leadStageLabel(status: string): LeadStatusV2 {
  if ((LEAD_STATUSES as readonly string[]).includes(status)) return status as LeadStatusV2;
  const s = (status ?? "").toUpperCase().replace(/[_ ]+/g, "_");
  if (s === "CONVERTED" || s === "ENROLLED") return "Converted";
  if (s === "ARCHIVE_DISPOSITION" || s === "DNC" || s === "LOST" || s === "UNQUALIFIED") return "Archive Disposition";
  if (s === "WORKING_LEAD" || s === "CONTACTED" || s === "QUALIFIED" || s === "CALLBACK") return "Working Lead";
  return "New";
}

/** A real human owner name — never a numeric junk value like "1.0". */
function cleanOwnerName(...candidates: (string | null | undefined)[]): string | null {
  for (const c of candidates) {
    if (!c) continue;
    const s = String(c).trim();
    if (!s) continue;
    // Skip numeric-only junk (e.g. "1.0", "0", "1")
    if (/^-?\d+(\.\d+)?$/.test(s)) continue;
    if (s.toLowerCase() === "unknown") continue;
    return s;
  }
  return null;
}

/** Build a contact-name display value that falls back gracefully. */
function cleanContactName(
  primary: string | null | undefined,
  first: string | null | undefined,
  last: string | null | undefined,
): string {
  const p = (primary ?? "").trim();
  if (p && p.toLowerCase() !== "unknown") return p;
  const joined = `${(first ?? "").trim()} ${(last ?? "").trim()}`.trim();
  if (joined) return joined;
  return "Unknown";
}

/** Render Yes/No for boolean-ish values that SF stores as "1"/"0"/"true". */
function yesNo(v: string | null): string | null {
  if (v == null) return null;
  const s = v.trim().toLowerCase();
  if (["true", "1", "1.0", "yes"].includes(s)) return "Yes";
  if (["false", "0", "0.0", "no"].includes(s)) return "No";
  return v;
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
      meta: `${c.disposition ?? "-"} · ${c.agent.name}`,
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

  let sfData: Record<string, unknown> = {};
  try { sfData = lead.sfDataJson ? JSON.parse(lead.sfDataJson) as Record<string, unknown> : {}; } catch { /* keep empty */ }
  const sf = (k: string): string | null => {
    const v = sfData[k];
    if (v == null || v === "") return null;
    return String(v);
  };
  // Fronter/Closer/Call lookups hold raw SF user ids; show real user names.
  const sfUserMap = await resolveSfUserNames([
    sf("FronterLookup__c"),
    sf("CloserLookup__c"),
    sf("Call_Transferred_By_Lookup__c"),
    sf("Call_Received_By_Lookup__c"),
  ]);
  const sfUser = (k: string): React.ReactNode => {
    const v = sf(k);
    if (!v) return null;
    if (!isSfUserId(v)) return v;
    const u = sfUserMap.get(v.trim());
    return u ? (
      <Link key={k} href={`/settings/users/${u.id}`} style={{ color: "#0176d3" }}>
        {u.name}
      </Link>
    ) : (
      v
    );
  };

  const sfDollar = (k: string): string | null => {
    const v = sf(k);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? `$${n.toLocaleString()}` : v;
  };
  const sfDate = (k: string): string | null => {
    const v = sf(k);
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString();
  };

  // Resolved Owner — strip "1.0" style numeric junk that came in via assignedTo.name
  // (some legacy migration rows stored numeric counters in the user.name column).
  const ownerName = cleanOwnerName(
    lead.assignedTo?.name,
    sf("Owner_Full_Name__c"),
    sf("Owner_Username__c"),
  );

  // Resolved contact name — never display the literal string "Unknown" if SF
  // FirstName + LastName are available.
  const displayContactName = cleanContactName(
    lead.contactName,
    sf("FirstName"),
    sf("LastName"),
  );

  // Lead Id — SF leads have an 18-char Salesforce Id (e.g. 00QVO0000...); fall
  // back to the last 8 of our CRM uuid if the lead never had an sfId.
  const displayLeadId = lead.sfId ?? lead.id.slice(-8).toUpperCase();

  const phoneVal = lead.phone ?? sf("Phone");
  const emailVal = lead.email ?? sf("Email");
  const mobileVal = sf("MobilePhone");

  // Section 1: Lead Information (TwoColumnsTopToBottom)
  // Source: docs/sf-export/sfdx-raw/layouts/Lead-Lead Layout.layout-meta.xml
  // Column 1 has 34 fields; column 2 has 17 fields. We interleave row-by-row
  // until col2 is exhausted, then list the remaining col1 fields. All 34 col1
  // fields are rendered in SF order (counters + sync flag included) so the
  // rows line up with SF exactly.
  // SF marks the first Lead Information section detailHeading=false, so
  // Lightning shows its fields with NO section header. Bare grid, like SF.
  const leadInformation = (
    <div>
      <FieldGrid
        entityType="lead"
        entityId={lead.id}
        fields={[
          // Row 1: Name | SSN
          E("Name", displayContactName, "contactName", "text", { rawValue: lead.contactName }),
          E("SSN", sf("SSN__c"), "SSN__c"),
          // Row 2: Email | Date Of Birth
          [
            "Email",
            <span key="em" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{emailVal ?? "-"}{emailVal && <ComposeEmailButton defaultTo={emailVal} leadId={lead.id} label="" />}</span>,
            { fieldKey: "email", type: "email", rawValue: lead.email ?? emailVal },
          ],
          E("Date Of Birth", sfDate("Date_Of_Birth__c"), "Date_Of_Birth__c", "date"),
          // Row 3: Alternate Email | Gender
          E("Alternate Email", sf("Alternate_Email__c"), "Alternate_Email__c", "email"),
          E("Gender", sf("Gender__c"), "Gender__c"),
          // Row 4: Phone | Title
          [
            "Phone",
            <span key="ph" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{phoneVal ?? "-"}{phoneVal && <CallButton phone={phoneVal} leadId={lead.id} />}</span>,
            { fieldKey: "phone", type: "phone", rawValue: lead.phone ?? phoneVal },
          ],
          E("Title", sf("Title"), "Title"),
          // Row 5: Mobile | Address (compound)
          E("Mobile", mobileVal, "MobilePhone", "phone"),
          ["Address", [sf("Street"), sf("City"), sf("State"), sf("PostalCode"), sf("Country")].filter(Boolean).join(", ") || null],
          // Row 6: Work Phone | Timezone
          E("Work Phone", sf("Work_Phone__c"), "Work_Phone__c", "phone"),
          ["Timezone", sf("Timezone__c")],
          // Row 7: Fax | IP Address
          E("Fax", sf("Fax"), "Fax"),
          ["IP Address", sf("IP_Address__c")],
          // Row 8: Preferred method of Contact | Keyword
          E("Preferred method of Contact", sf("Preferred_method_of_Contact__c"), "Preferred_method_of_Contact__c"),
          E("Keyword", sf("Keyword__c"), "Keyword__c"),
          // Row 9: Legal Plan Required | Secured Party
          E("Legal Plan Required", yesNo(sf("Legal_Plan_Required__c")), "Legal_Plan_Required__c", "checkbox"),
          E("Secured Party", sf("Secured_Party__c"), "Secured_Party__c"),
          // Row 10: External ID 15 digit | Call ASAP
          ["External ID 15 digit", sf("External_ID_15_digit__c")],
          E("Call ASAP", yesNo(sf("Call_ASAP__c")), "Call_ASAP__c", "checkbox"),
          // Row 11: Outbound ANI Date | Hopper Priority
          ["Outbound ANI Date", sfDate("Outbound_ANI_Date__c")],
          E("Hopper Priority", sf("Hopper_Priority__c"), "Hopper_Priority__c", "number"),
          // Row 12: Outbound ANI Identifier | Outbound ANI From
          ["Outbound ANI Identifier", sf("Outbound_ANI_Identifier__c")],
          ["Outbound ANI From", sf("Outbound_ANI_From__c")],
          // Row 13: Hubspot Id | Preferred Language
          ["Hubspot Id", sf("Hubspot_Id__c")],
          E("Preferred Language", sf("Preferred_Language__c"), "Preferred_Language__c"),
          // Row 14: Append Leads Counter | Lead Assignment Date (SF col1 row 14)
          ["Append Leads Counter", sf("Append_Leads_Counter__c")],
          ["Lead Assignment Date", lead.leadAssignmentDate?.toLocaleDateString() ?? sfDate("Lead_Assignment_Date__c")],
          // Row 15: Has Calendly Event | Verified Phone Number
          ["Has Calendly Event", yesNo(sf("Has_Calendly_Event__c"))],
          ["Verified Phone Number", yesNo(sf("Verified_Phone_Number__c"))],
          // Row 16: Call counter | MCA Lender External Id
          ["Call counter", sf("Call_counter__c")],
          ["MCA Lender External Id", sf("MCA_Lender_External_Id__c")],
          // Row 17: Is Archived | Five9 Final Stage
          ["Is Archived", yesNo(sf("Is_Archived__c"))],
          ["Five9 Final Stage", yesNo(sf("Five9_Final_Stage__c"))],
          // Col2 exhausted from here; continue col1 in SF order.
          ["Archived Date", sfDate("Archived_Date__c")],
          ["", null],
          ["IPQS IsActive", yesNo(sf("IPQS_IsActive__c"))],
          ["", null],
          // Col2 exhausted; remaining col1 fields (one per row, left column).
          ["IPQS Active Status", sf("IPQS_Active_Status__c")],
          ["", null],
          ["IPQS Carrier", sf("IPQS_Carrier__c")],
          ["", null],
          ["IPQS Email", sf("IPQS_Email__c")],
          ["", null],
          ["IPQS Fraud Score", sf("IPQS_Fraud_Score__c")],
          ["", null],
          ["IPQS Is Prepaid", yesNo(sf("IPQS_Is_Prepaid__c"))],
          ["", null],
          ["IPQS Line Type", sf("IPQS_Line_Type__c")],
          ["", null],
          ["IPQS Is Risky", yesNo(sf("IPQS_Is_Risky__c"))],
          ["", null],
          ["IPQS Is VOIP", yesNo(sf("IPQS_Is_VOIP__c"))],
          ["", null],
          ["IPQS Is Valid", yesNo(sf("IPQS_Is_Valid__c"))],
          ["", null],
          ["Lead Score", sf("Lead_Score__c")],
          ["", null],
          ["Ad Click Id", sf("Ad_Click_Id__c")],
          ["", null],
          ["Sync To Account Engagement", yesNo(sf("Sync_To_Account_Engagement__c"))],
          ["", null],
          ["Facebook Lead Id", sf("Facebook_Lead_Id__c")],
          ["", null],
          ["Total Dial Attempts", sf("Total_Dial_Attempts__c")],
          ["", null],
          ["Eli Ad click", sf("Eli_Ad_click__c")],
          ["", null],
        ]}
      />
      {lead.scoreReason && (
        <div style={{ marginTop: 12, fontSize: 12, color: "#747474" }}>
          <strong>Score reason:</strong> {lead.scoreReason}
        </div>
      )}
    </div>
  );

  // Section 2: Company Information (TwoColumnsLeftToRight)
  // SF interleaves [col1[0], col2[0], col1[1], col2[1], ...].
  const companyInformation = (
    <Section title="Company Information">
      <FieldGrid
        entityType="lead"
        entityId={lead.id}
        fields={[
          // Row 1: Company | EIN Number / Tax Id
          E("Company", lead.businessName ?? sf("Company"), "businessName", "text", { rawValue: lead.businessName }),
          E("EIN Number / Tax Id", lead.ein ?? sf("EIN_Number_Tax_Id__c"), "ein", "text", { rawValue: lead.ein }),
          // Row 2: Annual Revenue | Monthly Revenue
          E("Annual Revenue", lead.annualRevenue ? `$${lead.annualRevenue.toLocaleString()}` : sfDollar("AnnualRevenue"), "annualRevenue", "number", { rawValue: lead.annualRevenue ?? null }),
          E("Monthly Revenue", sfDollar("Monthly_Revenue__c"), "Monthly_Revenue__c", "number"),
          // Row 3: Business Start Date | UCC filing Date
          E("Business Start Date", sfDate("Business_Start_Date__c"), "Business_Start_Date__c", "date"),
          ["UCC filing Date", sfDate("UCC_filing_Date__c")],
          // Row 4: Industry | (empty)
          E("Industry", lead.industry ?? sf("Industry"), "industry", "text", { rawValue: lead.industry }),
          ["", null],
        ]}
      />
    </Section>
  );

  // Section 3: Current Debt Information (TwoColumnsLeftToRight)
  const currentDebtInformation = (
    <Section title="Current Debt Information">
      <FieldGrid
        entityType="lead"
        entityId={lead.id}
        fields={[
          // Row 1: MCA Amount | Estimated Total Debt
          E("MCA Amount", sfDollar("MCA_Amount__c"), "MCA_Amount__c", "number"),
          E("Estimated Total Debt", lead.totalDebtEst ? `$${lead.totalDebtEst.toLocaleString()}` : sf("Estimated_Total_Debt__c"), "totalDebtEst", "number", { rawValue: lead.totalDebtEst ?? null }),
          // Row 2: Current Total Monthly Payment Formula | Current Total Daily Payment
          ["Current Total Monthly Payment", sfDollar("Current_Total_Monthly_Payment_Formula__c") ?? sfDollar("Current_Total_Monthly_Payment__c")],
          ["Current Total Daily Payment", sfDollar("Current_Total_Daily_Payment__c")],
          // Row 3: (empty) | Current Total Weekly Payment
          ["", null],
          ["Current Total Weekly Payment", lead.currentTotalWeeklyPayment ? `$${lead.currentTotalWeeklyPayment.toLocaleString()}` : sfDollar("Current_Total_Weekly_Payment__c")],
        ]}
      />
    </Section>
  );

  // Section 4: Debt Calculation (TwoColumnsLeftToRight)
  const debtCalculation = (
    <Section title="Debt Calculation" defaultOpen={false}>
      <FieldGrid
        fields={[
          // Row 1: Total Debt Amount | Frequency
          ["Total Debt Amount", sfDollar("Total_Debt_Amount__c")],
          ["Frequency", sf("Frequency__c")],
          // Row 2: Payment Amount | Monthly Bank Fee
          ["Payment Amount", sfDollar("Payment_Amount__c")],
          ["Monthly Bank Fee", sfDollar("Monthly_Bank_Fee__c")],
          // Row 3: Setup Fee | Program Fee Percentage
          ["Setup Fee", sfDollar("Setup_Fee__c")],
          ["Program Fee Percentage", sf("Program_Fee_Percentage__c")],
          // Row 4: Retainer Percentage | Settlement Percentage
          ["Retainer Percentage", sf("Retainer_Percentage__c")],
          ["Settlement Percentage", sf("Settlement_Percentage__c")],
          // Row 5: Payment Term | Down Payment
          ["Payment Term", sf("Payment_Term__c")],
          ["Down Payment", sfDollar("Down_Payment__c")],
        ]}
      />
    </Section>
  );

  // Section 5: Call Disposition (TwoColumnsLeftToRight)
  const callDisposition = (
    <Section title="Call Disposition" defaultOpen={false}>
      <FieldGrid
        fields={[
          // Row 1: Fronter | Closer
          ["Fronter", sfUser("FronterLookup__c")],
          ["Closer", sfUser("CloserLookup__c")],
          // Row 2: Call Transferred By | Call Received By
          ["Call Transferred By", sfUser("Call_Transferred_By_Lookup__c")],
          ["Call Received By", sfUser("Call_Received_By_Lookup__c")],
          // Row 3: Call Tranferred DateTime | Call Received Date
          ["Call Tranferred DateTime", sfDate("Call_Tranferred_DateTime__c")],
          ["Call Received Date", sfDate("Call_Received_Date__c")],
          // Row 4: Call Transfer Status | Transfer Qualification
          ["Call Transfer Status", sf("Call_Transfer_Status__c")],
          ["Transfer Qualification", sf("Transfer_Qualification__c")],
          // Row 5: Outbound Call Priority | Reason for Disqualification
          ["Outbound Call Priority", sf("Outbound_Call_Priority__c")],
          ["Reason for Disqualification", sf("Reason_for_Disqualification__c")],
          // Row 6: Agent Location | (empty)
          ["Agent Location", sf("Agent_Location__c")],
          ["", null],
        ]}
      />
    </Section>
  );

  // Section 6: Five9 Fields (TwoColumnsLeftToRight)
  const five9Fields = (
    <Section title="Five9 Fields" defaultOpen={false}>
      <FieldGrid
        fields={[
          // Row 1: Dialer Group | Add to f9list Id
          ["Dialer Group", sf("Dialer_Group__c")],
          ["Add to f9list Id", sf("Add_to_f9list_Id__c")],
          // Row 2: five9 Disposition | Delete from f9list id
          ["five9 Disposition", sf("five9_Disposition__c")],
          ["Delete from f9list id", sf("Delete_from_f9list_id__c")],
          // Row 3: five9 Last Disposition | Five9 List Id
          ["five9 Last Disposition", sf("five9_Last_Disposition__c")],
          ["Five9 List Id", sf("Five9_List_Id__c")],
          // Row 4: Five9 Time To Call | Five9 List Updated by Convoso Batch
          ["Five9 Time To Call", sf("Five9_Time_To_Call__c")],
          ["Five9 List Updated by Convoso Batch", yesNo(sf("Five9_List_Updated_by_Convoso_Batch__c"))],
        ]}
      />
    </Section>
  );

  // Section 7: Lead Information (2nd) — TwoColumnsLeftToRight
  // SF has two sections labeled "Lead Information"; this second one carries
  // status / disposition / vendor metadata. Skipped per "dev/internal" rule:
  //   RecordTypeId (we already show recordType on the header subtitle).
  const leadInformationSecondary = (
    <Section title="Lead Information">
      <FieldGrid
        entityType="lead"
        entityId={lead.id}
        fields={[
          // Row 1: Lead Vendor ID | Lead Vendor Id Text
          E("Lead Vendor ID", sf("Lead_Vendor_ID__c"), "Lead_Vendor_ID__c"),
          E("Lead Vendor Id Text", sf("Lead_Vendor_Id_Text__c"), "Lead_Vendor_Id_Text__c"),
          // Row 2: Owner | Lead Id
          ["Owner", ownerName],
          ["Lead Id", sf("Lead_Id__c")],
          // Row 3: Record Type | List Id
          ["Record Type", lead.recordType.replace(/_/g, " ")],
          ["List Id", sf("List_Id__c")],
          // Row 4: Lead Source Category | Lead Source
          E("Lead Source Category", sf("Lead_Source_Category__c"), "Lead_Source_Category__c"),
          E("Lead Source", lead.source ?? sf("LeadSource"), "source", "text", { rawValue: lead.source }),
          // Row 5: Status | Last Disposition
          [
            "Status",
            <StatusPill key="st" label={lead.status} tone={leadStatusTone(lead.status)} />,
            { fieldKey: "status", type: "select", rawValue: lead.status, options: LEAD_STATUSES.map((s) => ({ label: s, value: s })) },
          ],
          E("Last Disposition", lead.lastDisposition ?? sf("Last_Disposition__c"), "lastDisposition", "text", { rawValue: lead.lastDisposition }),
          // Row 6: Check Duplicate | Last Disposition DateTime
          ["Check Duplicate", yesNo(sf("Check_Duplicate__c"))],
          ["Last Disposition DateTime", lead.lastDispositionAt?.toLocaleString() ?? sfDate("Last_Disposition_DateTime__c")],
          // Row 7: Check Duplicate Archive | Sub Disposition
          ["Check Duplicate Archive", yesNo(sf("Check_Duplicate_Archive__c"))],
          E("Sub Disposition", sf("Sub_Disposition__c"), "Sub_Disposition__c"),
          // Row 8: Check DNC | Last Sub Disposition
          ["Check DNC", yesNo(sf("Check_DNC__c"))],
          E("Last Sub Disposition", lead.lastSubDisposition ?? sf("Last_Sub_Disposition__c"), "lastSubDisposition", "text", { rawValue: lead.lastSubDisposition }),
          // Row 9: Check Wireless | Last Contacted DateTime
          ["Check Wireless", yesNo(sf("Check_Wireless__c"))],
          E("Last Contacted DateTime", lead.lastContactedAt?.toLocaleString() ?? sfDate("Last_Contacted_DateTime__c"), "lastContactedAt", "datetime", { rawValue: lead.lastContactedAt ?? null }),
          // Row 10: UTM Term | Week Days Between Last Contacted Date
          ["UTM Term", lead.utmTerm ?? sf("UTM_Term__c")],
          ["Week Days Between Last Contacted Date", sf("Week_Days_Between_Last_Contacted_Date__c")],
          // Row 11: (empty) | Vendor Code
          ["", null],
          ["Vendor Code", sf("Vendor_Code__c")],
        ]}
      />
    </Section>
  );

  // Section 8: Creditor Information — rendered as an SF-style table from the
  // flat Creditor_1..10 fields in sfDataJson (matches the Salesforce layout).
  const sfNum = (k: string): number | null => {
    const v = sfData[k];
    if (v == null || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  const creditorRows = Array.from({ length: 10 }, (_, i) => i + 1)
    .map((n) => ({
      name: sf(`Creditor_${n}_Name__c`) ?? "",
      debt: sfNum(`Creditor_${n}_Total_Debt__c`),
      payment: sfNum(`Creditor_${n}_Payment__c`),
      frequency: sf(`Creditor_${n}_Payment_Frequency__c`),
    }))
    .filter((r) => r.name.trim() !== "" || r.debt != null || r.payment != null);
  const creditorInformation = (
    <Section title="Creditor Information">
      <CreditorTable rows={creditorRows} />
    </Section>
  );

  // Section 9: Account Engagement (TwoColumnsLeftToRight)
  // SF layout col1 mixes HasOptedOutOfEmail + pi__* + Form_* fields.
  // SF Account Engagement — exact interleave of the Lead Layout XML
  // (col1: opt-out, campaign, comments, conversion, created, first activity,
  // first touch, first search term, Form Name/Position/Type; col2: first search
  // type, grade, hard bounced, last activity, last scored, notes, score, url,
  // Form Page/SubPage).
  const accountEngagement = (
    <Section title="Account Engagement" defaultOpen={false}>
      <FieldGrid
        fields={[
          // Row 1: Email Opt Out | First Search Type
          ["Email Opt Out", yesNo(sf("HasOptedOutOfEmail"))],
          ["First Search Type", sf("pi__first_search_type__c")],
          // Row 2: Campaign | Grade
          ["Campaign", sf("pi__campaign__c")],
          ["Grade", sf("pi__grade__c")],
          // Row 3: Comments | Hard Bounced
          ["Comments", sf("pi__comments__c")],
          ["Hard Bounced", yesNo(sf("pi__pardot_hard_bounced__c"))],
          // Row 4: Conversion Date | Last Activity
          ["Conversion Date", sfDate("pi__conversion_date__c")],
          ["Last Activity", sfDate("pi__last_activity__c")],
          // Row 5: Created Date | Last Scored At
          ["Created Date", sfDate("pi__created_date__c")],
          ["Last Scored At", sfDate("pi__Pardot_Last_Scored_At__c")],
          // Row 6: First Activity | Notes
          ["First Activity", sfDate("pi__first_activity__c")],
          ["Notes", sf("pi__notes__c")],
          // Row 7: First Touch URL | Score
          ["First Touch URL", sf("pi__first_touch_url__c")],
          ["Account Engagement Score", sf("pi__score__c")],
          // Row 8: First Search Term | URL
          ["First Search Term", sf("pi__first_search_term__c")],
          ["URL", sf("pi__url__c")],
          // Row 9: Form Name | Form Page
          ["Form Name", sf("Form_Name__c")],
          ["Form Page", sf("Form_Page__c")],
          // Row 10: Form Position | Form SubPage
          ["Form Position", sf("Form_Position__c")],
          ["Form SubPage", sf("Form_SubPage__c")],
          // Row 11: Form Type | (right col exhausted)
          ["Form Type", sf("Form_Type__c")],
          ["", null],
        ]}
      />
    </Section>
  );

  // Sections 10-11: Additional Information + Description Information.
  // SF marks both detailHeading=false, so Lightning renders their fields with
  // NO section headers, flowing after the last headed section. Bare grids.
  const additionalInformation = (
    <FieldGrid
      fields={[
        // Row 1: Product Interest | Current Generators
        ["Product Interest", sf("ProductInterest__c")],
        ["Current Generators", sf("CurrentGenerators__c")],
        // Row 2: SIC Code | Number of Locations
        ["SIC Code", sf("SICCode__c")],
        ["Number of Locations", sf("NumberofLocations__c")],
        // Row 3: Created By | Last Modified By
        ["Created By", sf("CreatedById")],
        ["Last Modified By", sf("LastModifiedById")],
      ]}
    />
  );

  const descriptionInformation = (
    <FieldGrid
      columns={1}
      fields={[
        ["Description", sf("Description")],
        ["Lenders", sf("Lenders__c")],
      ]}
    />
  );

  // SF Lead detail does NOT show a giant in-body "Convert" call-to-action — the
  // Convert action is the header button. We surface a slim post-conversion
  // breadcrumb at the very top of Details so users can jump to the converted
  // Account / Opportunity, but skip the big CTA banner entirely.
  const chainOppsForNotes = await prisma.opportunity.findMany({
    where: { leadId: lead.id },
    select: { id: true, accountId: true },
  });
  const chainNotes = await fetchChainNotes({
    leadIds: [lead.id],
    opportunityIds: chainOppsForNotes.map((o) => o.id),
    accountIds: [...chainOppsForNotes.map((o) => o.accountId), lead.convertedAccountId],
  });

  const details = (
    <>
      {converted && (
        <div
          style={{
            background: "#f0f9f4",
            border: "1px solid #c4e4cf",
            borderRadius: 4,
            padding: "10px 14px",
            marginBottom: 12,
            fontSize: 13,
            color: "#08503e",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ fontWeight: 700 }}>Converted.</span>
          <Link href={`/accounts/${converted.accountId}`} style={{ color: "#0176d3" }}>View account</Link>
          <Link href={`/contacts/${converted.contactId}`} style={{ color: "#0176d3" }}>View contact</Link>
          {converted.opportunityId && (
            <Link href={`/opportunities/${converted.opportunityId}`} style={{ color: "#0176d3" }}>View opportunity</Link>
          )}
        </div>
      )}
      {/* SF Lead Layout XML section order (Lead-Lead Layout.layout-meta.xml):
         1. Lead Information (TwoColumnsTopToBottom)
         2. Company Information
         3. Current Debt Information
         4. Debt Calculation
         5. Call Disposition
         6. Five9 Fields
         7. Lead Information (status + vendor metadata; same label as section 1)
         8. Creditor Information
         9. Account Engagement
        10. Additional Information
        11. Description Information
       Skipped — empty in XML: Address Information, System Information, Custom Links. */}
      {leadInformation}
      {companyInformation}
      {currentDebtInformation}
      {debtCalculation}
      {callDisposition}
      {five9Fields}
      {leadInformationSecondary}
      {creditorInformation}
      {accountEngagement}
      {additionalInformation}
      {descriptionInformation}
      {lead.notes && (
        <Section title="Notes (from Salesforce)" defaultOpen={false}>
          <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{lead.notes}</div>
        </Section>
      )}

      <RecordNotes
        notes={chainNotes.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))}
        attach={{ leadId: lead.id }}
      />
    </>
  );

  const calc = (
    <Section title="Lead Calculator">
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

  // SF "Debt Information" tab: surfaces the current debt rollup + per-debt
  // detail rows. In the SF org these fields live under their own tab so the
  // Details panel stays focused on lead / company information.
  const debtInformationPanel = (
    <Section title="Debt Information">
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

  const openActivities = [
    ...lead.tasks
      .filter((t) => t.status !== "COMPLETED")
      .map((t) => ({
        id: t.id,
        kind: (t.type === "CALL" ? "CALL" : "TASK") as "TASK" | "CALL",
        subject: t.subject,
        status: t.status,
        dueDate: t.dueDate,
        assignedTo: null,
      })),
    ...lead.events
      .filter((e) => e.status !== "COMPLETED")
      .map((e) => ({
        id: e.id,
        kind: "EVENT" as const,
        subject: e.subject,
        status: e.status,
        dueDate: e.startAt,
        assignedTo: null,
      })),
  ];

  const activityHistory = [
    ...lead.tasks
      .filter((t) => t.status === "COMPLETED")
      .map((t) => ({
        id: t.id,
        kind: (t.type === "CALL" ? "CALL" : "TASK") as "TASK" | "CALL",
        subject: t.subject,
        outcome: t.outcome ?? t.disposition,
        completedAt: t.completedAt ?? t.createdAt,
      })),
    ...lead.calls.map((c) => ({
      id: c.id,
      kind: "CALL" as const,
      subject: `Call to ${c.phoneNumber}`,
      outcome: c.disposition,
      completedAt: c.startedAt,
    })),
    ...lead.emails.map((m) => ({
      id: m.id,
      kind: "EMAIL" as const,
      subject: m.subject,
      outcome: m.status,
      completedAt: m.sentAt ?? m.createdAt,
    })),
    ...lead.sms.map((m) => ({
      id: m.id,
      kind: "SMS" as const,
      subject: m.body.slice(0, 80),
      outcome: m.status,
      completedAt: m.sentAt ?? m.createdAt,
    })),
  ].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

  const related = (
    <LeadRelated
      asyncOps={[]}
      openActivities={openActivities}
      activityHistory={activityHistory}
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
          ["Ad Click Id", sf("Ad_Click_Id__c")],
          ["Ad Id", sf("Ad_Id__c")],
          ["Ad Set", sf("Ad_Set__c")],
          ["Hubspot Id", sf("Hubspot_Id__c")],
        ]}
      />
    </Section>
  );

  return (
    <RecordPage
      entity="Lead"
      entityLabel="Lead"
      recordTitle={displayContactName !== "Unknown" ? displayContactName : (lead.businessName ?? "Unknown Lead")}
      recordSubtitle={
        <>
          {lead.recordType.replace(/_/g, " ")} ·{" "}
          <StatusPill label={lead.status} tone={leadStatusTone(lead.status)} />
        </>
      }
      highlights={[
        // SF Lead detail highlights row (verified against the live org):
        // Company | Phone | Email | Lead Id.
        { label: "Company", value: lead.businessName },
        { label: "Phone", value: phoneVal },
        { label: "Email", value: emailVal },
        { label: "Lead Id", value: displayLeadId },
      ]}
      actions={<LeadHeaderButtons leadId={lead.id} currentStage={stage} converted={!!converted} defaultEmail={emailVal} defaultPhone={phoneVal} businessName={lead.businessName ?? undefined} contactName={displayContactName} />}
      pathStages={LEAD_PATH}
      pathCurrentIndex={Math.max(0, leadPathIndex(lead.status))}
      details={
        <>
          <PathSidePanelServer
            entityType="Lead"
            stage={leadStageLabel(lead.status)}
            record={lead as unknown as Record<string, unknown>}
          />
          <LeadTabs
            panels={{
              Details: details,
              "Debt Information": debtInformationPanel,
              "Payment Calculator": calc,
              Documents: documents,
              Related: related,
              Emails: <RecordEmailActivity entity="lead" id={lead.id} />,
              Marketing: marketing,
              "All SF Fields": sfFields,
            }}
          />
        </>
      }
      rail={
        // SF Lead detail rail order:
        //   1. Health Check Results  (always at top per SF Lightning)
        //   2. Activity / Chatter tabs
        // The Lead Score and "Related Records" (Owner + converted links) cards
        // were CRM extras that pushed Health Check below the fold; SF Lead pages
        // don't show them on the rail (Owner is in the highlights and converted
        // breadcrumb is in Details).
        <>
          <LeadHealthCheckCard
            status={lead.status}
            businessName={lead.businessName}
            contactName={displayContactName}
            industry={lead.industry}
            totalDebtEst={lead.totalDebtEst}
            source={lead.source}
            leadSourceLabel={sf("LeadSource")}
            isPaymentAmountPopulated={
              sf("Is_Payment_Amount_Populated__c") === "true" ||
              sfData["Is_Payment_Amount_Populated__c"] === true
            }
            hasCreditorInfo={lead.debts.length > 0 || (lead.totalDebtEst ?? 0) > 0}
            callDispositionPopulated={
              !!sf("CloserLookup__c") &&
              !!sf("Call_Transfer_Status__c") &&
              !!sf("Call_Received_By_Lookup__c") &&
              !!sf("Call_Received_Date__c")
            }
          />
          <NotesRailCard
              notes={chainNotes.map((n) => ({ id: n.id, body: n.body, author: n.author, createdAt: n.createdAt.toISOString(), source: n.source }))}
              attach={{ leadId: lead.id }}
            />
            <ActivityChatterRail activities={activity} chatter={chatter} leadId={lead.id} defaultEmail={emailVal} />
        </>
      }
    />
  );
}

// LeadScoreCard + RelatedRecordsCard removed: SF Lead detail rail doesn't
// surface either. Lead Score is shown as a tone next to the status pill on
// the path; owner lives in the highlights row; converted-record links live
// in the in-Details breadcrumb at the top of the Details panel.
