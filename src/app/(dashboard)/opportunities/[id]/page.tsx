import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecordPage, StatusPill } from "@/components/slds/record-page";
import { Section, FieldGrid } from "@/components/slds/section";
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

function oppPathIndex(stage: string): number {
  const i = PATH_HAPPY.indexOf(stage);
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

  const detailsPanel = (
    <>
      {/* Order mirrors the SF Lightning Details tab on the Kenya Palmer record:
          Opportunity Name → Account Name → Close Date → Owner → Total Debt
          Including Fees → Probability → Lead Source → Created By, then the
          remaining SF detail rows in the same two-column rhythm. */}
      <Section title="Opportunity Information">
        {/* Labels are kept IDENTICAL to the Salesforce label strings produced
            by scripts/list-sf-vs-crm-fields-v2.ts so the Kenya Palmer detail
            page is a true 1:1 parity match with the SF Lightning UI. */}
        <FieldGrid
          fields={[
            ["Name", oppSf("Name") ?? oppName],
            ["Opportunity Name", oppName],
            ["Opportunity ID", oppSf("Id") ?? opp.sfId],
            ["Account Name", accountLink],
            ["Close Date", closeDateDisplay],
            ["Opportunity Owner", ownerDisplay],
            ["Total Debt Including Fees", totalDebtDisplay],
            ["Probability", probabilityDisplay],
            ["Lead Source", opp.lead?.source ?? oppSf("LeadSource")],
            ["Created By", createdByDisplay],
            ["Stage", <StatusPill key="s" label={opp.stage} tone={opportunityStageTone(opp.stage)} />],
            ["Sub-Disposition", oppSf("Sub_Disposition__c")],
            ["Lead Source Category", oppSf("Lead_Source_Category__c")],
            ["Current Total Debt", oppSfDollar("Current_Total_Debt__c") ?? totalDebtDisplay],
            ["Estimated Total Debt", oppSfDollar("Estimated_Total_Debt__c")],
            ["Current Weekly Payment", oppSfDollar("Current_Weekly_Payment__c")],
            ["Current Monthly Payment", oppSfDollar("Current_Monthly_Payment__c")],
            ["Weekly Payment to Debt Ratio", oppSf("Weekly_Payment_To_Debt_Ratio__c")],
            ["Amount", oppSfDollar("Amount")],
            ["First Draft Date", oppSfDate("First_Draft_Date__c")],
            ["First Contract Signed Date", oppSfDate("First_Contract_Signed_Date__c")],
            ["Owner Email", oppSf("Owner_Username__c")],
            ["Fronter", oppSf("Fronter__c")],
            ["Closer", oppSf("Closer__c")],
            ["Call Transfer Status", oppSf("Call_Transfer_Status__c")],
            ["Transfer Qualification", oppSf("Transfer_Qualification__c")],
            ["Version", opp.version],
            ["Version Status", oppSf("Version_Status__c")],
            ["Product", opp.recordType.replace(/_/g, " ")],
            ["Primary Contact", opp.primaryContact?.fullName],
            ["Phone", oppSf("Phone__c") ?? oppSf("Phone")],
            ["Formatted Phone", oppSf("Formatted_Phone__c")],
            ["Verified Phone Number", oppSf("Verified_Phone_Number__c")],
            ["Email", oppSf("Email__c") ?? oppSf("Email")],
            ["Last Contacted", oppSfDate("Last_Contacted_DateTime__c")],
            ["Last Call", oppSfDate("Last_Call_DateTime__c")],
            ["Last Email", oppSfDate("Last_Email_DateTime__c")],
            ["Last SMS", oppSfDate("Last_SMS_DateTime__c")],
            ["Timezone", oppSf("Timezone__c")],
            ["Preferred Contact Method", oppSf("Preferred_Method_Of_Contact__c")],
            ["Preferred Language", oppSf("Preferred_Language__c")],
            ["Dialer Group", oppSf("Dialer_Group__c")],
            ["Business Start Date", oppSfDate("Business_Start_Date__c")],
            ["Account Status", oppSf("Account_Status__c")],
            ["DNC", oppSf("DNC__c")],
            ["Call ASAP", oppSf("Call_ASAP__c")],
            ["Created", opp.createdAt.toLocaleString()],
          ]}
        />
      </Section>

      <Section title="Lock & Lifecycle" defaultOpen={false}>
        {/* SF-side lock + assignment lifecycle flags. */}
        <FieldGrid
          fields={[
            ["Active Opportunity", oppSf("Active_Opportunity__c")],
            ["Active Opportunity Test", oppSf("Active_Opportunity_Test__c")],
            ["Lock Opportunity", oppSf("Lock_Opportunity__c")],
            ["Opportunity Lock Criteria", oppSf("Opportunity_Lock_Criteria__c")],
            ["Re-shuffle Opportunity", oppSf("Re_shuffle_Opportunity__c")],
            ["Fee Paid in Full", oppSf("Fee_Paid_in_Full__c")],
            ["Qualified Financial", oppSf("Qualified_Financial_Formula__c")],
            ["Opportunity Assignment Date", oppSfDate("Opportunity_Assignment_Date__c")],
            ["Lead Created Date", oppSfDate("Lead_Created_Date__c")],
            ["Number Of Days From First ContractSigned", oppSf("Number_Of_Days_From_First_ContractSigned__c")],
          ]}
        />
      </Section>

      <Section title="Closer / Fronter" defaultOpen={false}>
        {/* SF user-lookup references (raw SF user IDs from sfDataJson). */}
        <FieldGrid
          fields={[
            ["Closer Reference", oppSf("CloserLookup__c")],
            ["Fronter Reference", oppSf("FronterLookup__c")],
            ["Call Received By Reference", oppSf("Call_Received_By_Lookup__c")],
            ["Call Transferred By Reference", oppSf("Call_Transferred_By_Lookup__c")],
            ["Has Closer Notes", oppSf("Has_Closer_Notes__c")],
            ["Latest Closer Notes", oppSf("Latest_Closer_Notes__c")],
          ]}
        />
      </Section>

      <Section title="Engagement Timestamps" defaultOpen={false}>
        {/* Raw SF event timestamps (in addition to *_DateTime__c shown above). */}
        <FieldGrid
          fields={[
            ["Last Called Time", oppSfDate("Last_Call__c")],
            ["Last SMS Time", oppSfDate("Last_SMS__c")],
          ]}
        />
      </Section>

      <Section title="Marketing / Lead Trace" defaultOpen={false}>
        {/* Tracks the originating tracking IDs from SF. */}
        <FieldGrid
          fields={[
            ["Ad Click Id", oppSf("Ad_Click_Id__c")],
            ["Lead Id", oppSf("Lead_Id__c")],
            ["Individual", oppSf("Individual__c")],
          ]}
        />
      </Section>

      <Section title="Lender / Legal" defaultOpen={false}>
        <FieldGrid
          fields={[
            ["Processor", oppSf("Processor__c")],
            ["Processor Info", oppSf("Processor_Info__c")],
            ["Processor Contract Formula", oppSf("Processor_Contract_Formula__c")],
            ["Legal Network", oppSf("Legal_Network__c")],
            ["Lender Agreements Collected", oppSf("Lender_Agreements_Collected__c")],
            ["Status with Lenders", oppSf("Status_with_Lenders__c")],
            ["First Payment to Legal", oppSfDate("First_Payment_to_Legal__c")],
            ["Legal Plan Required", oppSf("Legal_Plan_Required__c")],
            ["Addendum Required", oppSf("Addendum_Required__c")],
            ["Secured Party", oppSf("Secured_Party__c")],
            ["HIGH UCC RISK", oppSf("HIGH_UCC_RISK__c") ?? oppSf("High_UCC_Risk__c")],
            ["COJ / TRO", oppSf("COJ_or_TRO__c")],
            ["Summons / Judgment", oppSf("Summons_or_Judgment__c")],
            ["Order Number", oppSf("Order_Number__c")],
            ["Current Generators", oppSf("Current_Generators__c")],
            ["Tracking Number", oppSf("Tracking_Number__c")],
            ["Welcome Call Scheduled", oppSfDate("Welcome_Call_Scheduled__c")],
            ["Loss Reason", oppSf("Loss_Reason__c")],
            ["Next Step", oppSf("Next_Step__c") ?? oppSf("NextStep")],
            ["What was explained to client?", oppSf("What_was_explained_to_client__c") ?? oppSf("What_Was_Explained_to_Client__c")],
            ["Main Competitors", oppSf("Main_Competitors__c")],
            ["Delivery Installation Status", oppSf("Delivery_Installation_Status__c")],
            ["RT Debt Amount Opportunity Events", oppSfDollar("RT_Debt_Amount_Opportunity_Events__c")],
          ]}
        />
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

      <Section title="Client Questionnaire" defaultOpen={false}>
        <FieldGrid
          fields={[
            ["Type of Business", opp.typeOfBusiness],
            ["Receivables Collection Method", opp.receivablesCollectionMethod],
            ["Bank Change", opp.bankChange],
            ["High Lien Risk", opp.highLienRisk],
          ]}
        />
      </Section>

      {opp.notes && (
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
      <RelatedList
        entity="Account"
        title="Opportunity Field History"
        items={opp.history}
        emptyHint="No history."
        renderItem={(h) => (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 12 }}>
            <div>{new Date(h.changedAt).toLocaleString()}</div>
            <div>{h.field}</div>
            <div>{h.changedBy?.name ?? "System"}</div>
            <div style={{ color: "#706e6b" }}>{h.oldValue ?? "-"}</div>
            <div>{h.newValue ?? "-"}</div>
          </div>
        )}
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

  // SF Lead Id is captured on the opp as sfLeadIdText (free text from SF) or
  // can be derived from the linked CRM Lead row's sfId. Fall back to the CRM
  // lead id only as a last resort.
  const sfLeadIdDisplay =
    opp.sfLeadIdText ??
    oppSf("Lead_Id__c") ??
    opp.lead?.sfId ??
    (opp.lead?.id ? opp.lead.id.slice(-8).toUpperCase() : null);

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
            <StatusPill label={opp.stage} tone={opportunityStageTone(opp.stage)} />
          </>
        }
        highlights={[
          { label: "Account Name", value: accountLink },
          { label: "Current Total Debt", value: `$${totalDebtVal.toLocaleString()}` },
          { label: "Lead Id", value: sfLeadIdDisplay },
          { label: "Opportunity Owner", value: ownerDisplay },
          { label: "Opp Id", value: sfOppIdDisplay },
        ]}
        actions={<OppHeaderButtons opportunityId={opp.id} currentStage={opp.stage} />}
        pathStages={PATH}
        pathCurrentIndex={oppPathIndex(opp.stage)}
        pathActionLabel="Mark Stage as Complete"
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
            <ActivityChatterRail activities={activity} chatter={chatter} />
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
