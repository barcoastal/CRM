import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Phone, Globe, MapPin } from "lucide-react";

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
    },
  });
  if (!account) notFound();

  const isClient = account.recordType === "CLIENT" || account.recordType === "BUSINESS_ACCOUNT" || account.recordType === "PERSON_ACCOUNT";
  const isCreditor = account.recordType === "CREDITOR";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[12px] text-zinc-500 mb-1">
            <Link href="/accounts" className="hover:underline">Accounts</Link> / {RECORD_TYPE_LABEL[account.recordType]}
          </div>
          <h1 className="text-[1.75rem] font-bold tracking-tight" style={{ color: "#131b2e" }}>
            {account.name}
          </h1>
          {account.parentAccount && (
            <div className="text-[13px] text-zinc-600 mt-1">
              Parent: <Link href={`/accounts/${account.parentAccount.id}`} className="text-[#0034e4] hover:underline">{account.parentAccount.name}</Link>
            </div>
          )}
        </div>
      </div>

      {/* Detail grid */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          {/* Contact info */}
          <section className="bg-white rounded-lg border border-zinc-200 p-5">
            <h2 className="font-semibold text-[14px] text-zinc-700 mb-3">Contact info</h2>
            <dl className="grid grid-cols-2 gap-3 text-[13px]">
              {account.phone && (
                <div className="flex items-center gap-2"><Phone className="size-4 text-zinc-400" /><span>{account.phone}</span></div>
              )}
              {account.email && (
                <div className="flex items-center gap-2"><Mail className="size-4 text-zinc-400" /><span>{account.email}</span></div>
              )}
              {account.website && (
                <div className="flex items-center gap-2"><Globe className="size-4 text-zinc-400" /><a href={account.website} target="_blank" rel="noreferrer" className="text-[#0034e4] hover:underline">{account.website}</a></div>
              )}
              {account.industry && <div><span className="text-zinc-500">Industry: </span>{account.industry}</div>}
              {account.ein && <div><span className="text-zinc-500">EIN: </span>{account.ein}</div>}
              {account.annualRevenue && <div><span className="text-zinc-500">Annual Revenue: </span>${account.annualRevenue.toLocaleString()}</div>}
              {(account.billingCity || account.billingState) && (
                <div className="col-span-2 flex items-center gap-2"><MapPin className="size-4 text-zinc-400" /><span>{[account.billingStreet, account.billingCity, account.billingState, account.billingZip].filter(Boolean).join(", ")}</span></div>
              )}
            </dl>
            {account.description && (
              <>
                <h3 className="font-semibold text-[13px] text-zinc-700 mt-4 mb-1.5">Description</h3>
                <p className="text-[13px] text-zinc-600 whitespace-pre-wrap">{account.description}</p>
              </>
            )}
          </section>

          {/* Contacts */}
          <section className="bg-white rounded-lg border border-zinc-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-[14px] text-zinc-700">People ({account.contacts.length})</h2>
            </div>
            {account.contacts.length === 0 ? (
              <p className="text-[13px] text-zinc-500">No contacts linked yet.</p>
            ) : (
              <table className="w-full text-[13px]">
                <thead className="border-b border-zinc-200">
                  <tr>
                    <th className="text-left py-2 font-semibold text-zinc-600">Name</th>
                    <th className="text-left py-2 font-semibold text-zinc-600">Role</th>
                    <th className="text-left py-2 font-semibold text-zinc-600">Email</th>
                    <th className="text-left py-2 font-semibold text-zinc-600">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {account.contacts.map((rel) => (
                    <tr key={rel.id} className="border-b border-zinc-100">
                      <td className="py-2.5">
                        <Link href={`/contacts/${rel.contact.id}`} className="text-[#0034e4] hover:underline font-medium">
                          {rel.contact.fullName}
                        </Link>
                      </td>
                      <td className="py-2.5 text-zinc-600">{rel.role ?? "—"}</td>
                      <td className="py-2.5 text-zinc-600">{rel.contact.email ?? "—"}</td>
                      <td className="py-2.5 text-zinc-600">{rel.contact.phone ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Opportunities */}
          {isClient && (
            <section className="bg-white rounded-lg border border-zinc-200 p-5">
              <h2 className="font-semibold text-[14px] text-zinc-700 mb-3">Opportunities ({account.opportunities.length})</h2>
              {account.opportunities.length === 0 ? (
                <p className="text-[13px] text-zinc-500">No opportunities yet.</p>
              ) : (
                <table className="w-full text-[13px]">
                  <thead className="border-b border-zinc-200">
                    <tr>
                      <th className="text-left py-2 font-semibold text-zinc-600">Product</th>
                      <th className="text-left py-2 font-semibold text-zinc-600">Stage</th>
                      <th className="text-right py-2 font-semibold text-zinc-600">Debt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {account.opportunities.map((opp) => (
                      <tr key={opp.id} className="border-b border-zinc-100">
                        <td className="py-2.5">
                          <Link href={`/opportunities/${opp.id}`} className="text-[#0034e4] hover:underline">
                            {opp.recordType.replace(/_/g, " ")}
                          </Link>
                        </td>
                        <td className="py-2.5 text-zinc-600">{opp.stage}</td>
                        <td className="py-2.5 text-right text-zinc-700">${opp.totalDebt?.toLocaleString() ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}

          {/* Creditor metadata */}
          {isCreditor && account.creditor && (
            <section className="bg-white rounded-lg border border-zinc-200 p-5">
              <h2 className="font-semibold text-[14px] text-zinc-700 mb-3">Creditor details</h2>
              <dl className="grid grid-cols-2 gap-3 text-[13px]">
                <div><span className="text-zinc-500">Legal name: </span>{account.creditor.legalName}</div>
                {account.creditor.collectionsPhone && <div><span className="text-zinc-500">Collections phone: </span>{account.creditor.collectionsPhone}</div>}
                {account.creditor.collectionsEmail && <div><span className="text-zinc-500">Collections email: </span>{account.creditor.collectionsEmail}</div>}
                <div><span className="text-zinc-500">Debts handled: </span>{account.creditor._count?.debts ?? 0}</div>
                <div className="col-span-2"><span className="text-zinc-500">Settlement policy: </span>{account.creditor.settlementPolicy ?? "—"}</div>
              </dl>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <section className="bg-white rounded-lg border border-zinc-200 p-5">
            <h3 className="font-semibold text-[13px] text-zinc-700 mb-2">Owner</h3>
            <p className="text-[13px]">{account.owner?.name ?? <span className="text-zinc-500">Unassigned</span>}</p>
          </section>
          <section className="bg-white rounded-lg border border-zinc-200 p-5">
            <h3 className="font-semibold text-[13px] text-zinc-700 mb-2">Record type</h3>
            <p className="text-[13px]">{RECORD_TYPE_LABEL[account.recordType] ?? account.recordType}</p>
          </section>
          {account.childAccounts.length > 0 && (
            <section className="bg-white rounded-lg border border-zinc-200 p-5">
              <h3 className="font-semibold text-[13px] text-zinc-700 mb-2">Sub-accounts ({account.childAccounts.length})</h3>
              <ul className="space-y-1">
                {account.childAccounts.map((c) => (
                  <li key={c.id} className="text-[13px]">
                    <Link href={`/accounts/${c.id}`} className="text-[#0034e4] hover:underline">{c.name}</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
