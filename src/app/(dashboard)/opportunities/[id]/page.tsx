import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecordPage, StatusPill } from "@/components/slds/record-page";
import { Section, FieldGrid } from "@/components/slds/section";
import { E } from "@/components/slds/field-helpers";
import { ActivityChatterRail, type ChatterPost } from "@/components/slds/activity-chatter-rail";
import type { ActivityItem } from "@/components/slds/activity-rail";
import { RelatedList } from "@/components/slds/related-list";
import { OppTabs } from "@/components/opportunities/opp-tabs";
import { OppHeaderButtons } from "@/components/opportunities/opp-header-buttons";
import { OppDebtInformation } from "@/components/opportunities/opp-debt-information";
import { PaymentCalculatorV2 } from "@/components/shared/payment-calculator-v2";
import { DocumentsUpload } from "@/components/leads/documents-upload";
import { EnvelopesRelatedList } from "@/components/envelopes/envelopes-related-list";
import { TotalPaymentsSummary } from "@/components/opportunities/total-payments-summary";
import { DocusignEnvelopeStatus } from "@/components/opportunities/docusign-envelope-status";
import { OppReportsCard } from "@/components/opportunities/opp-reports-card";
import { opportunityStageTone, settlementStatusTone, genericTone } from "@/lib/slds/status-tones";
import { OPP_STAGES } from "@/lib/sf-canonical";
import { SfDataSection } from "@/components/slds/sf-data-section";
import { computeOppFormulas, fmtMoney, fmtPercent } from "@/lib/opp-formulas";
import { LeadHistoryCard } from "@/components/leads/lead-history-card";

/**
 * SF path strip — mirrors the green-arrow path on the Kenya Palmer screenshot.
 * Note that "Archived" / "Closed Lost" terminal stages are intentionally NOT in
 * the path (SF treats them as off-path terminal states; the path renders the
 * happy-path sequence only).
 */
const PATH_HAPPY: readonly string[] = [
  "Working Opportunity",
  "Waiting for Agreements",
  "Agreements Received",
  "Ready To Close",
  "Contract Sent",
  "Closed Won First Payment Pending",
  "Closed Won - First Payment Completed",
] as const;
const PATH = PATH_HAPPY.map((s) => ({ label: s }));

// Display labels for opportunity stages — DB enum upper-snake maps to the
// SF titlecase label visible on sf-opp-kenya.png ("Working Opportunity").
const STAGE_LABEL: Record<string, string> = {
  WORKING_OPPORTUNITY: "Working Opportunity",
  WAITING_FOR_AGREEMENTS: "Waiting for Agreements",
  AGREEMENTS_RECEIVED: "Agreements Received",
  READY_TO_CLOSE: "Ready To Close",
  CONTRACT_SENT: "Contract Sent",
  CONTRACT_SIGNED: "Contract Signed",
  ARCHIVED: "Archived",
  CLOSED_WON_FIRST_PAYMENT: "Closed Won First Payment Pending",
  CLOSED_WON_FIRST_PAYMENT_COMPLETED: "Closed Won - First Payment Completed",
  CLOSED: "Closed",
  CLOSED_LOST: "Closed Lost",
};
const formatStage = (s: string | null | undefined) => {
  if (!s) return "";
  // Already a SF-style label.
  if (PATH_HAPPY.includes(s)) return s;
  if (STAGE_LABEL[s]) return STAGE_LABEL[s];
  // Fallback: convert UPPER_SNAKE to Title Case.
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
};

