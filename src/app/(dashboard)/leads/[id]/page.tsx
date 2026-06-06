import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecordPage, StatusPill } from "@/components/slds/record-page";
import { Section, FieldGrid } from "@/components/slds/section";
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
import { ConvertLeadButton } from "@/components/leads/convert-lead-button";
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
      meta: `${c.disposition ?? "—"} · ${c.agent.name}`,
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
        fields={[
          ["Name", displayContactName],
          ["Title", sf("Title")],
          ["Phone", <span key="ph" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{phoneVal ?? "—"}{phoneVal && <CallButton phone={phoneVal} leadId={lead.id} />}</span>],
          ["Mobile", mobileVal],
          ["Email", <span key="em" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{emailVal ?? "—"}{emailVal && <ComposeEmailButton defaultTo={emailVal} leadId={lead.id} label="Email" />}</span>],
          ["Salutation", sf("Salutation")],
          ["Lead Source", lead.source ?? sf("LeadSource")],
          ["Lead Source Category", sf("Lead_Source_Category__c")],
          ["Lead Vendor ID", sf("Lead_Vendor_ID__c")],
          ["Status", <StatusPill key="st" label={lead.status} tone={leadStatusTone(lead.status)} />],
          ["Sub-Disposition", sf("Sub_Disposition__c")],
          ["Last Disposition", lead.lastDisposition ?? sf("Last_Disposition__c")],
          ["Last Sub Disposition", lead.lastSubDisposition ?? sf("Last_Sub_Disposition__c")],
          ["Owner", ownerName],
          ["Owner Email", sf("Owner_Username__c")],
          ["Lead Assignment Date", lead.leadAssignmentDate?.toLocaleDateString() ?? sfDate("Lead_Assignment_Date__c")],
          ["Last Contacted", lead.lastContactedAt?.toLocaleDateString() ?? sfDate("Last_Contacted_DateTime__c")],
          ["Last Disposition Time", lead.lastDispositionAt?.toLocaleString() ?? sfDate("Last_Disposition_DateTime__c")],
          ["Days Since Last Contact", sf("Week_Days_Between_Last_Contacted_Date__c")],
          ["Next Follow-up", lead.nextFollowUpAt?.toLocaleDateString()],
          ["Call Counter", sf("Call_counter__c")],
          ["Hopper Priority", sf("Hopper_Priority__c")],
          ["DNC", yesNo(sf("DNC__c"))],
          ["Address", [sf("Street"), sf("City"), sf("State"), sf("PostalCode"), sf("Country")].filter(Boolean).join(", ") || null],
          ["Lead Id", displayLeadId],
          ["Disqualification Reason", sf("Reason_for_Disqualification__c")],
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
        fields={[
          ["Company", lead.businessName ?? sf("Company")],
          ["EIN Number / Tax ID", lead.ein ?? sf("EIN_Number_Tax_Id__c")],
          ["Industry", lead.industry ?? sf("Industry")],
          ["Annual Revenue", lead.annualRevenue ? `$${lead.annualRevenue.toLocaleString()}` : sfDollar("AnnualRevenue")],
          ["Monthly Revenue", sfDollar("Monthly_Revenue__c")],
          ["Number of MCAs", yesNo(sf("Has_Multiple_MCA_s__c"))],
          ["Business Start Date", sfDate("Business_Start_Date__c")],
        ]}
      />
    </Section>
  );

  const currentDebtInformation = (
    <Section title="Current Debt Information">
      <FieldGrid
        fields={[
          ["MCA Amount", sfDollar("MCA_Amount__c")],
          ["MCA Amount Requested", sfDollar("MCA_Amount_Requested__c")],
          ["Est. Total Debt", lead.totalDebtEst ? `$${lead.totalDebtEst.toLocaleString()}` : sfDollar("Estimated_Total_Debt__c") ?? sfDollar("Total_Debt_Amount__c")],
          ["Current Total Debt", sfDollar("Current_Total_Debt_Amount__c")],
          ["Current Total Monthly Payment", sfDollar("Current_Total_Monthly_Payment__c") ?? sfDollar("Current_Total_Monthly_Payment_Formula__c")],
          ["Current Total Weekly Payment", lead.currentTotalWeeklyPayment ? `$${lead.currentTotalWeeklyPayment.toLocaleString()}` : sfDollar("Current_Total_Weekly_Payment__c")],
          ["Current Total Daily Payment", sfDollar("Current_Total_Daily_Payment__c")],
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
          ["Program Fee %", sf("Program_Fee_Percentage__c")],
          ["Retainer %", sf("Retainer_Percentage__c")],
          ["Settlement %", sf("Settlement_Percentage__c")],
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
          ["Closer", sf("CloserLookup__c")],
          ["Call Transfer Status", sf("Call_Transfer_Status__c")],
          ["Call Received By", sf("Call_Received_By_Lookup__c")],
          ["Call Received Date", sfDate("Call_Received_Date__c")],
          ["Outbound Call From", sf("Outbound_ANI_From__c")],
          ["Reason for Disqualification", sf("Reason_for_Disqualification__c")],
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
        fields={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].flatMap((n) => [
          [`Creditor ${n} Debt`, sfDollar(`Creditor_${n}_Total_Debt__c`)],
          [`Creditor ${n} Payment`, sfDollar(`Creditor_${n}_Payment__c`)],
          [`Creditor ${n} Frequency`, sf(`Creditor_${n}_Payment_Frequency__c`)],
          [`Creditor ${n} Status`, sf(`Creditor_${n}_Debt_Status__c`)],
        ]).filter(([, v]) => v != null) as [string, string | null][]}
      />
    </Section>
  );

  const accountEngagement = (
    <Section title="Account Engagement" defaultOpen={false}>
      <FieldGrid
        fields={[
          ["First Form Submission", sfDate("Account_Engagement_First_Activity__c")],
          ["Last Form Submission", sfDate("Account_Engagement_Last_Activity__c")],
          ["Last Activity Date", sfDate("LastActivityDate")],
          ["Conversion Score", sf("Account_Engagement_Score__c")],
          ["Grade", sf("Account_Engagement_Grade__c")],
        ]}
      />
    </Section>
  );

  const details = (
    <>
      <ConvertLeadButton leadId={lead.id} converted={converted} />
      {leadInformation}
      {companyInformation}
      {currentDebtInformation}
      {debtCalculation}
      {callDisposition}
      {trustFunds}
      <Section title={`Debt Information (${lead.debts.length})`} defaultOpen={false}>
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
      {creditorInformation}
      {accountEngagement}
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

  const activitiesPanel = (
    <Section title={`Activities (${activity.length})`}>
      <div style={{ fontSize: 12, color: "#706e6b", marginBottom: 8 }}>
        All calls, emails, SMS, tasks, and events on this Lead.
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
          ["Ad Click ID", sf("Ad_Click_Id__c")],
          ["Ad ID", sf("Ad_Id__c")],
          ["Ad Set", sf("Ad_Set__c")],
          ["Hubspot ID", sf("Hubspot_Id__c")],
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
        { label: "Title", value: sf("Title") },
        { label: "Company", value: lead.businessName ?? sf("Company") },
        { label: "Phone", value: phoneVal },
        { label: "Email", value: emailVal },
        { label: "Mobile", value: mobileVal },
        { label: "Lead Id", value: displayLeadId },
      ]}
      actions={<LeadHeaderButtons leadId={lead.id} currentStage={stage} />}
      pathStages={LEAD_PATH}
      pathCurrentIndex={Math.max(0, leadPathIndex(lead.status))}
      pathActionLabel={converted ? "Converted" : "Mark Status as Complete"}
      details={
        <LeadTabs
          panels={{
            Details: details,
            Activities: activitiesPanel,
            "Lead Calculator": calc,
            Documents: documents,
            Related: related,
            Marketing: marketing,
            "All SF Fields": sfFields,
          }}
        />
      }
      rail={
        <>
          <LeadScoreCard score={lead.score} reason={lead.scoreReason} />
          <RelatedRecordsCard
            converted={converted}
            ownerName={ownerName}
            ownerEmail={lead.assignedTo?.email ?? sf("Owner_Username__c")}
          />
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

/**
 * SF Lightning Lead Score card — shown above Related Records when the lead
 * has been scored. Mirrors the Einstein Lead Scoring widget.
 */
function LeadScoreCard({ score, reason }: { score: number | null; reason: string | null }) {
  if (score == null) return null;
  const tone = score >= 70 ? "#04844b" : score >= 40 ? "#fe9339" : "#c23934";
  return (
    <article
      style={{
        background: "#fff",
        border: "1px solid #d8dde6",
        borderRadius: 4,
        padding: 12,
        marginBottom: 8,
      }}
    >
      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "#080707" }}>
        Lead Score
      </h3>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: tone,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {score}
        </div>
        <div style={{ fontSize: 12, color: "#3e3e3c", lineHeight: 1.4 }}>
          {reason ?? "Score out of 100."}
        </div>
      </div>
    </article>
  );
}

/**
 * Related Records — SF Lead rail card showing the Account/Contact/Opportunity
 * the lead converted into (if applicable) plus the Owner.
 */
function RelatedRecordsCard({
  converted,
  ownerName,
  ownerEmail,
}: {
  converted: { accountId: string; contactId: string; opportunityId: string | null } | undefined;
  ownerName: string | null;
  ownerEmail: string | null;
}) {
  return (
    <article
      style={{
        background: "#fff",
        border: "1px solid #d8dde6",
        borderRadius: 4,
        padding: 12,
        marginBottom: 8,
      }}
    >
      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "#080707" }}>
        Related Records
      </h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 12 }}>
        <li style={{ padding: "4px 0", display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span style={{ color: "#706e6b" }}>Owner</span>
          <span style={{ color: "#080707", fontWeight: 600, textAlign: "right" }}>
            {ownerName ?? <span style={{ color: "#b0adab" }}>—</span>}
            {ownerEmail && <div style={{ fontSize: 11, color: "#706e6b", fontWeight: 400 }}>{ownerEmail}</div>}
          </span>
        </li>
        {converted?.accountId && (
          <li style={{ padding: "4px 0", display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#706e6b" }}>Account</span>
            <Link href={`/accounts/${converted.accountId}`} style={{ color: "#0070d2" }}>
              View
            </Link>
          </li>
        )}
        {converted?.contactId && (
          <li style={{ padding: "4px 0", display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#706e6b" }}>Contact</span>
            <Link href={`/contacts/${converted.contactId}`} style={{ color: "#0070d2" }}>
              View
            </Link>
          </li>
        )}
        {converted?.opportunityId && (
          <li style={{ padding: "4px 0", display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#706e6b" }}>Opportunity</span>
            <Link href={`/opportunities/${converted.opportunityId}`} style={{ color: "#0070d2" }}>
              View
            </Link>
          </li>
        )}
      </ul>
    </article>
  );
}
