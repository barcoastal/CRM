import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, Mail } from "@/components/icons/lucide";

export const dynamic = "force-dynamic";

function formatRelative(dt: Date | string | null): string {
  if (!dt) return "--";
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

const STATUS_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  DRAFT: { bg: "#f2f3ff", fg: "#444656", label: "Draft" },
  SENDING: { bg: "rgba(245,158,11,0.12)", fg: "#b45309", label: "Sending" },
  SENT: { bg: "rgba(16,185,129,0.12)", fg: "#0f766e", label: "Sent" },
  FAILED: { bg: "rgba(239,68,68,0.12)", fg: "#b91c1c", label: "Failed" },
  OPENED: { bg: "rgba(48,82,255,0.12)", fg: "#3052ff", label: "Opened" },
  CLICKED: { bg: "rgba(124,58,237,0.12)", fg: "#6d28d9", label: "Clicked" },
  QUEUED: { bg: "#f2f3ff", fg: "#444656", label: "Queued" },
  DELIVERED: { bg: "rgba(16,185,129,0.12)", fg: "#0f766e", label: "Delivered" },
};

export default async function MassEmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const mass = await prisma.massEmail.findUnique({
    where: { id },
    include: {
      template: { select: { id: true, name: true, subject: true } },
      fromUser: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (!mass) notFound();

  const messages = await prisma.emailMessage.findMany({
    where: { massEmailId: id },
    select: {
      id: true,
      toAddresses: true,
      status: true,
      sentAt: true,
      openedAt: true,
      firstClickedAt: true,
      openCount: true,
      clickCount: true,
      errorReason: true,
      lead: { select: { id: true, contactName: true, businessName: true } },
      contact: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const massStatus = STATUS_STYLES[mass.status] ?? STATUS_STYLES.DRAFT;
  const openPct = mass.sentCount > 0 ? Math.round((mass.openCount / mass.sentCount) * 100) : 0;
  const clickPct = mass.sentCount > 0 ? Math.round((mass.clickCount / mass.sentCount) * 100) : 0;
  const failPct = mass.totalCount > 0 ? Math.round((mass.failedCount / mass.totalCount) * 100) : 0;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/emails/mass"
          className="inline-flex items-center gap-1.5 text-[12px] text-[#3052ff] font-semibold mb-3"
        >
          <ArrowLeft className="size-3.5" />
          Back to Mass Email
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-[24px] font-bold tracking-tight text-[#131b2e] inline-flex items-center gap-2"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              <Mail className="size-5 text-[#3052ff]" />
              {mass.name}
            </h1>
            <div className="text-[13px] text-[#444656] mt-1">
              Template: <span className="font-semibold text-[#131b2e]">{mass.template?.name ?? "--"}</span>
              {" · "}From <span className="font-semibold text-[#131b2e]">{mass.fromUser?.name ?? "--"}</span>
              {mass.sentAt ? ` · Sent ${formatRelative(mass.sentAt)}` : ""}
            </div>
          </div>
          <span
            className="inline-flex px-3 py-1 rounded text-[12px] font-semibold"
            style={{ background: massStatus.bg, color: massStatus.fg }}
          >
            {massStatus.label}
          </span>
        </div>
      </div>

      <section className="grid grid-cols-5 gap-3">
        <Stat label="Recipients" value={mass.totalCount.toLocaleString()} />
        <Stat label="Sent" value={mass.sentCount.toLocaleString()} sub={mass.totalCount ? `${Math.round((mass.sentCount / mass.totalCount) * 100)}%` : undefined} />
        <Stat label="Failed" value={mass.failedCount.toLocaleString()} sub={mass.failedCount ? `${failPct}%` : undefined} />
        <Stat label="Opens" value={mass.openCount.toLocaleString()} sub={mass.sentCount ? `${openPct}%` : undefined} />
        <Stat label="Clicks" value={mass.clickCount.toLocaleString()} sub={mass.sentCount ? `${clickPct}%` : undefined} />
      </section>

      <section
        className="bg-white rounded-xl overflow-hidden"
        style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
      >
        <div className="px-4 py-3 border-b border-[#eef1f6] flex items-center justify-between">
          <div className="text-[14px] font-semibold text-[#131b2e]" style={{ fontFamily: "Manrope, sans-serif" }}>
            Recipients
          </div>
          <div className="text-[12px] text-[#747474]">{messages.length} message{messages.length === 1 ? "" : "s"}</div>
        </div>
        {messages.length === 0 ? (
          <div className="px-6 py-10 text-center text-[13px] text-[#747474]">
            No messages have been generated yet.
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Recipient", "Email", "Status", "Sent", "Opens", "Clicks", "Last Activity"].map((h) => (
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
              {messages.map((m, idx) => {
                const style = STATUS_STYLES[m.status] ?? STATUS_STYLES.SENT;
                const recipientName = m.lead?.contactName ?? m.contact?.fullName ?? m.lead?.businessName ?? "--";
                const lastActivity = m.firstClickedAt ?? m.openedAt ?? m.sentAt;
                return (
                  <tr key={m.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#faf8ff]"}>
                    <td className="px-4 py-2.5 text-[12px]">
                      {m.lead ? (
                        <Link href={`/leads/${m.lead.id}`} className="font-semibold text-[#131b2e] hover:text-[#3052ff]">
                          {recipientName}
                        </Link>
                      ) : m.contact ? (
                        <Link href={`/contacts/${m.contact.id}`} className="font-semibold text-[#131b2e] hover:text-[#3052ff]">
                          {recipientName}
                        </Link>
                      ) : (
                        <span className="text-[#444656]">{recipientName}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-[#444656]">{m.toAddresses}</td>
                    <td className="px-4 py-2.5 text-[12px]">
                      <span
                        className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold"
                        style={{ background: style.bg, color: style.fg }}
                      >
                        {style.label}
                      </span>
                      {m.errorReason && (
                        <div className="text-[11px] text-[#b91c1c] mt-1">{m.errorReason}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-[#444656]">{formatRelative(m.sentAt)}</td>
                    <td className="px-4 py-2.5 text-[12px] text-[#131b2e] font-semibold">{m.openCount}</td>
                    <td className="px-4 py-2.5 text-[12px] text-[#131b2e] font-semibold">{m.clickCount}</td>
                    <td className="px-4 py-2.5 text-[12px] text-[#444656]">{formatRelative(lastActivity)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      className="bg-white rounded-xl px-4 py-3"
      style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)", fontFamily: "Manrope, sans-serif" }}
    >
      <div className="text-[11px] font-semibold text-[#747474] uppercase tracking-[0.5px]">{label}</div>
      <div className="text-[20px] font-bold text-[#131b2e] mt-1">{value}</div>
      {sub && <div className="text-[11px] text-[#3052ff] font-semibold mt-0.5">{sub}</div>}
    </div>
  );
}
