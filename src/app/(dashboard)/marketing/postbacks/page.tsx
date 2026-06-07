import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Plus } from "lucide-react";

export default async function PostbacksPage() {
  await auth();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const endpoints = await prisma.marketingPostbackEndpoint.findMany({
    orderBy: { createdAt: "desc" },
  });

  const stats = await prisma.marketingPostbackLog.groupBy({
    by: ["endpointId", "status"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });
  const statsMap = new Map<string, { sent: number; failed: number; queued: number }>();
  for (const s of stats) {
    const cur = statsMap.get(s.endpointId) ?? { sent: 0, failed: 0, queued: 0 };
    if (s.status === "sent") cur.sent = s._count._all;
    else if (s.status === "failed") cur.failed = s._count._all;
    else if (s.status === "queued") cur.queued = s._count._all;
    statsMap.set(s.endpointId, cur);
  }

  const lastSentMap = new Map<string, Date>();
  const lastSent = await prisma.marketingPostbackLog.findMany({
    where: { status: "sent" },
    orderBy: { sentAt: "desc" },
    distinct: ["endpointId"],
    select: { endpointId: true, sentAt: true },
  });
  for (const l of lastSent) if (l.sentAt) lastSentMap.set(l.endpointId, l.sentAt);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-[#131b2e]" style={{ fontFamily: "Manrope, sans-serif" }}>
            Postback Endpoints
          </h1>
          <p className="text-[13px] text-[#444656] mt-1">
            <Link href="/marketing" className="text-[#3052ff]">Marketing</Link> / Postbacks
          </p>
        </div>
        <Link
          href="/marketing/postbacks/new"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded text-white text-[13px] font-semibold"
          style={{ background: "linear-gradient(135deg, #1a7d37, #2db84d)" }}
        >
          <Plus className="size-4" />
          New Endpoint
        </Link>
      </div>

      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Name", "URL", "Method", "Events", "Status", "Sent 7d", "Failed 7d", "Last Sent"].map((h) => (
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
            {endpoints.length === 0 ? (
              <tr>
                <td colSpan={8} className="h-24 text-center text-[13px] text-[#444656] py-8 bg-white">
                  No postback endpoints yet. Create one to push conversions back to your source.
                </td>
              </tr>
            ) : (
              endpoints.map((ep, idx) => {
                const s = statsMap.get(ep.id) ?? { sent: 0, failed: 0, queued: 0 };
                const last = lastSentMap.get(ep.id);
                const rowBg = idx % 2 === 0 ? "bg-white" : "bg-[#faf8ff]";
                return (
                  <tr key={ep.id}>
                    <td className={`px-4 py-3.5 text-[13px] ${rowBg}`}>
                      <Link
                        href={`/marketing/postbacks/${ep.id}`}
                        className="font-semibold text-[#131b2e] hover:text-[#3052ff]"
                      >
                        {ep.name}
                      </Link>
                    </td>
                    <td className={`px-4 py-3.5 text-[12px] ${rowBg}`}>
                      <code className="font-mono text-[#444656] truncate max-w-[280px] inline-block align-middle">
                        {ep.url}
                      </code>
                    </td>
                    <td className={`px-4 py-3.5 text-[12px] font-mono ${rowBg}`}>{ep.method}</td>
                    <td className={`px-4 py-3.5 text-[11px] ${rowBg}`}>
                      <div className="flex flex-wrap gap-1">
                        {ep.events.map((e) => (
                          <span
                            key={e}
                            className="px-1.5 py-0.5 rounded bg-[#f2f3ff] text-[#3052ff] font-mono"
                          >
                            {e}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className={`px-4 py-3.5 ${rowBg}`}>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${
                          ep.isActive
                            ? "bg-[rgba(26,125,55,0.1)] text-[#1a7d37]"
                            : "bg-[#f2f3ff] text-[#444656]"
                        }`}
                      >
                        {ep.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className={`px-4 py-3.5 text-[13px] font-semibold text-[#1a7d37] ${rowBg}`}>{s.sent}</td>
                    <td className={`px-4 py-3.5 text-[13px] font-semibold text-[#942b00] ${rowBg}`}>{s.failed}</td>
                    <td className={`px-4 py-3.5 text-[12px] text-[#444656] ${rowBg}`}>
                      {last ? new Date(last).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" }) : "Never"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
