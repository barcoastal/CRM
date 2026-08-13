import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecordPage, StatusPill } from "@/components/slds/record-page";
import { PathSidePanelServer } from "@/components/path/path-side-panel-server";
import { Section, FieldGrid } from "@/components/slds/section";
import { E } from "@/components/slds/field-helpers";
import { ActivityChatterRail, type ChatterPost } from "@/components/slds/activity-chatter-rail";
import type { ActivityItem } from "@/components/slds/activity-rail";
import { RelatedList } from "@/components/slds/related-list";
import { OppTabs } from "@/components/opportunities/opp-tabs";
import { OppHeaderButtons } from "@/components/opportunities/opp-header-buttons";
import { OppDebtInformation } from "@/components/opportunities/opp-debt-information";
import { ContactRolesList } from "@/components/accounts/contact-roles-list";
import { AddContactButton } from "@/components/contacts/add-contact-button";
import { RescheduleCalculator } from "@/components/shared/reschedule-calculator";
import { generateRescheduleSchedule } from "@/lib/reschedule-schedule";
import { DocumentsUpload } from "@/components/leads/documents-upload";
import { RequestDocumentsButton } from "@/components/opportunities/request-documents-button";
import { EnvelopesRelatedList } from "@/components/envelopes/envelopes-related-list";
import { resolveAgreement } from "@/lib/creditor-agreements";
import { TotalPaymentsSummary } from "@/components/opportunities/total-payments-summary";
import { DocusignEnvelopeStatus } from "@/components/opportunities/docusign-envelope-status";
import { OppReportsCard } from "@/components/opportunities/opp-reports-card";
import { settlementStatusTone, genericTone } from "@/lib/slds/status-tones";
import { OPP_STAGES } from "@/lib/sf-canonical";
import { SfDataSection } from "@/components/slds/sf-data-section";
import { ClientSubmittedInfoCard } from "@/components/shared/client-submitted-info";
import { RecordNotes } from "@/components/shared/record-notes";
import { resolveSfUserNames, isSfUserId } from "@/lib/sf-users";
import { NotesRailCard } from "@/components/shared/notes-rail-card";
import { fetchChainNotes } from "@/lib/notes";
import { LeadHistoryCard } from "@/components/leads/lead-history-card";
import { RecordFiles } from "@/components/files/record-files";

/**
 * SF path strip — mirrors the green-arrow path on the Kenya Palmer screenshot.
 * Note that "Archived" / "Closed Lost" terminal stages are intentionally NOT in
 * the path (SF treats them as off-path terminal states; the path renders the
 * happy-path sequence only).
 */