function oppPathIndex(stage: string): number {
  // Normalise enum form before lookup so DB rows with WORKING_OPPORTUNITY
  // hit the same path index as rows already mapped to "Working Opportunity".
  const label = formatStage(stage);
  const i = PATH_HAPPY.indexOf(label);
  if (i >= 0) return i;
  // Off-path terminal states: pin to nearest milestone so the path still
  // renders meaningfully (Archived → Contract Sent, Closed Lost → Working).
  const s = (stage ?? "").toUpperCase();
  if (s.includes("CLOSED") && s.includes("WON") && s.includes("COMPLETED")) return 6;
  if (s.includes("CLOSED") && s.includes("WON")) return 5;
  if (s.includes("CONTRACT") && s.includes("SENT")) return 4;
  if (s.includes("READY")) return 3;
  if (s.includes("AGREEMENT")) return 2;
  if (s.includes("WAITING")) return 1;
  return 0;
}
// Keep an OPP_STAGES reference for the SfDataSection legend below.
void OPP_STAGES;

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opp = await prisma.opportunity.findUnique({
    where: { id },
    include: {
      lead: {
        select: {
          id: true,
          sfId: true,
          businessName: true,
          contactName: true,
          phone: true,
          email: true,
          source: true,
          calls: {
            include: { agent: { select: { id: true, name: true } } },
            orderBy: { createdAt: "desc" },
            take: 50,
          },
          emails: { orderBy: { createdAt: "desc" }, take: 50 },
          sms: { orderBy: { createdAt: "desc" }, take: 50 },
          tasks: { orderBy: { createdAt: "desc" }, take: 50 },
        },
      },
      account: { select: { id: true, name: true, recordType: true } },
      primaryContact: { select: { id: true, fullName: true } },
      assignedTo: { select: { id: true, name: true } },
      client: true,
      debts: {
        include: {
          creditor: { include: { account: { select: { name: true } } } },
          offers: { include: { settlement: true }, orderBy: { createdAt: "desc" } },
          settlement: true,
          negotiations: { include: { negotiator: { select: { id: true, name: true } } }, orderBy: { date: "desc" } },
        },
        orderBy: { createdAt: "asc" },
      },
      programPlans: {
        include: {
          processor: { select: { name: true, code: true } },
          _count: { select: { drafts: true, fees: true } },
        },
        orderBy: { startDate: "desc" },
      },
      documents: { include: { uploadedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
      tasks: { orderBy: { createdAt: "desc" }, take: 50 },
      events: { orderBy: { startAt: "desc" }, take: 30 },
      emails: { orderBy: { createdAt: "desc" }, take: 20 },
      history: {
        orderBy: { changedAt: "desc" },
        take: 100,
        include: { changedBy: { select: { name: true } } },
      },
      paymentCalculations: { orderBy: { savedAt: "desc" }, take: 1 },
      envelopes: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
  if (!opp) notFound();

  const latestCalc = opp.paymentCalculations[0];

  // Merge Opp + Lead-era activity
  const leadActivity: ActivityItem[] = opp.lead
    ? [
        ...opp.lead.calls.map((c) => ({
          id: `lead-call-${c.id}`,
          type: "CALL" as const,
          subject: `Call to ${c.phoneNumber}`,
          meta: `${c.disposition ?? "-"} · ${c.agent.name} (lead-era)`,
          date: c.startedAt,
          done: c.status === "COMPLETED",
        })),
        ...opp.lead.emails.map((m) => ({
          id: `lead-email-${m.id}`,
          type: "EMAIL" as const,
          subject: m.subject,
          meta: `${m.direction === "OUTBOUND" ? "To" : "From"} ${m.toAddresses} (lead-era)`,
          date: m.sentAt ?? m.createdAt,
          done: m.status === "DELIVERED",
        })),
        ...opp.lead.sms.map((m) => ({
          id: `lead-sms-${m.id}`,
          type: "SMS" as const,
          subject: m.body.slice(0, 80),
          meta: `${m.direction === "OUTBOUND" ? "→" : "←"} ${m.toNumber} (lead-era)`,
          date: m.sentAt ?? m.createdAt,
          done: m.status === "DELIVERED",
        })),
        ...opp.lead.tasks.map((t) => ({
          id: `lead-task-${t.id}`,
          type: (t.type === "CALL" ? "CALL" : "TASK") as ActivityItem["type"],
          subject: t.subject,
          meta: `${t.disposition ?? t.outcome ?? ""} (lead-era)`,
          date: t.dueDate ?? t.completedAt ?? t.createdAt,
          done: t.status === "COMPLETED",
        })),
      ]
    : [];

  const oppActivity: ActivityItem[] = [
    ...opp.tasks.map((t) => ({
      id: t.id,
      type: (t.type === "CALL" ? "CALL" : "TASK") as ActivityItem["type"],
      subject: t.subject,
      meta: t.outcome ?? t.disposition ?? null,
      date: t.dueDate ?? t.completedAt ?? t.createdAt,
      done: t.status === "COMPLETED",
    })),
    ...opp.events.map((e) => ({
      id: e.id,
      type: "EVENT" as const,
      subject: e.subject,
      meta: e.location ?? null,
      date: e.startAt,
      done: e.status === "COMPLETED",
    })),
    ...opp.emails.map((m) => ({
      id: m.id,
      type: "EMAIL" as const,
      subject: m.subject,
      meta: m.toAddresses,
      date: m.sentAt ?? m.createdAt,
      done: m.status === "DELIVERED",
    })),
  ];

  const activity = [...oppActivity, ...leadActivity];

  const chatter: ChatterPost[] = [...opp.emails, ...(opp.lead?.emails ?? [])].map((m) => ({
    id: m.id,
    authorName: m.direction === "OUTBOUND" ? "You" : m.fromAddress,
    body: `${m.subject}\n\n${m.bodyText ?? m.bodyHtml?.replace(/<[^>]+>/g, "") ?? ""}`,
    createdAt: m.sentAt ?? m.createdAt,
  }));

  const oppName =
    opp.name ?? opp.primaryContact?.fullName ?? opp.account?.name ?? opp.lead?.contactName ?? "(unnamed)";

  // Totals summary
  const totalDebtVal = opp.debts.reduce((s, d) => s + d.originalBalance, 0) || opp.totalDebt || 0;
  const totalWeekly = opp.debts.reduce((s, d) => {
    if (d.paymentAmount == null || !d.paymentFrequency) return s;
    const perYear: Record<string, number> = { DAILY: 252, WEEKLY: 52, BI_WEEKLY: 26, MONTHLY: 12, LUMP_SUM: 1 };
    return s + ((d.paymentAmount * (perYear[d.paymentFrequency] ?? 0)) / 52);
  }, 0);

  // Compute DS_* formula fields read-time so they always reflect current
  // CRM data instead of stale SF snapshot values.
  const formulas = computeOppFormulas({
    totalDebt: totalDebtVal,
    programFeePercent: latestCalc?.programFeePercent ?? null,
    programFeePeriodMonths: latestCalc?.programFeePeriod ?? null,
    setupFee: latestCalc?.setupFee ?? null,
    monthlyBankFee: latestCalc?.monthlyBankFee ?? null,
    serviceFee: latestCalc?.serviceFee ?? null,
    // SF default estimated settlement percent is 50% — overridable when the
    // calculator carries an explicit value.
    estimatedSettlementPercent: latestCalc?.settlementPercentage ?? 50,
    buyoutFeePercent: null,
    buyoutLoanAmount: null,
  });

  let oppSfData: Record<string, unknown> = {};
  try { oppSfData = opp.sfDataJson ? JSON.parse(opp.sfDataJson) as Record<string, unknown> : {}; } catch { /* empty */ }
  const oppSf = (k: string): string | null => {
    const v = oppSfData[k];
    if (v == null || v === "") return null;
    return String(v);
  };
  const oppSfDollar = (k: string): string | null => {
    const v = oppSf(k);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? `$${n.toLocaleString()}` : v;
  };
  const oppSfDate = (k: string): string | null => {
    const v = oppSf(k);
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString();
  };

  // Resolve a presentable Account name. The account migration defaulted
  // empty SF names to literal "Unnamed Account", which leaks into the UI.
  // Prefer that string only when it actually came from SF; otherwise fall back
  // to the lead's businessName, the opp's own name, or a single em-dash.
  const rawAccountName = opp.account?.name && opp.account.name !== "Unnamed Account"
    ? opp.account.name
    : null;
  const accountDisplayName =
    rawAccountName ??
    opp.lead?.businessName ??
    (opp.account ? "Unnamed Account" : null);
  const accountLink = accountDisplayName && opp.account?.id ? (
    <Link href={`/accounts/${opp.account.id}`} style={{ color: "#1589ee" }}>
      {accountDisplayName}
    </Link>
  ) : (
    accountDisplayName ?? null
  );

  const ownerDisplay = opp.assignedTo?.name ?? oppSf("Owner_Full_Name__c");
  const closeDateDisplay = opp.expectedCloseDate?.toLocaleDateString() ?? oppSfDate("CloseDate");
  const totalDebtDisplay = `$${totalDebtVal.toLocaleString()}`;
  const probabilityDisplay = (() => {
    const p = oppSf("Probability");
    if (!p) return null;
    const n = Number(p);
    return Number.isFinite(n) ? `${n}%` : p;
  })();
  const createdByDisplay = oppSf("CreatedBy_Full_Name__c") ?? oppSf("CreatedById") ?? "";

  // SF Lightning interleaves left/right column rows top-to-bottom — even index
  // = left column, odd = right. Field set + pair order verified against the
  // live SF Kenya Palmer Opportunity screenshot (docs/sf-screenshots/sf-opp-kenya.png).
  const oppSfBool = (k: string): string | null => {
    const v = oppSfData[k];
    if (v == null || v === "") return null;
    if (typeof v === "boolean") return v ? "Yes" : "No";
    const s = String(v).toLowerCase();
    if (s === "true" || s === "1") return "Yes";
    if (s === "false" || s === "0") return "No";
    return String(v);
  };
  const oppSfDateTime = (k: string): string | null => {
    const v = oppSf(k);
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleString();
  };

  // SF Lead Id is captured on the opp as sfLeadIdText (free text from SF) or
  // can be derived from the linked CRM Lead row's sfId. Fall back to the CRM
  // lead id only as a last resort. Hoisted above detailsPanel so the Lead Id
  // row inside the Opportunity Information section can reference it.
  const sfLeadIdDisplay =
    opp.sfLeadIdText ??
    oppSf("Lead_Id__c") ??
    opp.lead?.sfId ??
    (opp.lead?.id ? opp.lead.id.slice(-8).toUpperCase() : null);

  // SF "Opportunity Owner" appears with a user-card icon; we render plain text.
  const expectedRevenueDisplay = oppSfDollar("ExpectedRevenue") ?? oppSfDollar("Expected_Revenue__c");
  const nextStepDisplay = oppSf("Next_Step__c") ?? oppSf("NextStep");
  const lastDispositionDisplay = oppSf("Last_Disposition__c");
  const lastDispositionDateTimeDisplay = oppSfDateTime("Last_Disposition_DateTime__c");
  const primaryCampaignSourceDisplay = oppSf("CampaignId") ?? oppSf("Primary_Campaign_Source__c");
  const timezoneDisplay = oppSf("Timezone__c");
  const totalDebtIncludedDisplay = oppSfDollar("Total_Debt_Included__c") ?? totalDebtDisplay;
  const currentTotalDebtDisplay = oppSfDollar("Current_Total_Debt__c") ?? totalDebtDisplay;
  // SF stores phone/email as *_Formula__c fields on Opportunity (formulas pull
  // the canonical value from the linked Account/Contact). Fall back to the raw
  // Phone__c/Email__c variants for older snapshots.
  const phoneDisplay = oppSf("Phone_Formula__c") ?? oppSf("Formatted_Phone__c") ?? oppSf("Phone__c") ?? oppSf("Phone");
  const emailDisplay = oppSf("Email_Formula__c") ?? oppSf("Email__c") ?? oppSf("Email");

  const detailsPanel = (
    <>
      {/* SF Kenya Palmer Opportunity — pair-by-pair parity with SF Lightning.
          Rows alternate left/right top-to-bottom; even index = left col,
          odd index = right col. E(...) rows are inline-editable. */}
      <Section title="Opportunity Information">
        <FieldGrid
          entityType="opportunity"
          entityId={opp.id}
          fields={[
            // Row 1: Opportunity Owner | Expected Revenue
            ["Opportunity Owner", ownerDisplay],
            ["Expected Revenue", expectedRevenueDisplay],
            // Row 2: Private | Close Date
            ["Private", oppSfBool("IsPrivate") ?? oppSfBool("Private__c")],
            E("Close Date", closeDateDisplay, "expectedCloseDate", "date", { rawValue: opp.expectedCloseDate ?? null }),
            // Row 3: Opportunity Name | Next Step
            E("Opportunity Name", oppName, "name", "text", { rawValue: opp.name ?? oppName }),
            E("Next Step", nextStepDisplay, "nextStep"),
            // Row 4: Account Name | Stage
            ["Account Name", accountLink],
            [
              "Stage",
              <StatusPill key="s" label={formatStage(opp.stage)} tone={opportunityStageTone(opp.stage)} />,
              { fieldKey: "stage", type: "select", rawValue: opp.stage, options: PATH_HAPPY.map((s) => ({ label: s, value: s })) },
            ],
            // Row 5: Type | Last Disposition
            ["Type", opp.recordType.replace(/_/g, " ")],
            E("Last Disposition", lastDispositionDisplay, "Last_Disposition__c"),
            // Row 6: Lead Source | Last Disposition DateTime
            E("Lead Source", opp.lead?.source ?? oppSf("LeadSource"), "leadSource"),
            ["Last Disposition DateTime", lastDispositionDateTimeDisplay],
            // Row 7: Lead Source Category | Probability (%)
            E("Lead Source Category", oppSf("Lead_Source_Category__c"), "leadSourceCategory"),
            E("Probability (%)", probabilityDisplay, "probability", "number", { rawValue: opp.probability ?? null }),
            // Row 8: Lead Id | Primary Campaign Source
            ["Lead Id", sfLeadIdDisplay],
            ["Primary Campaign Source", primaryCampaignSourceDisplay],
            // Row 9: Phone | Timezone
            [
              "Phone",
              phoneDisplay ? <span key="ph" style={{ color: "#1589ee" }}>{phoneDisplay}</span> : null,
              { fieldKey: "oppPhone", type: "phone", rawValue: opp.oppPhone ?? phoneDisplay ?? null },
            ],
            E("Timezone", timezoneDisplay, "timezone"),
            // Row 10: Email | Total Debt Included
            [
              "Email",
              emailDisplay ? <a key="em" href={`mailto:${emailDisplay}`} style={{ color: "#1589ee" }}>{emailDisplay}</a> : null,
              { fieldKey: "oppEmail", type: "email", rawValue: opp.oppEmail ?? emailDisplay ?? null },
            ],
            ["Total Debt Included", totalDebtIncludedDisplay],
            // Row 11: Preferred method of Contact | Current Total Debt
            E("Preferred method of Contact", oppSf("Preferred_Method_Of_Contact__c"), "preferredMethodOfContact"),
            E("Current Total Debt", currentTotalDebtDisplay, "currentTotalDebt", "number", { rawValue: opp.currentTotalDebt ?? null }),
            // Row 12: Legal Plan Required | Secured Party
            E("Legal Plan Required", oppSfBool("Legal_Plan_Required__c"), "legalPlanRequired", "checkbox", { rawValue: opp.legalPlanRequired ?? null }),
            E("Secured Party", oppSf("Secured_Party__c"), "securedParty"),
            // Row 13: Addendum Required | Call ASAP
            E("Addendum Required", oppSfBool("Addendum_Required__c"), "addendumRequired", "checkbox", { rawValue: opp.addendumRequired ?? null }),
            E("Call ASAP", oppSfBool("Call_ASAP__c"), "Call_ASAP__c", "checkbox"),
            // Row 14: Current Weekly Payment | Business Start Date
            E("Current Weekly Payment", oppSfDollar("Current_Weekly_Payment__c"), "currentWeeklyPayment", "number", { rawValue: opp.currentWeeklyPayment ?? null }),
            E("Business Start Date", oppSfDate("Business_Start_Date__c"), "businessStartDate", "date", { rawValue: opp.businessStartDate ?? null }),
            // Row 15: Current Monthly Payment | Hopper Priority
            E("Current Monthly Payment", oppSfDollar("Current_Monthly_Payment__c"), "currentMonthlyPayment", "number", { rawValue: opp.currentMonthlyPayment ?? null }),
            ["Hopper Priority", oppSf("Hopper_Priority__c")],
            // Row 16: Weekly Payment to Debt Ratio | Outbound ANI Date
            E("Weekly Payment to Debt Ratio", oppSf("Weekly_Payment_To_Debt_Ratio__c"), "weeklyPaymentToDebtRatio", "number", { rawValue: opp.weeklyPaymentToDebtRatio ?? null }),
            ["Outbound ANI Date", oppSfDate("Outbound_ANI_Date__c")],
            // Row 17: Preferred Language | Outbound ANI Identifier
            E("Preferred Language", oppSf("Preferred_Language__c"), "preferredLanguage"),
            ["Outbound ANI Identifier", oppSf("Outbound_ANI_Identifier__c")],
            // Row 18: Add to Five9 List | First Draft Date
            ["Add to Five9 List", oppSfBool("Add_to_Five9_List__c")],
            E("First Draft Date", oppSfDate("First_Draft_Date__c"), "firstDraftDate", "date", { rawValue: opp.firstDraftDate ?? null }),
            // Row 19: Delete from Five9 List | First Contract Signed Date
            ["Delete from Five9 List", oppSfBool("Delete_from_Five9_List__c")],
            E("First Contract Signed Date", oppSfDateTime("First_Contract_Signed_Date__c"), "firstContractSignedDateOpp", "datetime", { rawValue: opp.firstContractSignedDateOpp ?? null }),
            // Row 20: First Payment Completed Date | Number Of Days From First ContractSigned
            ["First Payment Completed Date", oppSfDate("First_Payment_Completed_Date__c")],
            ["Number Of Days From First ContractSigned", oppSf("Number_Of_Days_From_First_ContractSigned__c")],
            // Row 21: Opportunity Assignment Date | Qualified Financial
            ["Opportunity Assignment Date", oppSfDate("Opportunity_Assignment_Date__c")],
            ["Qualified Financial", oppSfBool("Qualified_Financial_Formula__c") ?? oppSfBool("Qualified_Financial__c")],
            // Row 22: Verified Phone Number | First Payment Completed
            E("Verified Phone Number", oppSfBool("Verified_Phone_Number__c"), "Verified_Phone_Number__c", "checkbox"),
            ["First Payment Completed", oppSfBool("First_Payment_Completed__c")],
            // Row 23: HIGH UCC RISK | Processor
            E("HIGH UCC RISK", oppSfBool("HIGH_UCC_RISK__c") ?? oppSfBool("High_UCC_Risk__c"), "highUccRisk", "checkbox", { rawValue: opp.highUccRisk ?? null }),
            E("Processor", oppSf("Processor__c"), "Processor__c"),
            // Row 24: Account Status | Re-shuffle Opportunity
            E("Account Status", oppSf("Account_Status__c"), "Account_Status__c"),
            ["Re-shuffle Opportunity", oppSfBool("Re_shuffle_Opportunity__c")],
            // Row 25: Ad Click Id | Re-shuffle count
            ["Ad Click Id", oppSf("Ad_Click_Id__c")],
            ["Re-shuffle count", oppSf("Re_shuffle_count__c")],
            // Row 26: Active Opportunity | Opportunity Record Type
            ["Active Opportunity", oppSfBool("Active_Opportunity__c")],
            ["Opportunity Record Type", opp.recordType.replace(/_/g, " ")],
            // Row 27: Opportunity Reinstated DateTime | Opportunity Amended DateTime
            ["Opportunity Reinstated DateTime", oppSfDateTime("Opportunity_Reinstated_DateTime__c")],
            ["Opportunity Amended DateTime", oppSfDateTime("Opportunity_Amended_DateTime__c")],
            // Row 28: Opportunity Reactivated DateTime | Reactivate Reason
            ["Opportunity Reactivated DateTime", oppSfDateTime("Opportunity_Reactivated_DateTime__c")],
            ["Reactivate Reason", oppSf("Reactivate_Reason__c")],
            // Row 29: Opportunity Reshuffled DateTime | Legal Network
            ["Opportunity Reshuffled DateTime", oppSfDateTime("Opportunity_Reshuffled_DateTime__c")],
            E("Legal Network", oppSf("Legal_Network__c"), "Legal_Network__c"),
            // Row 30: Affiliate | (empty right)
            ["Affiliate", oppSf("Affiliate__c")],
            ["", null],
            // Row 31: Eli Ad click | (empty right)
            ["Eli Ad click", oppSf("Eli_Ad_click__c") ?? oppSf("Eli_Ad_Click__c")],
            ["", null],
            // Row 32: Has Closer Notes | (empty right)
            ["Has Closer Notes", oppSfBool("Has_Closer_Notes__c")],
            ["", null],
            // Row 33: Latest Closer Notes | (empty right)
            ["Latest Closer Notes", oppSf("Latest_Closer_Notes__c")],
            ["", null],
          ]}
        />
      </Section>

      <Section title="Call Disposition">
        {/* SF Call Disposition section — pair-by-pair from SF Kenya Palmer. */}
        <FieldGrid
          entityType="opportunity"
          entityId={opp.id}
          fields={[
            // Row 1: Fronter | Closer
            E("Fronter", oppSf("Fronter__c"), "fronter"),
            E("Closer", oppSf("Closer__c"), "closer"),
            // Row 2: Fronter Reference | Closer Reference
            ["Fronter Reference", oppSf("FronterLookup__c")],
            ["Closer Reference", oppSf("CloserLookup__c")],
            // Row 3: Call Transferred By | Call Received By
            ["Call Transferred By", oppSf("Call_Transferred_By__c")],
            ["Call Received By", oppSf("Call_Received_By__c")],
            // Row 4: Call Transferred By Reference | Call Received By Reference
            ["Call Transferred By Reference", oppSf("Call_Transferred_By_Lookup__c")],
            ["Call Received By Reference", oppSf("Call_Received_By_Lookup__c")],
            // Row 5: Call Tranferred DateTime | Call Received Date
            ["Call Tranferred DateTime", oppSfDateTime("Call_Tranferred_DateTime__c") ?? oppSfDateTime("Call_Transferred_DateTime__c")],
            ["Call Received Date", oppSfDateTime("Call_Received_Date__c")],
            // Row 6: Call Transfer Status | Transfer Qualification
            E("Call Transfer Status", oppSf("Call_Transfer_Status__c"), "callTransferStatus"),
            E("Transfer Qualification", oppSf("Transfer_Qualification__c"), "transferQualification"),
            // Row 7: Sub Disposition | Last Contacted DateTime
            E("Sub Disposition", oppSf("Sub_Disposition__c"), "subDisposition"),
            E("Last Contacted DateTime", oppSfDateTime("Last_Contacted_DateTime__c"), "lastContactedAt", "datetime", { rawValue: opp.lastContactedAt ?? null }),
            // Row 8: Last Sub Disposition | Week Days Between Last Contacted Date
            ["Last Sub Disposition", oppSf("Last_Sub_Disposition__c")],
            ["Week Days Between Last Contacted Date", oppSf("Week_Days_Between_Last_Contacted_Date__c")],
            // Row 9: Last Called Time | (empty right)
            ["Last Called Time", oppSfDateTime("Last_Call__c") ?? oppSfDateTime("Last_Call_DateTime__c")],
            ["", null],
            // Row 10: Last Emailed Time | (empty right)
            ["Last Emailed Time", oppSfDateTime("Last_Email__c") ?? oppSfDateTime("Last_Email_DateTime__c")],
            ["", null],
            // Row 11: Last SMS Time | (empty right)
            ["Last SMS Time", oppSfDateTime("Last_SMS__c") ?? oppSfDateTime("Last_SMS_DateTime__c")],
            ["", null],
          ]}
        />
      </Section>

      <Section title="Client Questionnaire">
        {/* SF Client Questionnaire section — pair-by-pair from SF Kenya Palmer. */}
        <FieldGrid
          entityType="opportunity"
          entityId={opp.id}
          fields={[
            // Row 1: Type of Business | High Lien Risk
            E("Type of Business", opp.typeOfBusiness ?? oppSf("Type_of_Business__c"), "typeOfBusiness", "text", { rawValue: opp.typeOfBusiness }),
            E("High Lien Risk", opp.highLienRisk ?? oppSf("High_Lien_Risk__c"), "highLienRisk", "text", { rawValue: opp.highLienRisk }),
            // Row 2: Receivables Collection Method | What was explained to client?
            E("Receivables Collection Method", opp.receivablesCollectionMethod ?? oppSf("Receivables_Collection_Method__c"), "receivablesCollectionMethod", "text", { rawValue: opp.receivablesCollectionMethod }),
            E("What was explained to client?", oppSf("What_was_explained_to_client__c") ?? oppSf("What_Was_Explained_to_Client__c"), "whatWasExplainedToClient", "textarea"),
            // Row 3: Processor Info | Bank Change
            E("Processor Info", oppSf("Processor_Info__c"), "processorInfo"),
            E("Bank Change", opp.bankChange ?? oppSf("Bank_Change__c"), "bankChange", "text", { rawValue: opp.bankChange }),
            // Row 4: Lender Agreements Collected | Status with Lender/s
            E("Lender Agreements Collected", oppSf("Lender_Agreements_Collected__c"), "lenderAgreementsCollected"),
            E("Status with Lender/s", oppSf("Status_with_Lenders__c") ?? oppSf("Status_with_Lender_s__c"), "statusWithLenders"),
            // Row 5: COJ or TRO | First Payment to Legal
            E("COJ or TRO", oppSf("COJ_or_TRO__c"), "cojOrTro"),
            E("First Payment to Legal", oppSfBool("First_Payment_to_Legal__c"), "firstPaymentToLegal", "checkbox", { rawValue: opp.firstPaymentToLegal ?? null }),
            // Row 6: Summons or Judgment | Welcome Call Scheduled
            E("Summons or Judgment", oppSf("Summons_or_Judgment__c"), "summonsOrJudgment"),
            E("Welcome Call Scheduled", oppSfDateTime("Welcome_Call_Scheduled__c"), "welcomeCallScheduled", "datetime", { rawValue: opp.welcomeCallScheduled ?? null }),
            // Row 7: Order Number | Main Competitor/s
            E("Order Number", oppSf("Order_Number__c"), "orderNumber"),
            E("Main Competitor/s", oppSf("Main_Competitors__c") ?? oppSf("Main_Competitor_s__c"), "mainCompetitors"),
            // Row 8: Current Generator(s) | Delivery/Installation Status
            E("Current Generator(s)", oppSf("Current_Generators__c") ?? oppSf("Current_Generator_s__c"), "currentGenerators"),
            E("Delivery/Installation Status", oppSf("Delivery_Installation_Status__c"), "deliveryInstallationStatus"),
            // Row 9: Tracking Number | (empty right)
            E("Tracking Number", oppSf("Tracking_Number__c"), "trackingNumber"),
            ["", null],
            // Row 10: Created By | Last Modified By
            ["Created By", createdByDisplay || opp.createdAt.toLocaleString()],
            ["Last Modified By", oppSf("LastModifiedBy_Full_Name__c") ?? opp.updatedAt.toLocaleString()],
          ]}
        />
        {/* Description (full width) */}
        <div style={{ padding: "8px 0", borderBottom: "1px solid #dddbda", display: "grid", gridTemplateColumns: "16.5% 1fr 28px", gap: 8, alignItems: "start" }}>
          <div style={{ fontSize: 12, color: "#3e3e3c", paddingTop: 1 }}>Description</div>
          <div style={{ fontSize: 13, color: "#080707", whiteSpace: "pre-wrap" }}>
            {opp.notes ?? oppSf("Description") ?? ""}
          </div>
          <div />
        </div>
        {/* Delivery Status (full width) */}
        <div style={{ padding: "8px 0", display: "grid", gridTemplateColumns: "16.5% 1fr 28px", gap: 8, alignItems: "start" }}>
          <div style={{ fontSize: 12, color: "#1589ee", paddingTop: 1 }}>Delivery Status</div>
          <div style={{ fontSize: 13, color: "#080707" }}>{oppSf("Delivery_Status__c") ?? ""}</div>
          <div />
        </div>
      </Section>

      <Section title="DocuSign / Settlement Formulas" defaultOpen={false}>
        {/* CRM-computed DS_* formulas (live, sourced from CRM data) sit next to
            their SF snapshot counterparts so users can sanity-check parity. */}
        <FieldGrid
          fields={[
            ["DS Estimated Settlement", fmtMoney(formulas.estimatedSettlement)],
            ["DS Total Program Fee", fmtMoney(formulas.totalProgramFee)],
            ["DS Total Bank Fee", fmtMoney(formulas.totalBankFee)],
            ["DS Total Amount With Fees", fmtMoney(formulas.totalAmountWithFees)],
            ["DS Buyout Fee", fmtMoney(formulas.buyoutFee)],
            ["DS Total Buyout Amount", fmtMoney(formulas.totalBuyoutAmount)],
            ["DS Total Savings", fmtMoney(formulas.totalSavings)],
            ["DS Total Savings %", fmtPercent(formulas.totalSavingsPercent)],
          ]}
        />
      </Section>

      <Section title="DS Settlement Details" defaultOpen={false}>
        {/* Salesforce snapshot of all DS_*__c fields exactly as SF surfaces them.
            Labels are kept verbatim from the SF describe (e.g. "DS Total Fee
            Percentage" already includes a "%" suffix in its SF value, so we
            render the raw string). */}
        <FieldGrid
          fields={[
            ["DS Estimated Amount You Save", oppSfDollar("DS_Estimated_Amount_You_Save__c")],
            ["DS Estimated Program Fee", oppSfDollar("DS_Estimated_Program_Fee__c")],
            ["DS Estimated Retainer Fee", oppSfDollar("DS_Estimated_Retainer_Fee__c")],
            ["DS First Deposit Amount", oppSfDollar("DS_First_Deposit_Amount__c")],
            ["DS First Retainer/Setup Fee", oppSfDollar("DS_First_Retainer_Setup_Fee__c")],
            ["DS Monthly Service Fee", oppSfDollar("DS_Monthly_Service_Fee__c")],
            ["DS Weekly Service Fee", oppSfDollar("DS_Weekly_Service_Fee__c")],
            ["DS Payment Frequency", oppSf("DS_Payment_Frequency__c")],
            ["DS Program Fee Percentage", oppSf("DS_Program_Fee_Percentage__c")],
            ["DS Retainer Percentage", oppSf("DS_Retainer_Percentage__c")],
            ["DS Settlement Percentage", oppSf("DS_Settlement_Percentage__c")],
            ["DS Total Citadel Fee", oppSfDollar("DS_Total_Citadel_Fee__c")],
            ["DS Total Draft Amount", oppSfDollar("DS_Total_Draft_Amount__c")],
            ["DS Total Escrow Amount", oppSfDollar("DS_Total_Escrow_Amount__c")],
            ["DS Total Fee Percentage", oppSf("DS_Total_Fee_Percentage__c")],
            ["DS Total Processor Fee", oppSfDollar("DS_Total_Processor_Fee__c")],
            ["DS Total Retainer Fee", oppSfDollar("DS_Total_Retainer_Fee__c")],
            ["DS Total Service Fee", oppSfDollar("DS_Total_Service_Fee__c")],
            ["DS Total Setup Fee", oppSfDollar("DS_Total_Setup_Fee__c")],
            ["DS RAM Contract Rule", oppSf("DS_RAM_Contract_Rule__c")],
            ["DS Current Day", oppSf("DS_Current_Day__c")],
            ["DS Current Month", oppSf("DS_Current_Month__c")],
            ["DS Current Year", oppSf("DS_Current_Year__c")],
          ]}
        />
      </Section>

      <Section title="DS Buyout Details" defaultOpen={false}>
        <FieldGrid
          fields={[
            ["DS Buyout Savings", oppSfDollar("DS_Buyout_Savings__c")],
            ["DS Buyout Settlement to Creditors", oppSfDollar("DS_Buyout_Settlement_to_Creditors__c")],
            ["DS Buyout Total Program Cost", oppSfDollar("DS_Buyout_Total_Program_Cost__c")],
          ]}
        />
      </Section>

      <Section title="Payment Calculator (SF Report Link)" defaultOpen={false}>
        {/* SF stores this as an HTML anchor blob; render the raw markup so the
            embedded report link stays clickable for parity with SF. */}
        <FieldGrid
          fields={[
            ["Payment Calculator Drafts View", oppSf("Payment_Calculator_Drafts_View__c") ? (
              <div
                key="pcv"
                style={{ fontSize: 13 }}
                // Render SF HTML anchor exactly as SF stores it. The script
                // already prints this as a fragment so we let SF retain its own
                // styling/href.
                dangerouslySetInnerHTML={{ __html: oppSf("Payment_Calculator_Drafts_View__c") ?? "" }}
              />
            ) : null],
          ]}
        />
      </Section>

      {opp.notes && !oppSf("Description") && (
        <Section title="Notes" defaultOpen={false}>
          <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{opp.notes}</div>
        </Section>
      )}
    </>
  );

  const activitiesPanel = (
    <Section title={`Activities (${activity.length})`}>
      <div style={{ fontSize: 12, color: "#706e6b", marginBottom: 8 }}>
        Includes calls, emails, SMS and tasks from both the Opportunity and originating Lead.
      </div>
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
                  <td style={td}>{a.meta ?? "-"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </Section>
  );

  const debtPanel = (
    <Section title={`Debt Information (${opp.debts.length})`}>
      <OppDebtInformation
        opportunityId={opp.id}
        items={opp.debts.map((d) => ({
          id: d.id,
          creditorName: d.creditor?.account?.name ?? d.creditorName,
          debtType: d.debtType,
          paymentFrequency: d.paymentFrequency,
          paymentAmount: d.paymentAmount,
          originalBalance: d.originalBalance,
          currentBalance: d.currentBalance,
          enrolledBalance: d.enrolledBalance,
          status: d.status,
        }))}
      />
    </Section>
  );

  const calcPanel = (
    <Section title="Payment Calculator">
      <PaymentCalculatorV2
        saveEndpoint={`/api/opportunities/${opp.id}/calculator`}
        initial={{
          totalDebt: latestCalc?.totalDebt ?? totalDebtVal,
          termMonths: latestCalc?.programFeePeriod ?? 6,
          firstPaymentDate: latestCalc?.firstPaymentDate
            ? latestCalc.firstPaymentDate.toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10),
        }}
      />
    </Section>
  );

  const settlementsPanel = (
    <Section title="Settlements">
      {opp.debts.some((d) => d.settlement) ? (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fafaf9", borderBottom: "1px solid #d8dde6" }}>
              <th style={th}>Creditor</th>
              <th style={th}>Settled Amount</th>
              <th style={th}>Savings %</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {opp.debts
              .filter((d) => d.settlement)
              .map((d) => (
                <tr key={d.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                  <td style={td}>{d.creditor?.account?.name ?? d.creditorName}</td>
                  <td style={td}>${d.settlement!.settledAmount.toLocaleString()}</td>
                  <td style={td}>{Math.round(d.settlement!.savingsPercent * 100)}%</td>
                  <td style={td}>
                    <StatusPill label={d.settlement!.status} tone={settlementStatusTone(d.settlement!.status)} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      ) : (
        <div style={{ padding: 24, textAlign: "center", color: "#706e6b" }}>No settlements yet.</div>
      )}
    </Section>
  );

  const documentsPanel = (
    <>
      <EnvelopesRelatedList
        envelopes={opp.envelopes.map((e) => ({
          id: e.id,
          recordType: e.recordType,
          status: e.status,
          signerName: e.signerName,
          signerEmail: e.signerEmail,
          templateName: e.templateName,
          documentName: e.documentName,
          signingToken: e.signingToken,
          sentAt: e.sentAt?.toISOString() ?? null,
          signedAt: e.signedAt?.toISOString() ?? null,
          completedAt: e.completedAt?.toISOString() ?? null,
          createdAt: e.createdAt.toISOString(),
        }))}
        opportunityId={opp.id}
        defaultSignerName={opp.primaryContact?.fullName}
        defaultSignerEmail={opp.lead?.email ?? undefined}
      />
      <Section title={`Files (${opp.documents.length})`}>
        <DocumentsUpload
          endpoint={`/api/opportunities/${opp.id}/documents`}
          items={opp.documents.map((d) => ({
            id: d.id,
            name: d.name,
            type: d.type,
            fileSize: d.fileSize,
            createdAt: d.createdAt.toISOString(),
            uploadedBy: d.uploadedBy ? { name: d.uploadedBy.name } : null,
          }))}
        />
      </Section>
    </>
  );

  const relatedPanel = (
    <>
      <RelatedList
        entity="Account"
        title="Program Plans"
        items={opp.programPlans}
        emptyHint="No program plan yet."
        renderItem={(p) => (
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12 }}>
            <Link href={`/program-plans/${p.id}`} style={{ color: "#1589ee" }}>
              {p.recordType.replace(/_/g, " ")}
            </Link>
            <span>${p.monthlyAmount.toLocaleString()} / mo</span>
            <span>{p.termMonths} mo</span>
            <StatusPill label={p.status} tone={genericTone(p.status)} />
          </div>
        )}
      />
      <LeadHistoryCard
        rows={opp.history.map((h) => ({
          id: h.id,
          field: h.field,
          oldValue: h.oldValue,
          newValue: h.newValue,
          changedBy: h.changedBy,
          changedAt: h.changedAt,
        }))}
        entityLabel="Opportunity Field History"
        emptyHint="No history."
      />
    </>
  );

  const sfFieldsPanel = (
    <SfDataSection sfDataJson={opp.sfDataJson} sfId={opp.sfId} />
  );

  const marketingPanel = (
    <Section title="Marketing Attribution">
      <FieldGrid
        fields={[
          ["Lead Source", opp.lead?.source],
          ["Originating Lead", opp.lead?.id ? (
            <Link href={`/leads/${opp.lead.id}`} style={{ color: "#1589ee" }}>
              {opp.lead.contactName}
            </Link>
          ) : null],
        ]}
      />
    </Section>
  );

  const sfOppIdDisplay = opp.sfId ?? opp.id.slice(-8).toUpperCase();

  return (
    <div className="sf-record-page">
      <RecordPage
        entity="Opportunity"
        entityLabel="Opportunity"
        recordTitle={oppName}
        recordSubtitle={
          <>
            {opp.recordType.replace(/_/g, " ")} ·{" "}
            <StatusPill label={formatStage(opp.stage)} tone={opportunityStageTone(opp.stage)} />
          </>
        }
        highlights={[
          { label: "Account Name", value: accountLink },
          { label: "Current Total Debt", value: `$${totalDebtVal.toLocaleString()}` },
          { label: "Lead Id", value: sfLeadIdDisplay },
          { label: "Opportunity Owner", value: ownerDisplay },
          { label: "Opp Id", value: sfOppIdDisplay },
        ]}
        actions={<OppHeaderButtons opportunityId={opp.id} currentStage={opp.stage} defaultEmail={emailDisplay ?? opp.lead?.email ?? null} defaultPhone={phoneDisplay ?? opp.lead?.phone ?? null} defaultSignerName={opp.primaryContact?.fullName ?? opp.lead?.contactName ?? null} />}
        pathStages={PATH}
        pathCurrentIndex={oppPathIndex(opp.stage)}
        pathActionLabel={(() => {
          const idx = oppPathIndex(opp.stage);
          if (idx >= PATH.length - 1) return "Change Closed Stage";
          // SF labels the action by the current stage being completed, e.g.
          // "Mark First Payment Complete" when current is "Closed Won First
          // Payment Pending". We strip the wordy prefixes.
          const cur = PATH[idx]?.label ?? "Current Stage";
          const short = cur
            .replace(/^Closed Won /, "")
            .replace(/^Closed /, "")
            .replace(/^Working /, "")
            .replace(/ Pending$/, "")
            .replace(/^Waiting for /, "")
            .replace(/s Received$/, "");
          return `Mark ${short} Complete`;
        })()}
        details={
          <OppTabs
            panels={{
              Details: detailsPanel,
              Activities: activitiesPanel,
              "Debt Information": debtPanel,
              "Payment Calculator": calcPanel,
              Settlements: settlementsPanel,
              Documents: documentsPanel,
              Related: relatedPanel,
              Marketing: marketingPanel,
              "All SF Fields": sfFieldsPanel,
            }}
          />
        }
        rail={
          <>
            {/* Rail order mirrors SF Kenya Palmer screenshot:
                Total Payments Summary → Reports → DocuSign Envelope Status →
                Contact Roles. Activity / Chatter sits below. */}
            <TotalPaymentsSummary
              programLengthMonths={latestCalc?.programFeePeriod ?? null}
              totalDebt={totalDebtVal}
              totalProgramCost={formulas.totalAmountWithFees ?? latestCalc?.estimatedAmount ?? null}
              totalProgramFee={formulas.totalProgramFee ?? null}
              totalSetupFee={latestCalc?.setupFee ?? null}
              totalBankFee={formulas.totalBankFee ?? null}
              totalServiceFee={latestCalc?.serviceFee ?? null}
              totalSettlement={formulas.estimatedSettlement ?? latestCalc?.totalSettlement ?? null}
              totalWeeklyPayment={totalWeekly || null}
              empty={!latestCalc && opp.programPlans.length === 0}
            />
            <OppReportsCard opportunityId={opp.id} />
            <DocusignEnvelopeStatus
              envelopes={opp.envelopes.map((e) => ({
                id: e.id,
                templateName: e.templateName,
                documentName: e.documentName,
                status: e.status,
                signerName: e.signerName,
                sentAt: e.sentAt?.toISOString() ?? null,
                signedAt: e.signedAt?.toISOString() ?? null,
                completedAt: e.completedAt?.toISOString() ?? null,
                createdAt: e.createdAt.toISOString(),
              }))}
            />
            <ContactRolesCard
              primary={opp.primaryContact}
              accountId={opp.account?.id}
            />
            <ActivityChatterRail activities={activity} chatter={chatter} opportunityId={opp.id} defaultEmail={opp.oppEmail ?? opp.lead?.email ?? null} />
          </>
        }
      />
    </div>
  );
}

function ContactRolesCard({
  primary,
  accountId,
}: {
  primary: { id: string; fullName: string } | null;
  accountId?: string;
}) {
  if (!primary) return null;
  return (
    <article
      style={{
        background: "#fff",
        border: "1px solid #dddbda",
        borderRadius: 4,
        marginBottom: 12,
        boxShadow: "0 2px 2px 0 rgba(0,0,0,0.05)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 12px",
          background: "#fafaf9",
          borderBottom: "1px solid #ecebea",
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" style={{ fill: "#706e6b", transform: "rotate(90deg)" }}>
          <path d="M2 0l6 5-6 5z" />
        </svg>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#080707", margin: 0 }}>
          Contact Roles (1)
        </h3>
      </header>
      <div style={{ padding: "8px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}>
          <Link href={`/contacts/${primary.id}`} style={{ color: "#0070d2" }}>
            {primary.fullName}
          </Link>
          <span style={{ color: "#3e3e3c" }}>Primary</span>
        </div>
      </div>
      {accountId && (
        <div style={{ textAlign: "center", padding: "8px 12px", borderTop: "1px solid #ecebea" }}>
          <Link
            href={`/accounts/${accountId}`}
            style={{ color: "#0070d2", fontSize: 12 }}
          >
            View All
          </Link>
        </div>
      )}
    </article>
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
