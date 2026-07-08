import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Plus } from "@/components/icons/lucide";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LeadListsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const lists = await prisma.leadList.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      createdBy: { select: { name: true } },
      _count: { select: { members: true } },
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-[24px] font-bold tracking-tight text-[#131b2e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Lead Lists
          </h1>
          <p className="text-[13px] text-[#444656] mt-1">
            <Link href="/marketing" className="text-[#3052ff]">Marketing</Link> /{" "}
            <Link href="/marketing/engagement" className="text-[#3052ff]">Engagement</Link> / Lead Lists
          </p>
        </div>
        <Link
          href="/marketing/engagement/lists/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-[13px] font-semibold text-white shadow-[0_8px_24px_rgba(48,82,255,0.18)]"
          style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
        >
          <Plus className="size-4" />
          New List
        </Link>
      </div>

      {lists.length === 0 ? (
        <div
          className="bg-white rounded-xl px-6 py-14 text-center"
          style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
        >
          <div className="mt-3 text-[15px] font-bold text-[#131b2e]">No lists yet</div>
          <p className="text-[13px] text-[#747474] mt-1 max-w-md mx-auto">
            Create lists to group leads (e.g. "Hot Leads", "Trial Sign-ups") for use as Mass
            Email audiences or sequence add/remove targets.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}>
          <table className="w-full text-[13px]">
            <thead className="bg-[#fafaff]">
              <tr>
                {["Name", "Status", "Members", "Created By", ""].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-2.5 text-[11px] uppercase tracking-[0.4px] font-semibold text-[#444656] border-b border-[#f2f3ff]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lists.map((l) => (
                <tr key={l.id} className="border-b border-[#f2f3ff] last:border-b-0 hover:bg-[#faf8ff]">
                  <td className="px-4 py-3">
                    <Link href={`/marketing/engagement/lists/${l.id}`} className="font-semibold text-[#3052ff]">
                      {l.name}
                    </Link>
                    {l.description ? (
                      <div className="text-[12px] text-[#747474] truncate max-w-md">{l.description}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {l.isActive ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#e0f5e9] text-[#0d6b3b]">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#ecebea] text-[#444656]">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#444656]">{l._count.members}</td>
                  <td className="px-4 py-3 text-[#747474]">{l.createdBy?.name ?? "System"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/marketing/engagement/lists/${l.id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[12px] font-semibold text-[#3052ff] bg-[#f2f3ff]"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
