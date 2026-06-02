import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ObjectHeader } from "@/components/slds/object-header";
import { Section, FieldGrid } from "@/components/slds/section";
import { ActivityRail, type ActivityItem } from "@/components/slds/activity-rail";
import { RelatedList } from "@/components/slds/related-list";

const RECORD_TYPE_LABEL: Record<string, string> = {
  CLIENT: "Client", CREDITOR: "Creditor", VENDOR: "Vendor",
  BUSINESS_ACCOUNT: "Business", PERSON_ACCOUNT: "Person", BUYOUT: "Buyout", OTHER: "Other",
};

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      contacts: { include: { contact: true }, orderBy: { createdAt: "asc" } },
      opportunities: { orderBy: { createdAt: "desc" } },
      creditor: { include: { _count: { select: { debts: true } } } },
      parentAccount: { select: { id: true, name: true } },
      childAccounts: { select: { id: true, name: true, recordType: true } },
      programPlans: { orderBy: { startDate: "desc" } },
      cases: { orderBy: { createdAt: "desc" }, take: 10 },
      tasks: { orderBy: { dueDate: "asc" }, take: 50 },
      events: { orderBy: { startAt: "desc" }, take: 50 },
      emails: { orderBy: { createdAt: "desc" }, take: 20 },
      sms: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!account) notFound();

  const isClient = account.recordType === "CLIENT" || account.recordType === "BUSINESS_ACCOUNT" || account.recordType === "PERSON_ACCOUNT";
  const isCreditor = account.recordType === "CREDITOR";

  // Compile activity feed from tasks + events + emails + sms
  const activity: ActivityItem[] = [
    ...account.tasks.map((t) => ({
      id: t.id,
      type: (t.type === "EMAIL" ? "EMAIL" : t.type === "CALL" ? "CALL" : "TASK") as ActivityItem["type"],
      subject: t.subject,
      meta: t.outcome ?? t.disposition ?? null,
      date: t.dueDate ?? t.completedAt ?? t.createdAt,
      done: t.status === "COMPLETED",
    })),
    ...account.events.map((e) => ({
      id: e.id, type: "EVENT" as const, subject: e.subject,
      meta: e.location ?? null, date: e.startAt, done: e.status === "COMPLETED",
    })),
    ...account.emails.map((m) => ({
      id: m.id, type: "EMAIL" as const, subject: m.subject,
      meta: `${m.direction === "OUTBOUND" ? "Sent to" : "From"} ${m.toAddresses}`,
      date: m.sentAt ?? m.createdAt, done: m.status === "DELIVERED" || m.status === "OPENED",
    })),
    ...account.sms.map((m) => ({
      id: m.id, type: "SMS" as const, subject: m.body.slice(0, 80),
      meta: `${m.direction === "OUTBOUND" ? "→" : "←"} ${m.toNumber}`,
      date: m.sentAt ?? m.createdAt, done: m.status === "DELIVERED",
    })),
  ];

  return (
    <div>
      {/* Object header: entity icon + label + record name + highlights + actions */}
      <ObjectHeader
        entity={isCreditor ? "Creditor" : "Account"}
        entityLabel="Account"
        recordTitle={account.name}
        recordSubtitle={
          account.parentAccount ? (
            <>
              Parent:{" "}
              <Link href={`/accounts/${account.parentAccount.id}`} style={{ color: "#1589ee" }}>
                {account.parentAccount.name}
              </Link>
            </>
          ) : (
            RECORD_TYPE_LABEL[account.recordType] ?? account.recordType
          )
        }
        highlights={[
          { label: "Type", value: RECORD_TYPE_LABEL[account.recordType] ?? account.recordType },
          { label: "Phone", value: account.phone },
          { label: "Industry", value: account.industry },
          { label: "Account Owner", value: account.owner?.name },
          { label: "Annual Revenue", value: account.annualRevenue ? `$${account.annualRevenue.toLocaleString()}` : null },
        ]}
        actions={
          <>
            <button className="slds-button slds-button_neutral">+ Follow</button>
            <button className="slds-button slds-button_neutral">Edit</button>
            <button className="slds-button slds-button_neutral">New Case</button>
            <button className="slds-button slds-button_icon slds-button_icon-border-filled" title="More">
              <svg width="14" height="14" viewBox="0 0 14 14" style={{ fill: "#080707" }}>
                <circle cx="2" cy="7" r="1.5" /><circle cx="7" cy="7" r="1.5" /><circle cx="12" cy="7" r="1.5" />
              </svg>
            </button>
          </>
        }
      />

      {/* 2-col body: details (left) + activity rail (right) */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(320px, 1fr)", gap: 12, marginTop: 8 }}>
        <div>
          <Section title="Account Information">
            <FieldGrid
              fields={[
                ["Account Name", account.name],
                ["Type", RECORD_TYPE_LABEL[account.recordType] ?? account.recordType],
                ["Phone", account.phone],
                ["Email", account.email],
                ["Website", account.website && (
                  <a href={account.website} target="_blank" rel="noreferrer" style={{ color: "#1589ee" }}>{account.website}</a>
                )],
                ["Industry", account.industry],
                ["EIN", account.ein],
                ["Annual Revenue", account.annualRevenue ? `$${account.annualRevenue.toLocaleString()}` : null],
                ["Employees", account.numberOfEmployees],
                ["Owner", account.owner?.name],
              ]}
            />
          </Section>

          {(account.billingStreet || account.billingCity) && (
            <Section title="Address Information">
              <FieldGrid
                fields={[
                  ["Billing Street", account.billingStreet],
                  ["Billing City", account.billingCity],
                  ["Billing State", account.billingState],
                  ["Billing Zip", account.billingZip],
                  ["Billing Country", account.billingCountry],
                ]}
              />
            </Section>
          )}

          {account.description && (
            <Section title="Description">
              <div style={{ fontSize: 13, color: "#080707", whiteSpace: "pre-wrap" }}>
                {account.description}
              </div>
            </Section>
          )}

          {isCreditor && account.creditor && (
            <Section title="Creditor Details">
              <FieldGrid
                fields={[
                  ["Legal Name", account.creditor.legalName],
                  ["Collections Phone", account.creditor.collectionsPhone],
                  ["Collections Email", account.creditor.collectionsEmail],
                  ["Debts Handled", account.creditor._count?.debts ?? 0],
                  ["Avg Accepted %", account.creditor.averageAcceptedPercent ? `${(account.creditor.averageAcceptedPercent * 100).toFixed(0)}%` : null],
                ]}
              />
              {account.creditor.settlementPolicy && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, color: "#706e6b", fontWeight: 400, marginBottom: 4 }}>Settlement Policy</div>
                  <div style={{ fontSize: 13, color: "#080707" }}>{account.creditor.settlementPolicy}</div>
                </div>
              )}
            </Section>
          )}

          {/* Related lists below details (Account doesn't get them in the rail) */}
          {isClient && account.programPlans.length > 0 && (
            <Section title={`Program Plans (${account.programPlans.length})`}>
              <table style={{ width: "100%", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #ecebea" }}>
                    <th style={th}>Product</th>
                    <th style={th}>Status</th>
                    <th style={{ ...th, textAlign: "right" }}>Monthly</th>
                    <th style={{ ...th, textAlign: "right" }}>Term</th>
                    <th style={{ ...th, textAlign: "right" }}>Total Debt</th>
                  </tr>
                </thead>
                <tbody>
                  {account.programPlans.map((p) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                      <td style={td}>
                        <Link href={`/program-plans/${p.id}`} style={{ color: "#1589ee" }}>
                          {p.recordType.replace(/_/g, " ")}
                        </Link>
                      </td>
                      <td style={td}>{p.status}</td>
                      <td style={{ ...td, textAlign: "right" }}>${p.monthlyAmount.toLocaleString()}</td>
                      <td style={{ ...td, textAlign: "right" }}>{p.termMonths}mo</td>
                      <td style={{ ...td, textAlign: "right" }}>${p.totalEnrolledDebt?.toLocaleString() ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {isClient && account.opportunities.length > 0 && (
            <Section title={`Opportunities (${account.opportunities.length})`}>
              <table style={{ width: "100%", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #ecebea" }}>
                    <th style={th}>Product</th>
                    <th style={th}>Stage</th>
                    <th style={{ ...th, textAlign: "right" }}>Total Debt</th>
                  </tr>
                </thead>
                <tbody>
                  {account.opportunities.map((o) => (
                    <tr key={o.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                      <td style={td}>
                        <Link href={`/opportunities/${o.id}`} style={{ color: "#1589ee" }}>
                          {o.recordType.replace(/_/g, " ")}
                        </Link>
                      </td>
                      <td style={td}>{o.stage}</td>
                      <td style={{ ...td, textAlign: "right" }}>${o.totalDebt?.toLocaleString() ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}
        </div>

        {/* Right rail */}
        <div>
          <RelatedList
            entity="Contact"
            title="Contacts"
            items={account.contacts.map((r) => r.contact)}
            renderItem={(c) => (
              <div>
                <Link href={`/contacts/${c.id}`} style={{ color: "#1589ee", fontWeight: 600 }}>
                  {c.fullName}
                </Link>
                {c.title && <div style={{ color: "#706e6b", fontSize: 12 }}>{c.title}</div>}
              </div>
            )}
            emptyHint="No contacts."
            newHref={`/contacts/new?accountId=${account.id}`}
          />
          <RelatedList
            entity="Case"
            title="Cases"
            items={account.cases}
            renderItem={(c) => (
              <div>
                <Link href={`/cases/${c.id}`} style={{ color: "#1589ee", fontWeight: 600 }}>
                  {c.caseNumber}
                </Link>
                <div style={{ color: "#706e6b", fontSize: 12 }}>{c.subject}</div>
              </div>
            )}
            emptyHint="No cases."
          />
          <ActivityRail items={activity} />
        </div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 4px",
  fontSize: 11,
  color: "#3e3e3c",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};
const td: React.CSSProperties = { padding: "8px 4px", verticalAlign: "middle" };
