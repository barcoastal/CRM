import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Plus, Copy } from "@/components/icons/lucide";

function baseUrl(): string {
  return process.env.NEXTAUTH_URL ?? "https://crm.coastaldebt-tools.com";
}

export default async function MarketingSourcesPage() {
  await auth();

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const sources = await prisma.marketingSource.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { inboundLogs: true } },
    },
  });

  // Counts last 7 days per source, status="created"
  const recentByPair = await prisma.marketingInboundLog.groupBy({
    by: ["sourceId"],
    where: { receivedAt: { gte: since }, status: "created" },
    _count: { _all: true },
  });
  const recentMap = new Map<string, number>();
  for (const r of recentByPair) recentMap.set(r.sourceId, r._count._all);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-[#131b2e]" style={{ fontFamily: "Manrope, sans-serif" }}>
            Inbound Sources
          </h1>
          <p className="text-[13px] text-[#444656] mt-1">
            <Link href="/marketing" className="text-[#3052ff]">Marketing</Link> / Sources
          </p>
        </div>
        <Link
          href="/marketing/sources/new"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded text-white text-[13px] font-semibold shadow-[0_8px_24px_rgba(48,82,255,0.25)]"
          style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
        >
          <Plus className="size-4" />
          New Source
        </Link>
      </div>

      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Name", "Slug", "Webhook URL", "Status", "Leads (7d)", "Created"].map((h) => (
                <th
                  key={h}
                  className="text-left text-[11px] font-semibold text-[#444656] uppercase tracking-[0.5px] px-4 py-3.5 bg-[#f2f3ff]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sources.length === 0 ? (
              <tr>
                <td colSpan={6} className="h-24 text-center text-[13px] text-[#444656] py-8 bg-white">
                  No inbound sources yet. Create your first source to start capturing leads.
                </td>
              </tr>
            ) : (
              sources.map((s, idx) => {
                const url = `${baseUrl()}/api/marketing/inbound/${s.slug}`;
                const rowBg = idx % 2 === 0 ? "bg-white" : "bg-[#faf8ff]";
                const created = recentMap.get(s.id) ?? 0;
                return (
                  <tr key={s.id}>
                    <td className={`px-4 py-3.5 text-[13px] ${rowBg}`}>
                      <Link href={`/marketing/sources/${s.id}`} className="font-semibold text-[#131b2e] hover:text-[#3052ff]">
                        {s.name}
                      </Link>
                    </td>
                    <td className={`px-4 py-3.5 text-[13px] text-[#444656] ${rowBg}`}>
                      <code className="font-mono text-[12px]">{s.slug}</code>
                    </td>
                    <td className={`px-4 py-3.5 text-[12px] ${rowBg}`}>
                      <code className="font-mono text-[#444656] truncate max-w-[400px] inline-block align-middle">
                        {url}
                      </code>
                    </td>
                    <td className={`px-4 py-3.5 text-[13px] ${rowBg}`}>
                      {s.isActive ? (
                        <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-[rgba(26,125,55,0.1)] text-[#1a7d37]">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-[#f2f3ff] text-[#444656]">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className={`px-4 py-3.5 text-[13px] font-semibold text-[#131b2e] ${rowBg}`}>
                      {created}
                    </td>
                    <td className={`px-4 py-3.5 text-[13px] text-[#444656] ${rowBg}`}>
                      {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="text-[12px] text-[#706e6b] flex items-center gap-1.5">
        <Copy className="size-3.5" />
        Click any source to copy its webhook URL and API key.
      </div>
    </div>
  );
}
