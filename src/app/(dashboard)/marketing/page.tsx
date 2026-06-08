import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ArrowDownToLine, ArrowUpFromLine, Activity } from "@/components/icons/lucide";

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  created: { bg: "bg-[rgba(26,125,55,0.1)]", text: "text-[#1a7d37]" },
  duplicate: { bg: "bg-[#f2f3ff]", text: "text-[#444656]" },
  validation_failed: { bg: "bg-[rgba(180,140,0,0.1)]", text: "text-[#8a6d00]" },
  error: { bg: "bg-[rgba(148,43,0,0.12)]", text: "text-[#942b00]" },
  sent: { bg: "bg-[rgba(26,125,55,0.1)]", text: "text-[#1a7d37]" },
  queued: { bg: "bg-[#f2f3ff]", text: "text-[#444656]" },
  failed: { bg: "bg-[rgba(148,43,0,0.12)]", text: "text-[#942b00]" },
};

function formatRelative(dt: Date | string): string {
  const d = dt instanceof Date ? dt : new Date(dt);
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function MarketingIndexPage() {
  await auth();

  const [sourceCount, endpointCount, recentInbound, recentOutbound, activeSources, activeEndpoints] = await Promise.all([
    prisma.marketingSource.count(),
    prisma.marketingPostbackEndpoint.count(),
    prisma.marketingInboundLog.findMany({
      orderBy: { receivedAt: "desc" },
      take: 10,
      include: { source: { select: { name: true, slug: true } } },
    }),
    prisma.marketingPostbackLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { endpoint: { select: { name: true } } },
    }),
    prisma.marketingSource.count({ where: { isActive: true } }),
    prisma.marketingPostbackEndpoint.count({ where: { isActive: true } }),
  ]);

  type FeedItem = {
    id: string;
    kind: "inbound" | "outbound";
    label: string;
    sub: string;
    status: string;
    at: Date;
    href: string;
  };
  const feed: FeedItem[] = [];
  for (const l of recentInbound) {
    feed.push({
      id: `i-${l.id}`,
      kind: "inbound",
      label: `Inbound ${l.status} from ${l.source.name}`,
      sub: l.leadId ? `Lead ${l.leadId.slice(0, 8)}...` : l.errorMessage ?? "",
      status: l.status,
      at: l.receivedAt,
      href: `/marketing/sources/${l.sourceId}`,
    });
  }
  for (const l of recentOutbound) {
    feed.push({
      id: `o-${l.id}`,
      kind: "outbound",
      label: `Postback ${l.event} -> ${l.endpoint.name}`,
      sub: `Status ${l.status}${l.responseStatus ? ` (HTTP ${l.responseStatus})` : ""}`,
      status: l.status,
      at: l.createdAt,
      href: `/marketing/postbacks/${l.endpointId}`,
    });
  }
  feed.sort((a, b) => b.at.getTime() - a.at.getTime());
  const feedTop = feed.slice(0, 12);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-[#131b2e]" style={{ fontFamily: "Manrope, sans-serif" }}>
            Marketing
          </h1>
          <p className="text-[13px] text-[#444656] mt-1">
            Inbound lead capture and outbound conversion postbacks.
          </p>
        </div>
        <Link
          href="/marketing/logs"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-[13px] font-semibold text-white bg-[#3052ff] shadow-[0_8px_24px_rgba(48,82,255,0.12)]"
        >
          <Activity className="size-4" />
          View All Logs
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Link
          href="/marketing/sources"
          className="bg-white rounded-xl p-6 hover:shadow-lg transition-shadow"
          style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
        >
          <div className="flex items-start justify-between mb-5">
            <div className="size-12 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}>
              <ArrowDownToLine className="size-6 text-white" />
            </div>
            <div className="text-right">
              <div className="text-[28px] font-bold text-[#131b2e]" style={{ fontFamily: "Manrope, sans-serif" }}>
                {sourceCount}
              </div>
              <div className="text-[11px] uppercase tracking-[0.5px] text-[#444656] font-semibold">
                {activeSources} Active
              </div>
            </div>
          </div>
          <div className="text-[16px] font-bold text-[#131b2e]">Inbound Sources</div>
          <p className="text-[13px] text-[#444656] mt-1">
            Webhook endpoints external sources (FB Lead Gen, Google Forms, affiliates) POST leads to.
          </p>
        </Link>

        <Link
          href="/marketing/postbacks"
          className="bg-white rounded-xl p-6 hover:shadow-lg transition-shadow"
          style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
        >
          <div className="flex items-start justify-between mb-5">
            <div className="size-12 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1a7d37, #2db84d)" }}>
              <ArrowUpFromLine className="size-6 text-white" />
            </div>
            <div className="text-right">
              <div className="text-[28px] font-bold text-[#131b2e]" style={{ fontFamily: "Manrope, sans-serif" }}>
                {endpointCount}
              </div>
              <div className="text-[11px] uppercase tracking-[0.5px] text-[#444656] font-semibold">
                {activeEndpoints} Active
              </div>
            </div>
          </div>
          <div className="text-[16px] font-bold text-[#131b2e]">Postback Endpoints</div>
          <p className="text-[13px] text-[#444656] mt-1">
            URLs the CRM POSTs to when leads are created, dispositioned, or converted.
          </p>
        </Link>
      </div>

      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}>
        <div className="px-5 py-4 border-b border-[#f2f3ff] flex items-center justify-between">
          <div className="text-[14px] font-bold text-[#131b2e]">Recent Activity</div>
          <Link href="/marketing/logs" className="text-[12px] text-[#3052ff] font-semibold">
            See All
          </Link>
        </div>
        {feedTop.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-[#444656]">
            No marketing activity yet. Configure a source or postback to get started.
          </div>
        ) : (
          <div>
            {feedTop.map((item) => {
              const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.queued;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center gap-3 px-5 py-3 border-b border-[#f2f3ff] hover:bg-[#faf8ff] last:border-b-0"
                >
                  <div className="size-8 rounded-full flex items-center justify-center" style={{ background: item.kind === "inbound" ? "#e8f0ff" : "#e8fbe9" }}>
                    {item.kind === "inbound" ? (
                      <ArrowDownToLine className="size-4 text-[#3052ff]" />
                    ) : (
                      <ArrowUpFromLine className="size-4 text-[#1a7d37]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-[#131b2e] truncate">{item.label}</div>
                    {item.sub && (
                      <div className="text-[12px] text-[#444656] truncate">{item.sub}</div>
                    )}
                  </div>
                  <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${badge.bg} ${badge.text}`}>
                    {item.status}
                  </span>
                  <div className="text-[11px] text-[#706e6b] w-16 text-right">
                    {formatRelative(item.at)}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
