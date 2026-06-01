import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Landmark, Search } from "lucide-react";

interface CreditorsPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function CreditorsPage({ searchParams }: CreditorsPageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { legalName: { contains: q, mode: "insensitive" } },
      { account: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const creditors = await prisma.creditor.findMany({
    where,
    include: {
      account: { select: { id: true, name: true, phone: true, email: true } },
      _count: { select: { debts: true } },
    },
    orderBy: { legalName: "asc" },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.5rem] font-bold tracking-tight" style={{ color: "#131b2e" }}>
          Creditors
        </h1>
        <p className="text-[13px] mt-0.5" style={{ color: "#444656" }}>
          Banks and lenders we negotiate settlements with.
        </p>
      </div>

      <form className="flex gap-2 items-center" method="GET">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by legal name…"
            className="pl-9 pr-3 py-2 border border-zinc-200 rounded-md text-[13px] w-80 bg-white"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 text-[13px] font-semibold text-white rounded-md"
          style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
        >
          Search
        </button>
      </form>

      <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-600">Creditor</th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-600">Legal name</th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-600">Collections</th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-600">Debts</th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-600">Avg %</th>
            </tr>
          </thead>
          <tbody>
            {creditors.length === 0 && (
              <tr><td colSpan={5} className="text-center px-4 py-12 text-zinc-500">
                <Landmark className="size-8 mx-auto mb-2 text-zinc-300" />
                No creditors match.
              </td></tr>
            )}
            {creditors.map((c) => (
              <tr key={c.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                <td className="px-4 py-2.5">
                  <Link href={`/accounts/${c.account.id}`} className="font-medium text-[#0034e4] hover:underline">
                    {c.account.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-zinc-600">{c.legalName}</td>
                <td className="px-4 py-2.5 text-zinc-600">{c.collectionsPhone ?? c.collectionsEmail ?? "—"}</td>
                <td className="px-4 py-2.5 text-zinc-700">{c._count.debts}</td>
                <td className="px-4 py-2.5 text-zinc-700">{c.averageAcceptedPercent ? `${(c.averageAcceptedPercent * 100).toFixed(0)}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
