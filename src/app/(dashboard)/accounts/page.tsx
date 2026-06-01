import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ACCOUNT_RECORD_TYPES } from "@/lib/record-types";
import { Building2, Search } from "lucide-react";

interface AccountsPageProps {
  searchParams: Promise<{ recordType?: string; q?: string; page?: string }>;
}

const LIMIT = 25;

const RECORD_TYPE_LABEL: Record<string, string> = {
  CLIENT: "Client",
  CREDITOR: "Creditor",
  VENDOR: "Vendor",
  BUSINESS_ACCOUNT: "Business",
  PERSON_ACCOUNT: "Person",
  BUYOUT: "Buyout",
  OTHER: "Other",
};

const RECORD_TYPE_TONE: Record<string, string> = {
  CLIENT: "bg-blue-100 text-blue-700",
  CREDITOR: "bg-purple-100 text-purple-700",
  VENDOR: "bg-amber-100 text-amber-700",
  BUSINESS_ACCOUNT: "bg-emerald-100 text-emerald-700",
  PERSON_ACCOUNT: "bg-pink-100 text-pink-700",
  BUYOUT: "bg-rose-100 text-rose-700",
  OTHER: "bg-zinc-100 text-zinc-700",
};

export default async function AccountsPage({ searchParams }: AccountsPageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const recordType =
    params.recordType && (ACCOUNT_RECORD_TYPES as readonly string[]).includes(params.recordType)
      ? params.recordType
      : undefined;
  const q = params.q?.trim() || undefined;

  const where: Record<string, unknown> = { isActive: true };
  if (recordType) where.recordType = recordType;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { ein: { contains: q } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.account.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true } },
        _count: { select: { contacts: true, opportunities: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * LIMIT,
      take: LIMIT,
    }),
    prisma.account.count({ where }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[1.5rem] font-bold tracking-tight" style={{ color: "#131b2e" }}>
            Accounts
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: "#444656" }}>
            Organizations and people we work with — clients, creditors, vendors.
          </p>
        </div>
      </div>

      {/* Filters */}
      <form className="flex flex-wrap gap-2 items-center" method="GET">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name, email, phone, EIN…"
            className="pl-9 pr-3 py-2 border border-zinc-200 rounded-md text-[13px] w-80 bg-white"
          />
        </div>
        <select
          name="recordType"
          defaultValue={recordType ?? ""}
          className="px-3 py-2 border border-zinc-200 rounded-md text-[13px] bg-white"
        >
          <option value="">All record types</option>
          {ACCOUNT_RECORD_TYPES.map((t) => (
            <option key={t} value={t}>{RECORD_TYPE_LABEL[t]}</option>
          ))}
        </select>
        <button
          type="submit"
          className="px-4 py-2 text-[13px] font-semibold text-white rounded-md"
          style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
        >
          Apply
        </button>
      </form>

      <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-600">Name</th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-600">Type</th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-600">Contacts</th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-600">Opps</th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-600">Owner</th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-600">Updated</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center px-4 py-12 text-zinc-500">
                  <Building2 className="size-8 mx-auto mb-2 text-zinc-300" />
                  No accounts match.
                </td>
              </tr>
            )}
            {items.map((a) => (
              <tr key={a.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                <td className="px-4 py-2.5">
                  <Link href={`/accounts/${a.id}`} className="font-medium text-[#0034e4] hover:underline">
                    {a.name}
                  </Link>
                  {a.email && <div className="text-zinc-500 text-[12px]">{a.email}</div>}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${RECORD_TYPE_TONE[a.recordType] ?? "bg-zinc-100 text-zinc-700"}`}>
                    {RECORD_TYPE_LABEL[a.recordType] ?? a.recordType}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-zinc-700">{a._count.contacts}</td>
                <td className="px-4 py-2.5 text-zinc-700">{a._count.opportunities}</td>
                <td className="px-4 py-2.5 text-zinc-600">{a.owner?.name ?? "—"}</td>
                <td className="px-4 py-2.5 text-zinc-500">{a.updatedAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-[12px] text-zinc-500">
        Showing {items.length} of {total} accounts
        {recordType && ` · filtered by ${RECORD_TYPE_LABEL[recordType]}`}
        {q && ` · matching "${q}"`}
      </div>
    </div>
  );
}
