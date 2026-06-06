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

  const details = (
    <>
      <ConvertLeadButton leadId={lead.id} converted={converted} />
      <Section title="Lead Information">
        <FieldGrid
          fields={[
            ["Business Name", lead.businessName ?? sf("Company")],
            ["Contact Name", lead.contactName === "Unknown" ? `${sf("FirstName") ?? ""} ${sf("LastName") ?? ""}`.trim() || "Unknown" : lead.contactName],
            ["Salutation", sf("Salutation")],
            ["Title", sf("Title")],
            ["Phone", <span key="ph" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{lead.phone ?? sf("Phone")}<CallButton phone={lead.phone ?? sf("Phone") ?? ""} leadId={lead.id} /></span>],
            ["Mobile Phone", sf("MobilePhone")],
            ["Email", <span key="em" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{lead.email ?? sf("Email")}{(lead.email ?? sf("Email")) && <ComposeEmailButton defaultTo={(lead.email ?? sf("Email"))!} leadId={lead.id} label="Email" />}</span>],
            ["EIN", lead.ein ?? sf("EIN_Number_Tax_Id__c")],
            ["Industry", lead.industry ?? sf("Industry")],
            ["Annual Revenue", lead.annualRevenue ? `$${lead.annualRevenue.toLocaleString()}` : sfDollar("AnnualRevenue")],
            ["Monthly Revenue", sfDollar("Monthly_Revenue__c")],
            ["Est. Total Debt", lead.totalDebtEst ? `$${lead.totalDebtEst.toLocaleString()}` : sfDollar("Estimated_Total_Debt__c") ?? sfDollar("Total_Debt_Amount__c")],
            ["Current Total Debt", sfDollar("Current_Total_Debt_Amount__c")],
            ["Current Monthly Payment", sfDollar("Current_Total_Monthly_Payment__c") ?? sfDollar("Current_Total_Monthly_Payment_Formula__c")],
            ["Current Weekly Payment", lead.currentTotalWeeklyPayment ? `$${lead.currentTotalWeeklyPayment.toLocaleString()}` : sfDollar("Current_Total_Weekly_Payment__c")],
            ["Current Daily Payment", sfDollar("Current_Total_Daily_Payment__c")],
            ["MCA Amount", sfDollar("MCA_Amount__c")],
            ["MCA Amount Requested", sfDollar("MCA_Amount_Requested__c")],
            ["Number of MCAs", sf("Has_Multiple_MCA_s__c")],
            ["Lead Source", lead.source ?? sf("LeadSource")],
            ["Lead Source Category", sf("Lead_Source_Category__c")],
            ["Lead Vendor ID", sf("Lead_Vendor_ID__c")],
            ["Status", <StatusPill key="s" label={lead.status} tone={leadStatusTone(lead.status)} />],
            ["Sub-Disposition", sf("Sub_Disposition__c")],
            ["Last Disposition", lead.lastDisposition ?? sf("Last_Disposition__c")],
            ["Last Sub Disposition", lead.lastSubDisposition ?? sf("Last_Sub_Disposition__c")],
            ["Disqualification Reason", sf("Reason_for_Disqualification__c")],
            ["Owner", lead.assignedTo?.name ?? sf("Owner_Full_Name__c")],
            ["Owner Email", sf("Owner_Username__c")],
            ["Lead Assignment Date", lead.leadAssignmentDate?.toLocaleDateString() ?? sfDate("Lead_Assignment_Date__c")],
            ["Last Contacted", lead.lastContactedAt?.toLocaleDateString() ?? sfDate("Last_Contacted_DateTime__c")],
            ["Last Disposition Time", lead.lastDispositionAt?.toLocaleString() ?? sfDate("Last_Disposition_DateTime__c")],
            ["Days Since Last Contact", sf("Week_Days_Between_Last_Contacted_Date__c")],
            ["Next Follow-up", lead.nextFollowUpAt?.toLocaleDateString()],
            ["Score", lead.score ? `${lead.score}/100` : null],
            ["Call Counter", sf("Call_counter__c")],
            ["Hopper Priority", sf("Hopper_Priority__c")],
            ["DNC", sf("DNC__c")],
            ["Address", [sf("Street"), sf("City"), sf("State"), sf("PostalCode"), sf("Country")].filter(Boolean).join(", ") || null],
          ]}
        />
        {lead.scoreReason && (
          <div style={{ marginTop: 12, fontSize: 12, color: "#706e6b" }}>
            <strong>Score reason:</strong> {lead.scoreReason}
          </div>
        )}
      </Section>
      <Section title="Marketing & Attribution" defaultOpen={false}>
        <FieldGrid
          fields={[
            ["Ad Click ID", sf("Ad_Click_Id__c")],
            ["Ad ID", sf("Ad_Id__c")],
            ["Ad Set", sf("Ad_Set__c")],
            ["Eli Ad Click", sf("Eli_Ad_click__c")],
            ["UTM Source", lead.utmSource],
            ["UTM Medium", lead.utmMedium],
            ["UTM Campaign", lead.utmCampaign],
            ["GCLID", lead.gclid],
            ["FBCLID", lead.fbclid],
            ["Hubspot ID", sf("Hubspot_Id__c")],
            ["Five9 Disposition", sf("five9_Disposition__c")],
            ["Five9 Last Disposition", sf("five9_Last_Disposition__c")],
            ["Outbound ANI", sf("Outbound_ANI_From__c")],
            ["Outbound ANI Date", sfDate("Outbound_ANI_Date__c")],
          ]}
        />
      </Section>
      <Section title="Program Setup" defaultOpen={false}>
        <FieldGrid
          fields={[
            ["Payment Term", sf("Payment_Term__c")],
            ["Payment Amount", sfDollar("Payment_Amount__c")],
            ["Program Fee %", sf("Program_Fee_Percentage__c")],
            ["Retainer %", sf("Retainer_Percentage__c")],
            ["Settlement %", sf("Settlement_Percentage__c")],
            ["Setup Fee", sfDollar("Setup_Fee__c")],
            ["Down Payment", sfDollar("Down_Payment__c")],
            ["Frequency", sf("Frequency__c")],
            ["Monthly Bank Fee", sfDollar("Monthly_Bank_Fee__c")],
            ["SSN", sf("SSN__c")],
            ["Lenders", sf("Lenders__c")],
            ["Product Interest", sf("ProductInterest__c")],
          ]}
        />
      </Section>
      <Section title="Creditor Details" defaultOpen={false}>
        <FieldGrid
          fields={[1,2,3,4,5,6,7,8,9,10].flatMap((n) => [
            [`Creditor ${n} Debt`, sfDollar(`Creditor_${n}_Total_Debt__c`)],
            [`Creditor ${n} Payment`, sfDollar(`Creditor_${n}_Payment__c`)],
            [`Creditor ${n} Frequency`, sf(`Creditor_${n}_Payment_Frequency__c`)],
            [`Creditor ${n} Status`, sf(`Creditor_${n}_Debt_Status__c`)],
          ]).filter(([, v]) => v != null) as [string, string | null][]}
        />
      </Section>
      {lead.notes && (
        <Section title="Notes" defaultOpen={false}>
          <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{lead.notes}</div>
        </Section>
      )}
    </>
  );

  const debtInfo = (
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
  );

  const calc = (
    <Section title="Payment Calculator">
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
        ]}
      />
    </Section>
  );

  return (
    <RecordPage
      entity="Lead"
      entityLabel="Lead"
      recordTitle={lead.contactName || lead.businessName}
      recordSubtitle={
        <>
          {lead.recordType.replace(/_/g, " ")} ·{" "}
          <StatusPill label={lead.status} tone={leadStatusTone(lead.status)} />
        </>
      }
      highlights={[
        { label: "Title", value: null },
        { label: "Company", value: lead.businessName },
        { label: "Phone (2)", value: lead.phone },
        { label: "Email", value: lead.email },
        { label: "Lead Id", value: lead.id.slice(-8).toUpperCase() },
      ]}
      actions={<LeadHeaderButtons leadId={lead.id} currentStage={stage} />}
      pathStages={LEAD_PATH}
      pathCurrentIndex={Math.max(0, leadPathIndex(lead.status))}
      pathActionLabel={converted ? "Converted" : "Mark Status as Complete"}
      details={
        <LeadTabs
          panels={{
            Details: details,
            "Debt Information": debtInfo,
            "Payment Calculator": calc,
            Documents: documents,
            Related: related,
            Marketing: marketing,
            "All SF Fields": sfFields,
          }}
        />
      }
      rail={
        <>
          <LeadHealthCheckCard
            status={lead.status}
            businessName={lead.businessName}
            contactName={lead.contactName}
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