// SF Lightning Path for the Opportunity (verified against the live org's
// OpportunityStage picklist + the record page): ... Contract Sent -> Contract
// Signed -> Closed Won First Payment Pending -> "Closed" terminal chevron
// (Lightning collapses the closed stages into one final "Closed" step).
const PATH_HAPPY: readonly string[] = [
  "Working Opportunity",
  "Waiting for Agreements",
  "Agreements Received",
  "Ready To Close",
  "Contract Sent",
  "Contract Signed",
  "Closed Won First Payment Pending",
  "Closed",
] as const;
const PATH = PATH_HAPPY.map((s) => ({ label: s }));
// Stage options for the inline Stage select — real SF stage names (the path's
// terminal "Closed" chevron is a display grouping, not a pickable stage).
const STAGE_OPTIONS: readonly string[] = [
  "Working Opportunity",
  "Waiting for Agreements",
  "Agreements Received",
  "Ready To Close",
  "Contract Sent",
  "Contract Signed",
  "Archived",
  "Archived - Finalized",
  "Closed Won First Payment Pending",
  "Closed Won - First Payment Completed",
  "Closed Lost",
] as const;

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
  if (s.includes("CLOSED") && s.includes("WON") && s.includes("COMPLETED")) return 7;
  if (s.includes("CLOSED") && s.includes("LOST")) return 7;
  if (s.includes("CLOSED") && s.includes("WON")) return 6;
  if (s.includes("CONTRACT") && s.includes("SIGNED")) return 5;
  if (s.includes("CONTRACT") && s.includes("SENT")) return 4;
  if (s.includes("READY")) return 3;
  if (s.includes("AGREEMENT")) return 2;
  if (s.includes("WAITING")) return 1;
  return 0;
}
// SF opp path: the 8 open stages, then ONE terminal chevron that displays the
// actual closed stage name ("Closed Won - ...", "Closed Lost") once closed.
const OPP_PATH_OPEN_STAGES = OPP_STAGES.filter((st) => !st.startsWith("Closed"));

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
      account: {
        select: {
          id: true,
          name: true,
          recordType: true,
          primaryContactId: true,
          contacts: { include: { contact: { select: { id: true, fullName: true, title: true, email: true, phone: true } } } },
        },
      },
      primaryContact: { select: { id: true, fullName: true, email: true } },
      assignedTo: { select: { id: true, name: true } },
      client: true,
      debts: {
        include: {
          sourceDocument: { select: { name: true, analysisJson: true } },
          creditor: { include: { account: { select: { name: true } } } },
          offers: { include: { settlements: true }, orderBy: { createdAt: "desc" } },
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

  const chainNotes = await fetchChainNotes({
    leadIds: [opp.lead?.id],
    opportunityIds: [opp.id],
    accountIds: [opp.account?.id],
  });

  // What the client sent back through Request Info links (Client Submitted Info box).
  const infoRequests = await prisma.documentRequest.findMany({
    where: { opportunityId: opp.id, kind: "INFO", status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    take: 5,
    select: { id: true, recipientName: true, recipientEmail: true, completedAt: true, collectedJson: true },
  });

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
    if (d.paymentAmount == null || d.paymentAmount <= 0 || !d.paymentFrequency) return s;
    // SF business-week conversion (mirrors LeadTriggerHandler / lead-debt-rollup):
    // Daily ×5, Weekly ×1, Bi-Weekly ÷2, Monthly ÷4, Lump-sum 0. NOT annualized.
    const perWeek: Record<string, number> = { DAILY: 5, WEEKLY: 1, BI_WEEKLY: 0.5, MONTHLY: 0.25, LUMP_SUM: 0 };
    return s + d.paymentAmount * (perWeek[d.paymentFrequency] ?? 1);
  }, 0);

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
    if (!Number.isFinite(n)) return v;
    return n < 0 ? `-$${Math.abs(n).toLocaleString()}` : `$${n.toLocaleString()}`;
  };
  const oppSfDate = (k: string): string | null => {
    const v = oppSf(k);
    if (!v) return null;
    const d = new Date(v);
    // Date-only SF values parse as UTC midnight — format in UTC so the day
    // doesn't shift when the server renders in another timezone.
    return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("en-US", { timeZone: "UTC" });
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
    <Link href={`/accounts/${opp.account.id}`} style={{ color: "#0176d3" }}>
      {accountDisplayName}
    </Link>
  ) : (
    accountDisplayName ?? null
  );

  const ownerName = opp.assignedTo?.name ?? oppSf("Owner_Full_Name__c");
  // SF renders the owner as a user link with a small avatar; link to our
  // user record when the owner exists in the CRM, else plain text.
  const ownerDisplay = opp.assignedTo ? (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#7f8de1",
          color: "#fff",
          fontSize: 10,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {(opp.assignedTo.name || "?")
          .split(/\s+/)
          .map((p) => p[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()}
      </span>
      <Link href={`/settings/users/${opp.assignedTo.id}`} style={{ color: "#0176d3" }}>
        {opp.assignedTo.name}
      </Link>
    </span>
  ) : (
    ownerName
  );
  // Active users for the Opportunity Owner inline-edit select (SF: change owner).
  const ownerOptions = (
    await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })
  ).map((u) => ({ label: u.name, value: u.id }));
  const closeDateDisplay = opp.expectedCloseDate?.toLocaleDateString() ?? oppSfDate("CloseDate");
  const totalDebtDisplay = `$${totalDebtVal.toLocaleString()}`;
  const probabilityDisplay = (() => {
    const p = oppSf("Probability");
    if (!p) return null;
    const n = Number(p);
    return Number.isFinite(n) ? `${n}%` : p;
  })();
  // Call Disposition lookups + Fronter/Closer may hold raw SF user ids.
  const oppSfUserMap = await resolveSfUserNames([
    oppSf("Fronter__c"),
    oppSf("Closer__c"),
    oppSf("FronterLookup__c"),
    oppSf("CloserLookup__c"),
    oppSf("Call_Transferred_By__c"),
    oppSf("Call_Received_By__c"),
    oppSf("Call_Transferred_By_Lookup__c"),
    oppSf("Call_Received_By_Lookup__c"),
  ]);
  const oppSfUser = (k: string): React.ReactNode => {
    const v = oppSf(k);
    if (!v) return null;
    if (!isSfUserId(v)) return v;
    const u = oppSfUserMap.get(v.trim());
    return u ? (
      <Link key={k} href={`/settings/users/${u.id}`} style={{ color: "#0176d3" }}>
        {u.name}
      </Link>
    ) : (
      v
    );
  };

  // CreatedById/LastModifiedById are SF user ids; resolve to names via our
  // mirrored User rows (there is no *_Full_Name__c formula on Opportunity).
  const auditSfIds = [oppSf("CreatedById"), oppSf("LastModifiedById")].filter(
    (v): v is string => !!v && /^005[a-zA-Z0-9]{12,15}$/.test(v),
  );
  const auditUsers = auditSfIds.length
    ? await prisma.user.findMany({ where: { sfId: { in: auditSfIds } }, select: { name: true, sfId: true } })
    : [];
  const userNameBySfId = new Map(auditUsers.map((u) => [u.sfId, u.name]));
  const createdByDisplay = (oppSf("CreatedById") ? userNameBySfId.get(oppSf("CreatedById")!) : null) ?? "";
  const lastModifiedByDisplay = (oppSf("LastModifiedById") ? userNameBySfId.get(oppSf("LastModifiedById")!) : null) ?? null;

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
    if (Number.isNaN(d.getTime())) return v;
    // SF renders datetimes in the org timezone: "12/5/2024, 1:44 PM" (EST).
    return `${d.toLocaleDateString("en-US", { timeZone: "America/New_York" })}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })}`;
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
  const lastDispositionDisplay = oppSf("Last_Disposition__c");
  const timezoneDisplay = oppSf("Timezone__c");
  const currentTotalDebtDisplay = oppSfDollar("Current_Total_Debt__c") ?? totalDebtDisplay;
  // SF stores phone/email as *_Formula__c fields on Opportunity (formulas pull
  // the canonical value from the linked Account/Contact). Fall back to the raw
  // Phone__c/Email__c variants for older snapshots.
  const phoneDisplay = oppSf("Phone_Formula__c") ?? oppSf("Formatted_Phone__c") ?? oppSf("Phone__c") ?? oppSf("Phone");
  const emailDisplay = oppSf("Email_Formula__c") ?? oppSf("Email__c") ?? oppSf("Email");

  const detailsPanel = (
    <>
      {/* SF "Opportunity Information" section, extracted live from the org via
          the UI API layout (recordType 012VO0000026jhGYAQ, mode=View). Even
          index = left col, odd = right col. useHeading=false in SF, so no
          section header. E(...) rows are inline-editable. */}
      <FieldGrid
          entityType="opportunity"
          entityId={opp.id}
          fields={[
            // Row 1: Opportunity Name | Opportunity Owner
            E("Opportunity Name", oppName, "name", "text", { rawValue: opp.name ?? oppName }),
            E("Opportunity Owner", ownerDisplay, "assignedToId", "select", { rawValue: opp.assignedToId ?? null, options: ownerOptions }),
            // Row 2: Account Name | Lead Id
            E("Account Name", accountLink, "accountId", "lookup", { rawValue: opp.accountId ?? null, lookupEndpoint: "/api/lookup/accounts" }),
            ["Lead Id", sfLeadIdDisplay],
            // Row 3: Stage | Lead Source (SF shows the stage as plain text)
            [
              "Stage",
              formatStage(opp.stage),
              { fieldKey: "stage", type: "select", rawValue: opp.stage, options: STAGE_OPTIONS.map((s) => ({ label: s, value: s })) },
            ],
            E("Lead Source", opp.lead?.source ?? oppSf("LeadSource"), "leadSource"),
            // Row 4: Version Status | Lead Source Category
            ["Version Status", oppSf("Version_Status__c")],
            E("Lead Source Category", oppSf("Lead_Source_Category__c"), "leadSourceCategory"),
            // Row 5: Last Disposition | Probability (%)
            E("Last Disposition", lastDispositionDisplay, "Last_Disposition__c"),
            E("Probability (%)", probabilityDisplay, "probability", "number", { rawValue: opp.probability ?? null }),
            // Row 6: Phone | Total Debt Included
            [
              "Phone",
              phoneDisplay ? <span key="ph" style={{ color: "#0176d3" }}>{phoneDisplay}</span> : null,
              { fieldKey: "oppPhone", type: "phone", rawValue: opp.oppPhone ?? phoneDisplay ?? null },
            ],
            ["Total Debt Included", oppSfDollar("Total_Debt__c") ?? totalDebtDisplay],
            // Row 7: Email | Current Total Debt
            [
              "Email",
              emailDisplay ? <a key="em" href={`mailto:${emailDisplay}`} style={{ color: "#0176d3" }}>{emailDisplay}</a> : null,
              { fieldKey: "oppEmail", type: "email", rawValue: opp.oppEmail ?? emailDisplay ?? null },
            ],
            E("Current Total Debt", currentTotalDebtDisplay, "currentTotalDebt", "number", { rawValue: opp.currentTotalDebt ?? null }),
            // Row 8: Preferred method of Contact | Secured Party
            E("Preferred method of Contact", oppSf("Preferred_Method_Of_Contact__c") ?? oppSf("Preferred_method_of_Contact__c"), "preferredMethodOfContact"),
            E("Secured Party", oppSf("Secured_Party__c"), "securedParty"),
            // Row 9: Legal Plan Required | Lead Vendor ID Text
            E("Legal Plan Required", oppSfBool("Legal_Plan_Required__c"), "legalPlanRequired", "checkbox", { rawValue: opp.legalPlanRequired ?? null }),
            ["Lead Vendor ID Text", oppSf("Lead_Vendor_ID_Text__c")],
            // Row 10: Addendum Required | Call ASAP
            E("Addendum Required", oppSfBool("Addendum_Required__c"), "addendumRequired", "checkbox", { rawValue: opp.addendumRequired ?? null }),
            E("Call ASAP", oppSfBool("Call_ASAP__c"), "Call_ASAP__c", "checkbox"),
            // Row 11: Addendum Required Reason | Business Start Date
            ["Addendum Required Reason", oppSf("Addendum_Required_Reason__c")],
            E("Business Start Date", oppSfDate("Business_Start_Date__c"), "businessStartDate", "date", { rawValue: opp.businessStartDate ?? null }),
            // Row 12: Timezone | Hopper Priority
            E("Timezone", timezoneDisplay, "timezone"),
            ["Hopper Priority", oppSf("Hopper_priority_c__c") ?? oppSf("Hopper_Priority__c")],
            // Row 13: Current Weekly Payment | Outbound ANI Date
            E("Current Weekly Payment", oppSfDollar("Current_Weekly_Payment__c"), "currentWeeklyPayment", "number", { rawValue: opp.currentWeeklyPayment ?? null }),
            ["Outbound ANI Date", oppSfDate("Outbound_ANI_Date__c")],
            // Row 14: Current Monthly Payment | Outbound ANI From
            E("Current Monthly Payment", oppSfDollar("Current_Monthly_Payment__c"), "currentMonthlyPayment", "number", { rawValue: opp.currentMonthlyPayment ?? null }),
            ["Outbound ANI From", oppSf("Outbound_ANI_From__c")],
            // Row 15: Weekly Payment to Debt Ratio | Outbound ANI Identifier
            E("Weekly Payment to Debt Ratio", oppSf("Weekly_Payment_To_Debt_Ratio__c"), "weeklyPaymentToDebtRatio", "number", { rawValue: opp.weeklyPaymentToDebtRatio ?? null }),
            ["Outbound ANI Identifier", oppSf("Outbound_ANI_Identifier__c")],
            // Row 16: Dialer Group | First Payment Completed
            E("Dialer Group", oppSf("Dialer_Group__c"), "dialerGroup"),
            ["First Payment Completed", oppSfBool("First_Payment_Completed__c")],
            // Row 17: Re-shuffle Opportunity | First Draft Date
            ["Re-shuffle Opportunity", oppSfBool("Re_shuffle_Opportunity__c")],
            E("First Draft Date", oppSfDate("First_Draft_Date__c"), "firstDraftDate", "date", { rawValue: opp.firstDraftDate ?? null }),
            // Row 18: Re-shuffle count | First Contract Signed Date
            ["Re-shuffle count", oppSf("Re_shuffle_count__c")],
            E("First Contract Signed Date", oppSfDateTime("First_Contract_Signed_Date__c"), "firstContractSignedDateOpp", "datetime", { rawValue: opp.firstContractSignedDateOpp ?? null }),
            // Row 19: UTM Term | Number Of Days From First ContractSigned
            ["UTM Term", oppSf("UTM_Term__c")],
            ["Number Of Days From First ContractSigned", oppSf("Number_Of_Days_From_First_ContractSigned__c")],
            // Row 20: Preferred Language | Processor Contract Formula
            E("Preferred Language", oppSf("Preferred_Language__c"), "preferredLanguage"),
            ["Processor Contract Formula", oppSf("Processor_Contract_Formula__c")],
            // Row 21: First Payment Completed Date | Processor
            ["First Payment Completed Date", oppSfDate("First_Payment_Completed_Date__c")],
            E("Processor", oppSf("Processor__c"), "Processor__c"),
            // Row 22: Commission Payment Date | Opportunity Amended DateTime
            ["Commission Payment Date", oppSfDate("Commission_Payment_Date__c")],
            ["Opportunity Amended DateTime", oppSfDateTime("Opportunity_Amended_DateTime__c")],
            // Row 23: Commission Payment Date Override | Opportunity Reinstated DateTime
            ["Commission Payment Date Override", oppSfDate("Commission_Payment_Date_Override__c")],
            ["Opportunity Reinstated DateTime", oppSfDateTime("Opportunity_Reinstated_DateTime__c")],
            // Row 24: Commission Payment Override Reason | Opportunity Reactivated DateTime
            ["Commission Payment Override Reason", oppSf("Commission_Payment_Override_Reason__c")],
            ["Opportunity Reactivated DateTime", oppSfDateTime("Opportunity_Reactivated_DateTime__c")],
            // Row 25: Opportunity Assignment Date | Reactivate Reason
            ["Opportunity Assignment Date", oppSfDate("Opportunity_Assignment_Date__c")],
            ["Reactivate Reason", oppSf("Reactivate_Reason__c")],
            // Row 26: HIGH UCC RISK | Legal Network
            E("HIGH UCC RISK", oppSfBool("HIGH_UCC_RISK__c") ?? oppSfBool("High_UCC_Risk__c"), "highUccRisk", "checkbox", { rawValue: opp.highUccRisk ?? null }),
            E("Legal Network", oppSf("Legal_Network__c"), "Legal_Network__c"),
            // Rows 27-35: SF left column continues alone (right = EmptySpace)
            E("Account Status", oppSf("Account_Status__c"), "Account_Status__c"),
            ["", null],
            ["Ad Click Id", oppSf("Ad_Click_Id__c")],
            ["", null],
            ["Opportunity Record Type", opp.recordType.replace(/_/g, " ")],
            ["", null],
            ["Active Opportunity", oppSfBool("Active_Opportunity__c")],
            ["", null],
            ["Opportunity Reshuffled DateTime", oppSfDateTime("Opportunity_Reshuffled_DateTime__c")],
            ["", null],
            ["Affiliate", oppSf("Affiliate__c")],
            ["", null],
            ["Eli Ad click", oppSf("Eli_Ad_click__c") ?? oppSf("Eli_Ad_Click__c")],
            ["", null],
            ["Has Closer Notes", oppSfBool("Has_Closer_Notes__c")],
            ["", null],
            ["Latest Closer Notes", oppSf("Latest_Closer_Notes__c")],
            ["", null],
          ]}
        />

      <Section title="Buyout Program">
        {/* SF Buyout Program section (all formula fields, read-only). */}
        <FieldGrid
          entityType="opportunity"
          entityId={opp.id}
          fields={[
            ["DS Buyout Total Program Cost", oppSfDollar("DS_Buyout_Total_Program_Cost__c")],
            ["DS Buyout Settlement to Creditors", oppSfDollar("DS_Buyout_Settlement_to_Creditors__c")],
            ["DS Buyout Fee", oppSfDollar("DS_Buyout_Fee__c")],
            ["DS Buyout Savings", oppSfDollar("DS_Buyout_Savings__c")],
            ["Qualified Financial", oppSfBool("Qualified_Financial_Formula__c") ?? oppSfBool("Qualified_Financial__c")],
            ["", null],
          ]}
        />
      </Section>

      <Section title="Call Disposition">
        {/* SF Call Disposition — TwoColumnsLeftToRight. */}
        <FieldGrid
          entityType="opportunity"
          entityId={opp.id}
          fields={[
            // Row 1: Fronter | Closer
            E("Fronter", oppSfUser("Fronter__c"), "fronter"),
            E("Closer", oppSfUser("Closer__c"), "closer"),
            // Row 2: Fronter Reference | Closer Reference
            ["Fronter Reference", oppSfUser("FronterLookup__c")],
            ["Closer Reference", oppSfUser("CloserLookup__c")],
            // Row 3: Call Transferred By | Call Received By
            ["Call Transferred By", oppSfUser("Call_Transferred_By__c")],
            ["Call Received By", oppSfUser("Call_Received_By__c")],
            // Row 4: Call Transferred By Reference | Call Received By Reference
            ["Call Transferred By Reference", oppSfUser("Call_Transferred_By_Lookup__c")],
            ["Call Received By Reference", oppSfUser("Call_Received_By_Lookup__c")],
            // Row 5: Call Tranferred DateTime | Call Received Date
            ["Call Tranferred DateTime", oppSfDateTime("Call_Tranferred_DateTime__c") ?? oppSfDateTime("Call_Transferred_DateTime__c")],
            ["Call Received Date", oppSfDateTime("Call_Received_Date__c")],
            // Row 6: Call Transfer Status | Transfer Qualification
            E("Call Transfer Status", oppSf("Call_Transfer_Status__c"), "callTransferStatus"),
            E("Transfer Qualification", oppSf("Transfer_Qualification__c"), "transferQualification"),
            // Row 7: Sub Disposition | Last Sub Disposition
            E("Sub Disposition", oppSf("Sub_Disposition__c"), "subDisposition"),
            ["Last Sub Disposition", oppSf("Last_Sub_Disposition__c")],
            // Row 8: Last Called Time | Last Contacted DateTime
            ["Last Called Time", oppSfDateTime("Last_Call__c") ?? oppSfDateTime("Last_Call_DateTime__c")],
            E("Last Contacted DateTime", oppSfDateTime("Last_Contacted_DateTime__c"), "lastContactedAt", "datetime", { rawValue: opp.lastContactedAt ?? null }),
            // Row 9: Last Emailed Time | Week Days Between Last Contacted Date
            ["Last Emailed Time", oppSfDateTime("Last_Email__c") ?? oppSfDateTime("Last_Email_DateTime__c")],
            ["Week Days Between Last Contacted Date", oppSf("Week_Days_Between_Last_Contacted_Date__c")],
            // Row 10: Last SMS Time | (right col exhausted)
            ["Last SMS Time", oppSfDateTime("Last_SMS__c") ?? oppSfDateTime("Last_SMS_DateTime__c")],
            ["", null],
          ]}
        />
      </Section>

      <Section title="Client Questionnaire">
        {/* SF Client Questionnaire — TwoColumnsLeftToRight. */}
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
            // Row 4: Lender Agreements Collected | COJ or TRO
            E("Lender Agreements Collected", oppSf("Lender_Agreements_Collected__c"), "lenderAgreementsCollected"),
            E("COJ or TRO", oppSf("COJ_or_TRO__c"), "cojOrTro"),
            // Row 5: Status with Lender/s | First Payment to Legal
            E("Status with Lender/s", oppSf("Status_with_Lenders__c") ?? oppSf("Status_with_Lender_s__c"), "statusWithLenders"),
            E("First Payment to Legal", oppSfBool("First_Payment_to_Legal__c"), "firstPaymentToLegal", "checkbox", { rawValue: opp.firstPaymentToLegal ?? null }),
            // Row 6: Summons or Judgment | Welcome Call Scheduled
            E("Summons or Judgment", oppSf("Summons_or_Judgment__c"), "summonsOrJudgment"),
            E("Welcome Call Scheduled", oppSfDateTime("Welcome_Call_Scheduled__c"), "welcomeCallScheduled", "datetime", { rawValue: opp.welcomeCallScheduled ?? null }),
          ]}
        />
      </Section>

      <ClientSubmittedInfoCard requests={infoRequests} />

      <RecordNotes
        notes={chainNotes.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))}
        attach={{ leadId: opp.lead?.id ?? null, opportunityId: opp.id, accountId: opp.account?.id ?? null }}
      />

      <Section title="Five9 Fields">
        {/* SF Five9 Fields section. */}
        <FieldGrid
          entityType="opportunity"
          entityId={opp.id}
          fields={[
            ["Add to Five9 List", oppSf("Add_to_f9list_Id__c")],
            ["Delete from Five9 List", oppSf("Delete_from_f9list_id__c")],
            ["Five9 List Id", oppSf("Five9_List_Id__c")],
            ["", null],
          ]}
        />
      </Section>

      {/* SF System Information section, useHeading=false: bare grid, no card.
          Created By / Last Modified By render as "Name, date, time" like SF. */}
      <FieldGrid
        entityType="opportunity"
        entityId={opp.id}
        fields={[
          // Row 1: Created By | Lead Created Date
          ["Created By", [createdByDisplay, oppSfDateTime("CreatedDate")].filter(Boolean).join(", ") || opp.createdAt.toLocaleString()],
          ["Lead Created Date", oppSfDateTime("Lead_Created_Date__c")],
          // Row 2: Close Date | Last Modified By
          E("Close Date", closeDateDisplay, "expectedCloseDate", "date", { rawValue: opp.expectedCloseDate ?? null }),
          ["Last Modified By", [lastModifiedByDisplay, oppSfDateTime("LastModifiedDate")].filter(Boolean).join(", ") || opp.updatedAt.toLocaleString()],
        ]}
      />
      {/* Description Information section, OneColumn, single Description field. */}
      <div style={{ padding: "8px 0", display: "grid", gridTemplateColumns: "16.5% 1fr 28px", gap: 8, alignItems: "start" }}>
        <div style={{ fontSize: 12, color: "#444444", paddingTop: 1 }}>Description</div>
        <div style={{ fontSize: 13, color: "#181818", whiteSpace: "pre-wrap" }}>
          {opp.notes ?? oppSf("Description") ?? ""}
        </div>
        <div />
      </div>
    </>
  );

  const activitiesPanel = (
    <Section title={`Activities (${activity.length})`}>
      <div style={{ fontSize: 12, color: "#747474", marginBottom: 8 }}>
        Includes calls, emails, SMS and tasks from both the Opportunity and originating Lead.
      </div>
      {activity.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "#747474" }}>No activity recorded.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fafaf9", borderBottom: "1px solid #c9c9c9" }}>
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
          analysis: (d.sourceDocument?.analysisJson as import("@/components/documents/analysis-body").ContractAnalysisData | null) ?? null,
          analysisDocName: d.sourceDocument?.name ?? null,
        }))}
      />
    </Section>
  );

  // Deal's real payment term (saved calc period -> SF Payment_Term__c -> 6).
  const reschedTermMonths =
    latestCalc?.programFeePeriod ||
    (oppSfData["Payment_Term__c"] != null && Number(oppSfData["Payment_Term__c"]) > 0
      ? Number(oppSfData["Payment_Term__c"])
      : 0) ||
    6;
  const reschedDebt = latestCalc?.totalDebt ?? totalDebtVal;
  // Server-side schedule so the right-rail Total Payments Summary matches the
  // calculator (and SF) to the cent for the deal's real inputs.
  const reschedSchedule = generateRescheduleSchedule({
    totalDebt: reschedDebt,
    termMonths: reschedTermMonths,
    citadelFee: latestCalc?.citadelFee ?? undefined,
  });
  const rRows = reschedSchedule.rows;
  const rSum = (fn: (r: (typeof rRows)[number]) => number) =>
    Math.round(rRows.reduce((s, r) => s + fn(r), 0) * 100) / 100;
  const rProgramCost = rSum((r) => r.weeklyDraftAmount);
  // SF programPlanModal formula: Estimated Weekly Saving = currentWeeklyPayment
  // − program weekly draft. Retainer is collected in a single upfront draft.
  const currentWeekly = opp.currentWeeklyPayment || totalWeekly;
  const summaryValues = {
    programLengthMonths: reschedTermMonths,
    retainerPaymentCount: rRows.filter((r) => r.retainerFee > 0).length,
    totalDebt: reschedDebt,
    totalProgramCost: rProgramCost,
    totalRetainerFee: reschedSchedule.totals.retainerAmount,
    totalProgramFee: reschedSchedule.totals.programFeeAmount,
    totalSetupFee: reschedSchedule.totals.setupFee,
    totalProcessorFee: rSum((r) => r.bankFee),
    totalServiceFee: rSum((r) => r.serviceFee),
    totalEscrowAmount: rSum((r) => r.escrowAmount),
    estimatedYouSave: Math.round((reschedDebt - rProgramCost) * 100) / 100,
    totalWeeklyPayment: reschedSchedule.totals.weeklyDraftAmount,
    totalWeeklySaving:
      currentWeekly > 0
        ? Math.round((currentWeekly - reschedSchedule.totals.weeklyDraftAmount) * 100) / 100
        : null,
  };

  const calcPanel = (
    <Section title="Payment Calculator">
      <RescheduleCalculator
        initial={{
          totalDebt: reschedDebt,
          termMonths: reschedTermMonths,
          noOfDebts: opp.debts.length,
          currentWeeklyPayment: opp.currentWeeklyPayment || totalWeekly,
          citadelFee: latestCalc?.citadelFee ?? undefined,
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
            <tr style={{ background: "#fafaf9", borderBottom: "1px solid #c9c9c9" }}>
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
        <div style={{ padding: 24, textAlign: "center", color: "#747474" }}>No settlements yet.</div>
      )}
    </Section>
  );

  const recommendedAgreement = resolveAgreement(opp.debts.map((d) => d.creditorName));

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
        recommendedAgreement={recommendedAgreement}
      />
      <Section title={`Files (${opp.documents.length})`}>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
          <RequestDocumentsButton
            opportunityId={opp.id}
            kind="INFO"
            defaultEmail={opp.oppEmail ?? opp.primaryContact?.email ?? opp.lead?.email ?? undefined}
            defaultName={opp.primaryContact?.fullName ?? opp.lead?.contactName ?? undefined}
          />
          <RequestDocumentsButton
            opportunityId={opp.id}
            defaultEmail={opp.oppEmail ?? opp.primaryContact?.email ?? opp.lead?.email ?? undefined}
            defaultName={opp.primaryContact?.fullName ?? opp.lead?.contactName ?? undefined}
          />
        </div>
        <DocumentsUpload
          endpoint={`/api/opportunities/${opp.id}/documents`}
          items={opp.documents.map((d) => ({
            id: d.id,
            name: d.name,
            type: d.type,
            fileSize: d.fileSize,
            createdAt: d.createdAt.toISOString(),
            uploadedBy: d.uploadedBy ? { name: d.uploadedBy.name } : null,
            hasAnalysis: d.analyzedAt != null,
          }))}
        />
      </Section>
      <RecordFiles entityType="Opportunity" entityId={opp.id} title="Library Files" />
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
            <Link href={`/program-plans/${p.id}`} style={{ color: "#0176d3" }}>
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

  const contactsPanel = opp.account ? (
    <ContactRolesList
      action={<AddContactButton accountId={opp.account.id} />}
      rows={opp.account.contacts.map((rel) => ({
        id: rel.id,
        role: rel.role,
        isPrimary: rel.contact.id === (opp.primaryContactId ?? opp.account?.primaryContactId),
        contact: {
          id: rel.contact.id,
          fullName: rel.contact.fullName,
          title: rel.contact.title,
          email: rel.contact.email,
          phone: rel.contact.phone,
        },
      }))}
    />
  ) : (
    <Section title="Contacts">
      <div style={{ padding: 16, fontSize: 13, color: "#747474" }}>
        No account is linked to this opportunity yet.
      </div>
    </Section>
  );

  const marketingPanel = (
    <Section title="Marketing Attribution">
      <FieldGrid
        fields={[
          ["Lead Source", opp.lead?.source],
          ["Originating Lead", opp.lead?.id ? (
            <Link href={`/leads/${opp.lead.id}`} style={{ color: "#0176d3" }}>
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
        recordSubtitle={undefined}
        highlights={[
          // SF Lightning highlights row (verified against the live record):
          // Account Name | Current Total Debt | Lead Id | Opportunity Owner | Version.
          { label: "Account Name", value: accountLink },
          { label: "Current Total Debt", value: `$${totalDebtVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
          { label: "Lead Id", value: sfLeadIdDisplay },
          { label: "Opportunity Owner", value: ownerDisplay },
          { label: "Version", value: String(opp.version ?? oppSf("Version__c") ?? "1.0") },
        ]}
        actions={<OppHeaderButtons opportunityId={opp.id} currentStage={opp.stage} forecastCategory={opp.forecastCategory ?? null} defaultEmail={emailDisplay ?? opp.lead?.email ?? null} defaultPhone={phoneDisplay ?? opp.lead?.phone ?? null} defaultSignerName={opp.lead?.contactName?.trim() || opp.primaryContact?.fullName?.trim() || null} recommendedAgreement={recommendedAgreement} />}
        pathStages={[
          ...OPP_PATH_OPEN_STAGES.map((st) => ({ label: st })),
          { label: opp.stage.startsWith("Closed") ? opp.stage : "Closed" },
        ]}
        pathCurrentIndex={
          opp.stage.startsWith("Closed")
            ? OPP_PATH_OPEN_STAGES.length
            : Math.max(0, OPP_PATH_OPEN_STAGES.indexOf(opp.stage as (typeof OPP_PATH_OPEN_STAGES)[number]))
        }
        pathDoneVariant="green"
        pathCurrentColor={opp.stage.startsWith("Closed Won") ? "#2e844a" : "#032d60"}
        details={
          <>
            <PathSidePanelServer
              entityType="Opportunity"
              stage={opp.stage}
              record={opp as unknown as Record<string, unknown>}
            />
            <OppTabs
              panels={{
                Details: detailsPanel,
                Activities: activitiesPanel,
                "Debt Information": debtPanel,
                Contacts: contactsPanel,
                "Payment Calculator": calcPanel,
                Settlements: settlementsPanel,
                Documents: documentsPanel,
                Related: relatedPanel,
                Marketing: marketingPanel,
                "All SF Fields": sfFieldsPanel,
              }}
            />
          </>
        }
        rail={
          <>
            {/* Rail order mirrors SF Kenya Palmer screenshot:
                Total Payments Summary → Reports → DocuSign Envelope Status →
                Contact Roles. Activity / Chatter sits below. */}
            <TotalPaymentsSummary
              programLengthMonths={summaryValues.programLengthMonths}
              retainerPaymentCount={summaryValues.retainerPaymentCount}
              totalDebt={summaryValues.totalDebt}
              totalProgramCost={summaryValues.totalProgramCost}
              totalRetainerFee={summaryValues.totalRetainerFee}
              totalProgramFee={summaryValues.totalProgramFee}
              totalSetupFee={summaryValues.totalSetupFee}
              totalProcessorFee={summaryValues.totalProcessorFee}
              totalServiceFee={summaryValues.totalServiceFee}
              totalEscrowAmount={summaryValues.totalEscrowAmount}
              estimatedYouSave={summaryValues.estimatedYouSave}
              totalWeeklyPayment={summaryValues.totalWeeklyPayment}
              totalWeeklySaving={summaryValues.totalWeeklySaving}
              // SF's Total Payments Summary is a related list that reads "No
              // Records Found" until payment records exist. Our equivalent
              // record is a saved calculator run, so gate on that.
              empty={!latestCalc || reschedDebt <= 0}
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
            <NotesRailCard
              notes={chainNotes.map((n) => ({ id: n.id, body: n.body, author: n.author, createdAt: n.createdAt.toISOString(), source: n.source }))}
              attach={{ leadId: opp.lead?.id ?? null, opportunityId: opp.id, accountId: opp.account?.id ?? null }}
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
        border: "1px solid #c9c9c9",
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
        <svg width="10" height="10" viewBox="0 0 10 10" style={{ fill: "#747474", transform: "rotate(90deg)" }}>
          <path d="M2 0l6 5-6 5z" />
        </svg>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#181818", margin: 0 }}>
          Contact Roles (1)
        </h3>
      </header>
      <div style={{ padding: "8px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}>
          <Link href={`/contacts/${primary.id}`} style={{ color: "#0176d3" }}>
            {primary.fullName}
          </Link>
          <span style={{ color: "#444444" }}>Primary</span>
        </div>
      </div>
      {accountId && (
        <div style={{ textAlign: "center", padding: "8px 12px", borderTop: "1px solid #ecebea" }}>
          <Link
            href={`/accounts/${accountId}`}
            style={{ color: "#0176d3", fontSize: 12 }}
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
  color: "#444444",
  textTransform: "uppercase",
  letterSpacing: 0.3,
};
const td: React.CSSProperties = {
  padding: "10px 12px",
  color: "#181818",
  fontSize: 13,
};
