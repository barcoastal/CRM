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
import { opportunityStageTone, settlementStatusTone, genericTone } from "@/lib/slds/status-tones";
import { OPP_STAGES } from "@/lib/sf-canonical";

const PATH = OPP_STAGES.map((s) => ({ label: s }));

function oppPathIndex(stage: string): number {
  const i = (OPP_STAGES as readonly string[]).indexOf(stage);
  if (i >= 0) return i;
  const s = (stage ?? "").toUpperCase();
  if (s.includes("CLOSED") && s.includes("WON") && s.includes("COMPLETED")) return 7;
  if (s.includes("CLOSED") && s.includes("WON")) return 6;
  if (s.includes("ARCHIVED")) return 5;
  if (s.includes("CONTRACT") && s.includes("SENT")) return 4;
  if (s.includes("READY")) return 3;
  if (s.includes("AGREEMENT")) return 2;
  if (s.includes("WAITING")) return 1;
  return 0;
}

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opp = await prisma.opportunity.findUnique({
    where: { id },
    include: {
      lead: {
        select: {
          id: true,
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
          meta: `${c.disposition ?? "—"} · ${c.agent.name} (lead-era)`,
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

  const detailsPanel = (
    <>
      <Section title="Opportunity Information">
        <FieldGrid
          fields={[
            ["Opportunity Name", oppName],
            ["Account Name", opp.account?.name && (
              <Link href={`/accounts/${opp.account.id}`} style={{ color: "#1589ee" }}>{opp.account.name}</Link>
            )],
            ["Stage", <StatusPill key="s" label={opp.stage} tone={opportunityStageTone(opp.stage)} />],
            ["Lead Source", opp.lead?.source ?? null],
            ["Total Debt", `$${totalDebtVal.toLocaleString()}`],
            ["Expected Close Date", opp.expectedCloseDate?.toLocaleDateString()],
            ["Owner", opp.assignedTo?.name],
            ["Version", opp.version],
            ["Lead Id", opp.lead?.id ? opp.lead.id.slice(-8).toUpperCase() : null],
            ["Product", opp.recordType.replace(/_/g, " ")],
            ["Primary Contact", opp.primaryContact?.fullName],
            ["Created", opp.createdAt.toLocaleString()],
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
                  <td style={td}>{a.meta ?? "—"}</td>
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
            <div style={{ color: "#706e6b" }}>{h.oldValue ?? "—"}</div>
            <div>{h.newValue ?? "—"}</div>
          </div>
        )}
      />
    </>
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

  return (
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
        { label: "Account Name", value: opp.account?.name ? <Link href={`/accounts/${opp.account.id}`} style={{ color: "#1589ee" }}>{opp.account.name}</Link> : null },
        { label: "Current Total Debt", value: `$${totalDebtVal.toLocaleString()}` },
        { label: "Lead Id", value: opp.lead?.id ? opp.lead.id.slice(-8).toUpperCase() : null },
        { label: "Opportunity Owner", value: opp.assignedTo?.name },
        { label: "Version", value: opp.version },
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
          }}
        />
      }
      rail={
        <>
          <TotalPaymentsSummary
            programLength={latestCalc?.programFeePeriod ?? null}
            totalDebt={totalDebtVal}
            totalProgramCost={latestCalc?.estimatedAmount ?? null}
            totalProgramFee={
              latestCalc?.programFeePercent && totalDebtVal
                ? Math.round(totalDebtVal * (latestCalc.programFeePercent / 100) * 100) / 100
                : null
            }
            totalSetupFee={latestCalc?.setupFee ?? null}
            totalBankFee={
              latestCalc?.monthlyBankFee && latestCalc?.programFeePeriod
                ? Math.round(latestCalc.monthlyBankFee * latestCalc.programFeePeriod * 100) / 100
                : null
            }
            totalServiceFee={latestCalc?.serviceFee ?? null}
            totalSettlement={latestCalc?.totalSettlement ?? null}
            totalWeeklyPayment={totalWeekly}
          />
          <ActivityChatterRail activities={activity} chatter={chatter} />
        </>
      }
    />
  );
}

function TotalPaymentsSummary(props: {
  programLength: number | null;
  totalDebt: number;
  totalProgramCost: number | null;
  totalProgramFee: number | null;
  totalSetupFee: number | null;
  totalBankFee: number | null;
  totalServiceFee: number | null;
  totalSettlement: number | null;
  totalWeeklyPayment: number;
}) {
  const rows: [string, string | null][] = [
    ["Program Length", props.programLength ? `${props.programLength} mo` : null],
    ["Total Debt", `$${props.totalDebt.toLocaleString()}`],
    ["Total Program Cost", money(props.totalProgramCost)],
    ["Total Program Fee", money(props.totalProgramFee)],
    ["Total Setup Fee", money(props.totalSetupFee)],
    ["Total Bank Fee", money(props.totalBankFee)],
    ["Total Service Fee", money(props.totalServiceFee)],
    ["Total Settlement", money(props.totalSettlement)],
    ["Total Weekly Payment", money(props.totalWeeklyPayment)],
  ];
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
        Total Payments Summary
      </h3>
      <table style={{ width: "100%", fontSize: 12 }}>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} style={{ borderBottom: "1px solid #f3f3f3" }}>
              <td style={{ padding: "6px 0", color: "#706e6b" }}>{label}</td>
              <td style={{ padding: "6px 0", textAlign: "right", fontWeight: 600 }}>{value ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

function money(n: number | null): string | null {
  if (n == null) return null;
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
