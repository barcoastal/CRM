import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { UserSquare2, Search } from "lucide-react";

interface ContactsPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

const LIMIT = 25;

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const q = params.q?.trim() || undefined;

  const where: Record<string, unknown> = { isActive: true };
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      include: {
        primaryAccount: { select: { id: true, name: true, recordType: true } },
        owner: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * LIMIT,
      take: LIMIT,
    }),
    prisma.contact.count({ where }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.5rem] font-bold tracking-tight" style={{ color: "#131b2e" }}>
          Contacts
        </h1>
        <p className="text-[13px] mt-0.5" style={{ color: "#444656" }}>
          People attached to accounts — owners, CFOs, authorized reps.
        </p>
      </div>

      <form className="flex flex-wrap gap-2 items-center" method="GET">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name, email, phone…"
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
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-600">Name</th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-600">Title</th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-600">Account</th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-600">Email</th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-600">Phone</th>
              <th className="text-left px-4 py-2.5 font-semibold text-zinc-600">Owner</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={6} className="text-center px-4 py-12 text-zinc-500">
                <UserSquare2 className="size-8 mx-auto mb-2 text-zinc-300" />
                No contacts match.
              </td></tr>
            )}
            {items.map((c) => (
              <tr key={c.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                <td className="px-4 py-2.5">
                  <Link href={`/contacts/${c.id}`} className="font-medium text-[#0034e4] hover:underline">
                    {c.fullName}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-zinc-600">{c.title ?? "—"}</td>
                <td className="px-4 py-2.5">
                  {c.primaryAccount ? (
                    <Link href={`/accounts/${c.primaryAccount.id}`} className="text-[#0034e4] hover:underline">
                      {c.primaryAccount.name}
                    </Link>
                  ) : <span className="text-zinc-400">—</span>}
                </td>
                <td className="px-4 py-2.5 text-zinc-600">{c.email ?? "—"}</td>
                <td className="px-4 py-2.5 text-zinc-600">{c.phone ?? "—"}</td>
                <td className="px-4 py-2.5 text-zinc-600">{c.owner?.name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-[12px] text-zinc-500">Showing {items.length} of {total} contacts</div>
    </div>
  );
}
