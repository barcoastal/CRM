import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FileText, Clock, CheckCircle2, Send, Plus, Layers } from "@/components/icons/lucide";

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function formatRelative(dt: Date | string): string {
  const d = dt instanceof Date ? dt : new Date(dt);
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: "bg-[#f2f3ff]", text: "text-[#444656]", label: "Draft" },
  SENT: { bg: "bg-[rgba(48,82,255,0.1)]", text: "text-[#3052ff]", label: "Sent" },
  VIEWED: { bg: "bg-[rgba(180,140,0,0.1)]", text: "text-[#8a6d00]", label: "Viewed" },
  SIGNED: { bg: "bg-[rgba(26,125,55,0.1)]", text: "text-[#1a7d37]", label: "Signed" },
  COMPLETED: { bg: "bg-[rgba(26,125,55,0.1)]", text: "text-[#1a7d37]", label: "Completed" },
  DECLINED: { bg: "bg-[rgba(148,43,0,0.12)]", text: "text-[#942b00]", label: "Declined" },
  VOIDED: { bg: "bg-[rgba(148,43,0,0.12)]", text: "text-[#942b00]", label: "Voided" },
};

export default async function SignDocsHubPage() {
  await auth();

  const now = new Date();
  const monthStart = startOfMonth(now);
  const dayStart = startOfDay(now);

  const [pendingCount, sentTodayCount, completedThisMonth, templateCount, byStatus, recentEnvelopes, recentEvents, recentTemplates] = await Promise.all([
    prisma.envelope.count({ where: { status: { in: ["SENT", "VIEWED"] } } }),
    prisma.envelope.count({ where: { sentAt: { gte: dayStart } } }),
    prisma.envelope.count({ where: { status: "COMPLETED", completedAt: { gte: monthStart } } }),
    prisma.envelopeTemplate.count({ where: { isActive: true } }),
    prisma.envelope.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.envelope.findMany({
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: {
        opportunity: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } },
      },
    }),
    prisma.envelopeEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        envelope: {
          select: { id: true, documentName: true, signerName: true, signerEmail: true },
        },
      },
    }),
    prisma.envelopeTemplate.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ]);

  const statusMap = new Map<string, number>();
  for (const s of byStatus) statusMap.set(s.status, s._count._all);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-[#131b2e]" style={{ fontFamily: "Manrope, sans-serif" }}>
            Sign Docs
          </h1>
          <p className="text-[13px] text-[#444656] mt-1">
            Send contracts auto-filled from Opportunities. Track signatures, manage templates.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/templates/esign"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-[13px] font-semibold text-white bg-[#3052ff] border border-[#3052ff]"
          >
            <Layers className="size-4" />
            Templates
          </Link>
          <Link
            href="/templates/esign/new"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded text-white text-[13px] font-semibold"
            style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            <Plus className="size-4" />
            New Template
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Clock className="size-5 text-white" />}
          gradient="linear-gradient(135deg, #b48c00, #d1a000)"
          value={pendingCount}
          label="Pending"
          sub="Awaiting signature"
          href="/envelopes?status=pending"
        />
        <StatCard
          icon={<Send className="size-5 text-white" />}
          gradient="linear-gradient(135deg, #0034e4, #3052ff)"
          value={sentTodayCount}
          label="Sent Today"
          sub={now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          href="/envelopes?sent=today"
        />
        <StatCard
          icon={<CheckCircle2 className="size-5 text-white" />}
          gradient="linear-gradient(135deg, #1a7d37, #2db84d)"
          value={completedThisMonth}
          label="Completed"
          sub={now.toLocaleDateString("en-US", { month: "long" })}
          href="/envelopes?status=completed"
        />
        <StatCard
          icon={<FileText className="size-5 text-white" />}
          gradient="linear-gradient(135deg, #5c5c8a, #7474a8)"
          value={templateCount}
          label="Templates"
          sub="Active contract templates"
          href="/templates/esign"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section className="bg-white rounded-xl overflow-hidden lg:col-span-2" style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}>
          <div className="px-5 py-4 border-b border-[#f2f3ff] flex items-center justify-between">
            <h2 className="text-[14px] font-bold text-[#131b2e]">Recent Envelopes</h2>
            <Link href="/envelopes" className="text-[12px] text-[#3052ff] font-semibold">
              See All
            </Link>
          </div>
          {recentEnvelopes.length === 0 ? (
            <div className="px-5 py-10 text-center text-[13px] text-[#444656]">
              No envelopes yet. From any Opportunity, click Send Contract.
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {["Document", "Signer", "Linked", "Status", "Updated"].map((h) => (
                    <th
                      key={h}
                      className="text-left text-[11px] font-semibold text-[#444656] uppercase tracking-[0.5px] px-4 py-3 bg-[#f8f8fb]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentEnvelopes.map((env, idx) => {
                  const style = STATUS_STYLE[env.status] ?? STATUS_STYLE.DRAFT;
                  const linkedHref = env.opportunityId
                    ? `/opportunities/${env.opportunityId}`
                    : env.accountId
                      ? `/accounts/${env.accountId}`
                      : env.leadId
                        ? `/leads/${env.leadId}`
                        : "";
                  const linkedLabel = env.opportunity?.name ?? env.account?.name ?? "";
                  return (
                    <tr key={env.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#faf8ff]"}>
                      <td className="px-4 py-3 text-[13px]">
                        <Link href={`/envelopes/${env.id}`} className="font-semibold text-[#131b2e] hover:text-[#3052ff]">
                          {env.documentName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#444656]">
                        <div className="font-semibold text-[#131b2e]">{env.signerName}</div>
                        <div className="text-[11px] text-[#706e6b]">{env.signerEmail}</div>
                      </td>
                      <td className="px-4 py-3 text-[12px]">
                        {linkedHref ? (
                          <Link href={linkedHref} className="text-[#3052ff]">
                            {linkedLabel || linkedHref}
                          </Link>
                        ) : (
                          <span className="text-[#706e6b]">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${style.bg} ${style.text}`}>
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#444656]">{formatRelative(env.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="space-y-5">
          <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}>
            <div className="px-5 py-4 border-b border-[#f2f3ff] flex items-center justify-between">
              <h2 className="text-[14px] font-bold text-[#131b2e]">Status Breakdown</h2>
            </div>
            <div className="p-5 space-y-2">
              {Object.entries(STATUS_STYLE).map(([status, style]) => {
                const count = statusMap.get(status) ?? 0;
                return (
                  <div key={status} className="flex items-center justify-between">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                    <span className="text-[13px] font-semibold text-[#131b2e]">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}>
            <div className="px-5 py-4 border-b border-[#f2f3ff] flex items-center justify-between">
              <h2 className="text-[14px] font-bold text-[#131b2e]">Templates</h2>
              <Link href="/templates/esign" className="text-[12px] text-[#3052ff] font-semibold">
                Manage
              </Link>
            </div>
            {recentTemplates.length === 0 ? (
              <div className="px-5 py-6 text-center text-[12px] text-[#444656]">
                No templates yet.{" "}
                <Link href="/templates/esign/new" className="text-[#3052ff] font-semibold">
                  Upload one
                </Link>
                .
              </div>
            ) : (
              <div>
                {recentTemplates.map((t) => (
                  <Link
                    key={t.id}
                    href={`/templates/esign/${t.id}`}
                    className="flex items-center gap-3 px-5 py-3 border-b border-[#f2f3ff] hover:bg-[#faf8ff] last:border-b-0"
                  >
                    <div className="size-8 rounded bg-[#f2f3ff] flex items-center justify-center">
                      <FileText className="size-4 text-[#3052ff]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-[#131b2e] truncate">{t.name}</div>
                      <div className="text-[11px] text-[#706e6b]">
                        {t.recordType} · {t.pageCount} page{t.pageCount === 1 ? "" : "s"}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}>
        <div className="px-5 py-4 border-b border-[#f2f3ff]">
          <h2 className="text-[14px] font-bold text-[#131b2e]">Recent Activity</h2>
        </div>
        {recentEvents.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-[#444656]">
            No envelope events yet.
          </div>
        ) : (
          <div>
            {recentEvents.map((ev) => (
              <Link
                key={ev.id}
                href={`/envelopes/${ev.envelope.id}`}
                className="flex items-center gap-3 px-5 py-3 border-b border-[#f2f3ff] hover:bg-[#faf8ff] last:border-b-0"
              >
                <EventDot type={ev.eventType} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[#131b2e] truncate">
                    {labelForEvent(ev.eventType)} · {ev.envelope.documentName}
                  </div>
                  <div className="text-[12px] text-[#444656] truncate">
                    {ev.envelope.signerName} ({ev.envelope.signerEmail}){ev.details ? ` · ${ev.details}` : ""}
                  </div>
                </div>
                <div className="text-[11px] text-[#706e6b]">{formatRelative(ev.createdAt)}</div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon,
  gradient,
  value,
  label,
  sub,
  href,
}: {
  icon: React.ReactNode;
  gradient: string;
  value: number;
  label: string;
  sub: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white rounded-xl p-5 hover:shadow-lg transition-shadow"
      style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="size-10 rounded-lg flex items-center justify-center" style={{ background: gradient }}>
          {icon}
        </div>
        <div className="text-[28px] font-bold text-[#131b2e]" style={{ fontFamily: "Manrope, sans-serif" }}>
          {value}
        </div>
      </div>
      <div className="text-[14px] font-bold text-[#131b2e]">{label}</div>
      <div className="text-[11px] text-[#706e6b] mt-0.5">{sub}</div>
    </Link>
  );
}

function EventDot({ type }: { type: string }) {
  const colorMap: Record<string, string> = {
    SENT: "#3052ff",
    VIEWED: "#b48c00",
    SIGNED: "#1a7d37",
    COMPLETED: "#1a7d37",
    DECLINED: "#942b00",
    VOIDED: "#942b00",
    CREATED: "#706e6b",
    REMINDER_SENT: "#3052ff",
  };
  const color = colorMap[type] ?? "#706e6b";
  return (
    <span
      className="size-2 rounded-full"
      style={{ background: color, boxShadow: `0 0 0 4px ${color}22` }}
    />
  );
}

function labelForEvent(type: string): string {
  switch (type) {
    case "SENT":
      return "Sent for signature";
    case "VIEWED":
      return "Opened by signer";
    case "SIGNED":
      return "Signed";
    case "COMPLETED":
      return "Completed";
    case "DECLINED":
      return "Declined";
    case "VOIDED":
      return "Voided";
    case "REMINDER_SENT":
      return "Reminder sent";
    case "CREATED":
      return "Created";
    default:
      return type;
  }
}
