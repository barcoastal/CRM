import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecordPage, StatusPill } from "@/components/slds/record-page";
import { Section, FieldGrid, E } from "@/components/slds/section";
import { ActivityChatterRail, type ChatterPost } from "@/components/slds/activity-chatter-rail";
import type { ActivityItem } from "@/components/slds/activity-rail";
import { LeadTabs } from "@/components/leads/lead-tabs";
import { LeadHeaderButtons } from "@/components/leads/lead-header-buttons";
import { LeadHealthCheckCard } from "@/components/leads/lead-health-check-card";
import { PaymentCalculatorV2 } from "@/components/shared/payment-calculator-v2";
import { DocumentsUpload } from "@/components/leads/documents-upload";
import { DebtInformation } from "@/components/leads/debt-information";
import { LeadRelated } from "@/components/leads/lead-related";
import { SfDataSection } from "@/components/slds/sf-data-section";
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

  const leadInformation = (
    <Section title="Lead Information">
      <FieldGrid
        entityType="lead"
        entityId={lead.id}
        fields={[
          E("Name", displayContactName, "contactName", "text", { rawValue: lead.contactName }),
          E("Salutation", sf("Salutation"), "Salutation"),
          E("Title", sf("Title"), "Title"),
          [
            "Phone",
            <span key="ph" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{phoneVal ?? "-"}{phoneVal && <CallButton phone={phoneVal} leadId={lead.id} />}</span>,
            { fieldKey: "phone", type: "phone", rawValue: lead.phone ?? phoneVal },
          ],
          E("Mobile Phone", mobileVal, "MobilePhone", "phone"),
          ["Formated Phone", sf("Formated_Phone__c")],
          [
            "Email",
            <span key="em" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{emailVal ?? "-"}{emailVal && <ComposeEmailButton defaultTo={emailVal} leadId={lead.id} label="Email" />}</span>,
            { fieldKey: "email", type: "email", rawValue: lead.email ?? emailVal },
          ],
          E("Preferred Language", sf("Preferred_Language__c"), "Preferred_Language__c"),
          E("Timezone", sf("Timezone__c"), "Timezone__c"),
          E("Lead Source", lead.source ?? sf("LeadSource"), "source", "text", { rawValue: lead.source }),
          E("Lead Source Category", sf("Lead_Source_Category__c"), "Lead_Source_Category__c"),
          E("Lead Vendor ID", sf("Lead_Vendor_ID__c"), "Lead_Vendor_ID__c"),
          E("Lead Vendor Id Text", sf("Lead_Vendor_Id_Text__c"), "Lead_Vendor_Id_Text__c"),
          E("Campaign Name", sf("Campaign_Name__c"), "Campaign_Name__c"),
          E("Keyword", sf("Keyword__c"), "Keyword__c"),
          [
            "Status",
            <StatusPill key="st" label={lead.status} tone={leadStatusTone(lead.status)} />,
            { fieldKey: "status", type: "select", rawValue: lead.status, options: LEAD_STATUSES.map((s) => ({ label: s, value: s })) },
          ],
          E("Sub Disposition", sf("Sub_Disposition__c"), "Sub_Disposition__c"),
          E("Last Disposition", lead.lastDisposition ?? sf("Last_Disposition__c"), "lastDisposition", "text", { rawValue: lead.lastDisposition }),
          E("Last Sub Disposition", lead.lastSubDisposition ?? sf("Last_Sub_Disposition__c"), "lastSubDisposition", "text", { rawValue: lead.lastSubDisposition }),
          E("Transfer Qualification", sf("Transfer_Qualification__c"), "Transfer_Qualification__c"),
          ["Owner", ownerName],
          ["Owner Full Name", sf("Owner_Full_Name__c")],
          ["Owner Username", sf("Owner_Username__c")],
          E("Agent", sf("Agent__c"), "Agent__c"),
          E("Agent Location", sf("Agent_Location__c"), "Agent_Location__c"),
          E("Fronter", sf("Fronter__c"), "Fronter__c"),
          ["Lead Assignment Date", lead.leadAssignmentDate?.toLocaleDateString() ?? sfDate("Lead_Assignment_Date__c")],
          E("Last Contacted DateTime", lead.lastContactedAt?.toLocaleString() ?? sfDate("Last_Contacted_DateTime__c"), "lastContactedAt", "datetime", { rawValue: lead.lastContactedAt ?? null }),
          ["Last Disposition DateTime", lead.lastDispositionAt?.toLocaleString() ?? sfDate("Last_Disposition_DateTime__c")],
          ["Week Days Between Last Contacted Date", sf("Week_Days_Between_Last_Contacted_Date__c")],
          E("Next Follow-up", lead.nextFollowUpAt?.toLocaleDateString(), "nextFollowUpAt", "date", { rawValue: lead.nextFollowUpAt ?? null }),
          ["Call counter", sf("Call_counter__c")],
          E("Hopper Priority", sf("Hopper_Priority__c"), "Hopper_Priority__c"),
          E("Hopper", yesNo(sf("Hopper__c")), "Hopper__c"),
          E("Call ASAP", yesNo(sf("Call_ASAP__c")), "Call_ASAP__c"),
          ["DNC", yesNo(sf("DNC__c"))],
          ["Check DNC", yesNo(sf("Check_DNC__c"))],
          ["Address", [sf("Street"), sf("City"), sf("State"), sf("PostalCode"), sf("Country")].filter(Boolean).join(", ") || null],
          ["Lead ID", displayLeadId],
          ["Lead Id", sf("Lead_Id__c")],
          ["External 18 Digit ID", sf("External_18_Digit_ID__c")],
          ["External ID 15 digit", sf("External_ID_15_digit__c")],
          ["Lead Score", sf("Lead_Score__c")],
          ["Lead Appended Timestamp", sfDate("Lead_Appended_Timestamp__c")],
          ["Reason for Disqualification", sf("Reason_for_Disqualification__c")],
          ["Is Archived", yesNo(sf("Is_Archived__c"))],
          ["Archived Duplicate Leads", yesNo(sf("Archived_Duplicate_Leads__c"))],
          ["Check Duplicate Archive", yesNo(sf("Check_Duplicate_Archive__c"))],
          ["Re-shuffle Lead", yesNo(sf("Re_shuffle_Lead__c"))],
          ["Reshuffle Lead", yesNo(sf("Reshuffle_Lead__c"))],
          ["Legal Plan Required", yesNo(sf("Legal_Plan_Required__c"))],
        ]}
      />
      {lead.scoreReason && (
        <div style={{ marginTop: 12, fontSize: 12, color: "#706e6b" }}>
          <strong>Score reason:</strong> {lead.scoreReason}
        </div>
      )}
    </Section>
  );

  const companyInformation = (
    <Section title="Company Information">
      <FieldGrid
        entityType="lead"
        entityId={lead.id}
        fields={[
          E("Company", lead.businessName ?? sf("Company"), "businessName", "text", { rawValue: lead.businessName }),
          E("EIN Number / Tax Id", lead.ein ?? sf("EIN_Number_Tax_Id__c"), "ein", "text", { rawValue: lead.ein }),
          E("Industry", lead.industry ?? sf("Industry"), "industry", "text", { rawValue: lead.industry }),
          E("Other Industry", sf("Other_Industry__c"), "Other_Industry__c"),
          E("Annual Revenue", lead.annualRevenue ? `$${lead.annualRevenue.toLocaleString()}` : sfDollar("AnnualRevenue"), "annualRevenue", "number", { rawValue: lead.annualRevenue ?? null }),
          E("Monthly Revenue", sfDollar("Monthly_Revenue__c"), "Monthly_Revenue__c", "number"),
          E("Has Multiple MCA’s", yesNo(sf("Has_Multiple_MCA_s__c")), "Has_Multiple_MCA_s__c", "checkbox"),
          E("Business Start Date", sfDate("Business_Start_Date__c"), "Business_Start_Date__c", "date"),
        ]}
      />
    </Section>
  );

  const currentDebtInformation = (
    <Section title="Current Debt Information">
      <FieldGrid
        entityType="lead"
        entityId={lead.id}
        fields={[
          E("MCA Amount", sfDollar("MCA_Amount__c"), "MCA_Amount__c", "number"),
          E("MCA Amount Requested", sfDollar("MCA_Amount_Requested__c"), "MCA_Amount_Requested__c", "number"),
          E("Estimated Total Debt", lead.totalDebtEst ? `$${lead.totalDebtEst.toLocaleString()}` : sf("Estimated_Total_Debt__c"), "totalDebtEst", "number", { rawValue: lead.totalDebtEst ?? null }),
          E("Current Total Debt Amount", sfDollar("Current_Total_Debt_Amount__c"), "Current_Total_Debt_Amount__c", "number"),
          ["Current Total Monthly Payment", sfDollar("Current_Total_Monthly_Payment__c") ?? sfDollar("Current_Total_Monthly_Payment_Formula__c")],
          ["Current Total Weekly Payment", lead.currentTotalWeeklyPayment ? `$${lead.currentTotalWeeklyPayment.toLocaleString()}` : sfDollar("Current_Total_Weekly_Payment__c")],
          ["Current Total Daily Payment", sfDollar("Current_Total_Daily_Payment__c")],
          ["RT Debt Amount Lead Creation", sfDollar("RT_Debt_Amount_Lead_Creation__c")],
          ["RT Debt Amount Lead Qualification", sfDollar("RT_Debt_Amount_Lead_Qualification__c")],
        ]}
      />
    </Section>
  );

  const debtCalculation = (
    <Section title="Debt Calculation" defaultOpen={false}>
      <FieldGrid
        fields={[
          ["Total Debt Amount", sfDollar("Total_Debt_Amount__c")],
          ["Frequency", sf("Frequency__c")],
          ["Payment Amount", sfDollar("Payment_Amount__c")],
          ["Monthly Bank Fee", sfDollar("Monthly_Bank_Fee__c")],
          ["Program Fee Percentage", sf("Program_Fee_Percentage__c")],
          ["Retainer Percentage", sf("Retainer_Percentage__c")],
          ["Settlement Percentage", sf("Settlement_Percentage__c")],
          ["Setup Fee", sfDollar("Setup_Fee__c")],
          ["Down Payment", sfDollar("Down_Payment__c")],
          ["Payment Term", sf("Payment_Term__c")],
        ]}
      />
    </Section>
  );

  const callDisposition = (
    <Section title="Call Disposition" defaultOpen={false}>
      <FieldGrid
        fields={[
          ["Closer", sf("Closer__c")],
          ["Closer Reference", sf("CloserLookup__c")],
          ["Call Transfer Status", sf("Call_Transfer_Status__c")],
          ["Call Received By", sf("Call_Received_By_Lookup__c")],
          ["Call Received Date", sfDate("Call_Received_Date__c")],
          ["Call Tranferred DateTime", sfDate("Call_Tranferred_DateTime__c")],
          ["Call Transferred By", sf("Call_Transferred_By__c")],
          ["Outbound ANI", sf("Outbound_ANI__c")],
          ["Outbound ANI From", sf("Outbound_ANI_From__c")],
          ["Outbound ANI Date", sfDate("Outbound_ANI_Date__c")],
          ["Outbound ANI Identifier", sf("Outbound_ANI_Identifier__c")],
        ]}
      />
    </Section>
  );

  const trustFunds = (
    <Section title="Trust Funds" defaultOpen={false}>
      <FieldGrid
        fields={[
          ["Bank Type", sf("Bank_Type__c")],
          ["Trust Account", sf("Trust_Account__c")],
          ["Trust Account Number", sf("Trust_Account_Number__c")],
          ["Routing Number", sf("Routing_Number__c")],
          ["Account Type", sf("Account_Type__c")],
          ["Account Holder Name", sf("Account_Holder_Name__c")],
        ]}
      />
    </Section>
  );

  const creditorInformation = (
    <Section title="Creditor Information" defaultOpen={false}>
      <FieldGrid
        fields={[
          ["Creditor 1 Name", sf("Creditor_1_Name__c")],
          ["Creditor 1 Total Debt", sfDollar("Creditor_1_Total_Debt__c")],
          ["Creditor 1 Payment", sfDollar("Creditor_1_Payment__c")],
          ["Creditor 1 Payment Frequency", sf("Creditor_1_Payment_Frequency__c")],
          ["Creditor 1 Debt Status", sf("Creditor_1_Debt_Status__c")],
          ["Creditor 2 Name", sf("Creditor_2_Name__c")],
          ["Creditor 2 Total Debt", sfDollar("Creditor_2_Total_Debt__c")],
          ["Creditor 2 Payment", sfDollar("Creditor_2_Payment__c")],
          ["Creditor 2 Payment Frequency", sf("Creditor_2_Payment_Frequency__c")],
          ["Creditor 2 Debt Status", sf("Creditor_2_Debt_Status__c")],
          ["Creditor 3 Name", sf("Creditor_3_Name__c")],
          ["Creditor 3 Total Debt", sfDollar("Creditor_3_Total_Debt__c")],
          ["Creditor 3 Payment", sfDollar("Creditor_3_Payment__c")],
          ["Creditor 3 Payment Frequency", sf("Creditor_3_Payment_Frequency__c")],
          ["Creditor 3 Debt Status", sf("Creditor_3_Debt_Status__c")],
          ["Creditor 4 Name", sf("Creditor_4_Name__c")],
          ["Creditor 4 Total Debt", sfDollar("Creditor_4_Total_Debt__c")],
          ["Creditor 4 Payment", sfDollar("Creditor_4_Payment__c")],
          ["Creditor 4 Payment Frequency", sf("Creditor_4_Payment_Frequency__c")],
          ["Creditor 4 Debt Status", sf("Creditor_4_Debt_Status__c")],
          ["Creditor 5 Name", sf("Creditor_5_Name__c")],
          ["Creditor 5 Total Debt", sfDollar("Creditor_5_Total_Debt__c")],
          ["Creditor 5 Payment", sfDollar("Creditor_5_Payment__c")],
          ["Creditor 5 Payment Frequency", sf("Creditor_5_Payment_Frequency__c")],
          ["Creditor 5 Debt Status", sf("Creditor_5_Debt_Status__c")],
          ["Creditor 6 Name", sf("Creditor_6_Name__c")],
          ["Creditor 6 Total Debt", sfDollar("Creditor_6_Total_Debt__c")],
          ["Creditor 6 Payment", sfDollar("Creditor_6_Payment__c")],
          ["Creditor 6 Payment Frequency", sf("Creditor_6_Payment_Frequency__c")],
          ["Creditor 6 Debt Status", sf("Creditor_6_Debt_Status__c")],
          ["Creditor 7 Name", sf("Creditor_7_Name__c")],
          ["Creditor 7 Total Debt", sfDollar("Creditor_7_Total_Debt__c")],
          ["Creditor 7 Payment", sfDollar("Creditor_7_Payment__c")],
          ["Creditor 7 Payment Frequency", sf("Creditor_7_Payment_Frequency__c")],
          ["Creditor 7 Debt Status", sf("Creditor_7_Debt_Status__c")],
          ["Creditor 8 Name", sf("Creditor_8_Name__c")],
          ["Creditor 8 Total Debt", sfDollar("Creditor_8_Total_Debt__c")],
          ["Creditor 8 Payment", sfDollar("Creditor_8_Payment__c")],
          ["Creditor 8 Payment Frequency", sf("Creditor_8_Payment_Frequency__c")],
          ["Creditor 8 Debt Status", sf("Creditor_8_Debt_Status__c")],
          ["Creditor 9 Name", sf("Creditor_9_Name__c")],
          ["Creditor 9 Total Debt", sfDollar("Creditor_9_Total_Debt__c")],
          ["Creditor 9  Payment", sfDollar("Creditor_9_Payment__c")],
          ["Creditor 9 Payment Frequency", sf("Creditor_9_Payment_Frequency__c")],
          ["Creditor 9 Debt Status", sf("Creditor_9_Debt_Status__c")],
          ["Creditor 10 Name", sf("Creditor_10_Name__c")],
          ["Creditor 10 Total Debt", sfDollar("Creditor_10_Total_Debt__c")],
          ["Creditor 10 Payment", sfDollar("Creditor_10_Payment__c")],
          ["Creditor 10 Payment Frequency", sf("Creditor_10_Payment_Frequency__c")],
          ["Creditor 10 Debt Status", sf("Creditor_10_Debt_Status__c")],
        ]}
      />
    </Section>
  );

  const accountEngagement = (
    <Section title="Account Engagement" defaultOpen={false}>
      <FieldGrid
        fields={[
          ["First Form Submission", sfDate("Account_Engagement_First_Activity__c")],
          ["Last Form Submission", sfDate("Account_Engagement_Last_Activity__c")],
          ["Last Activity", sfDate("LastActivityDate")],
          ["Conversion Score", sf("Account_Engagement_Score__c")],
          ["Grade", sf("Account_Engagement_Grade__c")],
          ["Account Engagement Hard Bounced", yesNo(sf("pi__pardot_hard_bounced__c"))],
          ["Needs Score Synced", yesNo(sf("pi__Needs_Score_Synced__c"))],
          ["Sync To Account Engagement", yesNo(sf("Sync_To_Account_Engagement__c"))],
        ]}
      />
    </Section>
  );

  const dialerIntegration = (
    <Section title="Dialer Integration" defaultOpen={false}>
      <FieldGrid
        fields={[
          ["Dialer Group", sf("Dialer_Group__c")],
          ["Five9 Final Stage", yesNo(sf("Five9_Final_Stage__c"))],
          ["Five9 List Id", sf("Five9_List_Id__c")],
          ["Five9 List Updated by Convoso Batch", yesNo(sf("Five9_List_Updated_by_Convoso_Batch__c"))],
          ["Synced to Five9 List", yesNo(sf("Synced_to_Five9_List__c"))],
          ["Removed From Five9", yesNo(sf("Removed_From_Five9__c"))],
          ["Pulled From Convoso", yesNo(sf("Pulled_From_Convoso__c"))],
        ]}
      />
    </Section>
  );

  const phoneVerification = (
    <Section title="Phone Verification" defaultOpen={false}>
      <FieldGrid
        fields={[
          ["Verified Phone Number", yesNo(sf("Verified_Phone_Number__c"))],
          ["Check Wireless", yesNo(sf("Check_Wireless__c"))],
          ["IP Address", sf("IP_Address__c")],
          ["IPQS Fraud Score", sf("IPQS_Fraud_Score__c")],
          ["IPQS Is Valid", yesNo(sf("IPQS_Is_Valid__c"))],
          ["IPQS Is Risky", yesNo(sf("IPQS_Is_Risky__c"))],
          ["IPQS Is Prepaid", yesNo(sf("IPQS_Is_Prepaid__c"))],
          ["IPQS Is VOIP", yesNo(sf("IPQS_Is_VOIP__c"))],
          ["IPQS_IsActive", yesNo(sf("IPQS_IsActive__c"))],
          ["SMS Opt Out", yesNo(sf("smagicinteract__SMSOptOut__c"))],
        ]}
      />
    </Section>
  );

  const calendlyAndScheduling = (
    <Section title="Calendly & Scheduling" defaultOpen={false}>
      <FieldGrid
        fields={[
          ["CalendlyCreated", yesNo(sf("Calendly__CalendlyCreated__c"))],
          ["Has Calendly Event", yesNo(sf("Has_Calendly_Event__c"))],
        ]}
      />
    </Section>
  );

  // SF Lead detail does NOT show a giant in-body "Convert" call-to-action — the
  // Convert action is the header button. We surface a slim post-conversion
  // breadcrumb at the very top of Details so users can jump to the converted
  // Account / Opportunity, but skip the big CTA banner entirely.
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
          <Link href={`/accounts/${converted.accountId}`} style={{ color: "#0070d2" }}>View account</Link>
          <Link href={`/contacts/${converted.contactId}`} style={{ color: "#0070d2" }}>View contact</Link>
          {converted.opportunityId && (
            <Link href={`/opportunities/${converted.opportunityId}`} style={{ color: "#0070d2" }}>View opportunity</Link>
          )}
        </div>
      )}
      {leadInformation}
      {companyInformation}
      {currentDebtInformation}
      {debtCalculation}
      {callDisposition}
      {trustFunds}
      {creditorInformation}
      {accountEngagement}
      {dialerIntegration}
      {phoneVerification}
      {calendlyAndScheduling}
      {lead.notes && (
        <Section title="Notes" defaultOpen={false}>
          <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{lead.notes}</div>
        </Section>
      )}
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
    <>
      {currentDebtInformation}
      {debtCalculation}
      {creditorInformation}
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
    </>
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
        // SF Lead detail highlights row (verified against sf-lead-detail.png):
        // 5 columns — Title, Email, Phone, Mobile, Lead Id. Company is shown
        // in the Lead Information section below, not the highlight strip.
        { label: "Title", value: sf("Title") },
        { label: "Email", value: emailVal },
        { label: "Phone", value: phoneVal },
        { label: "Mobile", value: mobileVal },
        { label: "Lead Id", value: displayLeadId },
      ]}
      actions={<LeadHeaderButtons leadId={lead.id} currentStage={stage} converted={!!converted} />}
      pathStages={LEAD_PATH}
      pathCurrentIndex={Math.max(0, leadPathIndex(lead.status))}
      pathActionLabel={converted ? "Converted" : "Mark Status as Complete"}
      details={
        <LeadTabs
          panels={{
            Details: details,
            "Debt Information": debtInformationPanel,
            "Payment Calculator": calc,
            Documents: documents,
            Related: related,
            Marketing: marketing,
            "All SF Fields": sfFields,
          }}
        />
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
          <ActivityChatterRail activities={activity} chatter={chatter} />
        </>
      }
    />
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  color: "#3e3e3c",
  padding: "8px 12px",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const td: React.CSSProperties = {
  fontSize: 13,
  color: "#080707",
  padding: "8px 12px",
  verticalAlign: "top",
};

// LeadScoreCard + RelatedRecordsCard removed: SF Lead detail rail doesn't
// surface either. Lead Score is shown as a tone next to the status pill on
// the path; owner lives in the highlights row; converted-record links live
// in the in-Details breadcrumb at the top of the Details panel.
