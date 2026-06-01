import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ObjectHeader } from "@/components/slds/object-header";
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
      tasks: { where: { status: { not: "COMPLETED" } }, orderBy: { dueDate: "asc" }, take: 10 },
      events: { orderBy: { startAt: "desc" }, take: 10 },
    },
  });
  if (!account) notFound();

  const isClient = account.recordType === "CLIENT" || account.recordType === "BUSINESS_ACCOUNT" || account.recordType === "PERSON_ACCOUNT";
  const isCreditor = account.recordType === "CREDITOR";

  return (
    <div>
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
            <SldsButton variant="neutral">Edit</SldsButton>
            <SldsButton variant="neutral">New Case</SldsButton>
            <SldsButton variant="neutral">More</SldsButton>
          </>
        }
      />

      {/* 2-col layout: details + related rail */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)", gap: 12 }}>
        <div>
          {/* Details card */}
          <div
            style={{
              background: "#fff", border: "1px solid #d8dde6", borderRadius: 4, padding: 16,
              marginBottom: 12,
            }}
          >
            <SectionHeader title="Account Information" />
            <FieldGrid
              fields={[
                ["Account Name", account.name],
                ["Type", RECORD_TYPE_LABEL[account.recordType] ?? account.recordType],
                ["Phone", account.phone],
                ["Email", account.email],
                ["Website", account.website && (
                  <a href={account.website} target="_blank" rel="noreferrer" style={{ color: "#1589ee" }}>
                    {account.website}
                  </a>
                )],
                ["Industry", account.industry],
                ["EIN", account.ein],
                ["Annual Revenue", account.annualRevenue ? `$${account.annualRevenue.toLocaleString()}` : null],
                ["Employees", account.numberOfEmployees],
                ["Owner", account.owner?.name],
              ]}
            />
            {(account.billingStreet || account.billingCity) && (
              <>
                <SectionHeader title="Address Information" style={{ marginTop: 16 }} />
                <FieldGrid
                  fields={[
                    ["Billing Street", account.billingStreet],
                    ["Billing City", account.billingCity],
                    ["Billing State", account.billingState],
                    ["Billing Zip", account.billingZip],
                    ["Billing Country", account.billingCountry],
                  ]}
                />
              </>
            )}
            {account.description && (
              <>
                <SectionHeader title="Description" style={{ marginTop: 16 }} />
                <div style={{ fontSize: 13, color: "#080707", whiteSpace: "pre-wrap" }}>
                  {account.description}
                </div>
              </>
            )}
          </div>

          {isCreditor && account.creditor && (
            <div style={{ background: "#fff", border: "1px solid #d8dde6", borderRadius: 4, padding: 16, marginBottom: 12 }}>
              <SectionHeader title="Creditor Details" />
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
                <>
                  <SectionHeader title="Settlement Policy" style={{ marginTop: 16 }} />
                  <div style={{ fontSize: 13, color: "#080707" }}>{account.creditor.settlementPolicy}</div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right rail */}
        <div>
          {isClient && (
            <RelatedList
              entity="ProgramPlan"
              title="Program Plans"
              items={account.programPlans}
              renderItem={(p) => (
                <Link href={`/program-plans/${p.id}`} style={{ color: "#1589ee", textDecoration: "none" }}>
                  {p.recordType.replace(/_/g, " ")} — {p.status}
                </Link>
              )}
              emptyHint="No program plans yet."
            />
          )}

          <RelatedList
            entity="Contact"
            title="Contacts"
            items={account.contacts.map((r) => r.contact)}
            renderItem={(c) => (
              <div>
                <Link href={`/contacts/${c.id}`} style={{ color: "#1589ee", fontWeight: 600, textDecoration: "none" }}>
                  {c.fullName}
                </Link>
                {c.title && <div style={{ color: "#706e6b", fontSize: 12 }}>{c.title}</div>}
              </div>
            )}
            emptyHint="No contacts linked yet."
            newHref={`/contacts/new?accountId=${account.id}`}
          />

          {isClient && (
            <RelatedList
              entity="Opportunity"
              title="Opportunities"
              items={account.opportunities}
              renderItem={(o) => (
                <div>
                  <Link href={`/opportunities/${o.id}`} style={{ color: "#1589ee", fontWeight: 600, textDecoration: "none" }}>
                    {o.recordType.replace(/_/g, " ")}
                  </Link>
                  <div style={{ color: "#706e6b", fontSize: 12 }}>
                    {o.stage} {o.totalDebt && `· $${o.totalDebt.toLocaleString()}`}
                  </div>
                </div>
              )}
              emptyHint="No opportunities yet."
            />
          )}

          <RelatedList
            entity="Case"
            title="Cases"
            items={account.cases}
            renderItem={(c) => (
              <div>
                <Link href={`/cases/${c.id}`} style={{ color: "#1589ee", fontWeight: 600, textDecoration: "none" }}>
                  {c.caseNumber}
                </Link>
                <div style={{ color: "#706e6b", fontSize: 12 }}>{c.subject}</div>
                <div style={{ color: "#706e6b", fontSize: 11 }}>{c.status} · {c.priority}</div>
              </div>
            )}
            emptyHint="No cases."
          />

          <RelatedList
            entity="Task"
            title="Open Tasks"
            items={account.tasks}
            renderItem={(t) => (
              <div>
                <div style={{ color: "#080707", fontWeight: 600 }}>{t.subject}</div>
                {t.dueDate && (
                  <div style={{ color: "#706e6b", fontSize: 12 }}>
                    Due {t.dueDate.toLocaleDateString()}
                  </div>
                )}
              </div>
            )}
            emptyHint="No open tasks."
          />

          <RelatedList
            entity="Event"
            title="Events"
            items={account.events}
            renderItem={(e) => (
              <div>
                <div style={{ color: "#080707", fontWeight: 600 }}>{e.subject}</div>
                <div style={{ color: "#706e6b", fontSize: 12 }}>
                  {e.startAt.toLocaleString()}
                </div>
              </div>
            )}
            emptyHint="No events."
          />

          {account.childAccounts.length > 0 && (
            <RelatedList
              entity="Account"
              title="Sub-Accounts"
              items={account.childAccounts}
              renderItem={(c) => (
                <Link href={`/accounts/${c.id}`} style={{ color: "#1589ee", textDecoration: "none" }}>
                  {c.name}
                </Link>
              )}
              emptyHint=""
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ============ Tiny helpers (kept local to avoid coupling) ============

function SectionHeader({ title, style }: { title: string; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        fontSize: 11,
        color: "#080707",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 0.4,
        background: "#fafaf9",
        padding: "6px 10px",
        margin: "-16px -16px 12px",
        borderTop: "1px solid #ecebea",
        borderBottom: "1px solid #ecebea",
        ...style,
      }}
    >
      {title}
    </div>
  );
}

function FieldGrid({ fields }: { fields: ([string, React.ReactNode][]) }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
      {fields.map(([label, value]) => (
        <div key={label}>
          <div style={{ fontSize: 11, color: "#706e6b", fontWeight: 400 }}>{label}</div>
          <div style={{ fontSize: 13, color: "#080707", marginTop: 2 }}>
            {value ?? <span style={{ color: "#b0adab" }}>—</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function SldsButton({
  children,
  variant = "neutral",
  href,
}: {
  children: React.ReactNode;
  variant?: "neutral" | "brand" | "destructive";
  href?: string;
}) {
  const styles: React.CSSProperties = {
    fontSize: 13,
    padding: "5px 14px",
    borderRadius: 4,
    border: variant === "neutral" ? "1px solid #d8dde6" : "1px solid transparent",
    background: variant === "brand" ? "#1589ee" : variant === "destructive" ? "#c23934" : "#fff",
    color: variant === "neutral" ? "#080707" : "#fff",
    fontWeight: 400,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-block",
  };
  if (href) return <a href={href} style={styles}>{children}</a>;
  return <button style={styles}>{children}</button>;
}
