import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Mail, Plus, Send } from "@/components/icons/lucide";

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

const STATUS_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  DRAFT: { bg: "#f2f3ff", fg: "#444656", label: "Draft" },
  SENDING: { bg: "rgba(245,158,11,0.12)", fg: "#b45309", label: "Sending" },
  SENT: { bg: "rgba(16,185,129,0.12)", fg: "#0f766e", label: "Sent" },
  FAILED: { bg: "rgba(239,68,68,0.12)", fg: "#b91c1c", label: "Failed" },
};

export const dynamic = "force-dynamic";

export default async function MassEmailListPage() {
  const blasts = await prisma.massEmail.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      template: { select: { id: true, name: true } },
      fromUser: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
    take: 200,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-[24px] font-bold tracking-tight text-[#131b2e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Mass Email
          </h1>
          <p className="text-[13px] text-[#444656] mt-1">
            Send a templated email to many leads or contacts at once. Each send is tracked for opens and clicks.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/emails/mass/new"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded text-white text-[13px] font-semibold"
            style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            <Plus className="size-4" />
            New Mass Email
          </Link>
        </div>
      </div>

      {blasts.length === 0 ? (
        <section
          className="bg-white rounded-xl px-10 py-14 text-center"
          style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
        >
          <div
            className="size-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            <Send className="size-7 text-white" />
          </div>
          <h2
            className="text-[20px] font-bold text-[#131b2e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Send your first mass email
          </h2>
          <p className="text-[13px] text-[#444656] mt-2 max-w-md mx-auto">
            Pick a template, choose a target audience by filter or list, and we will track every open and click back to the source recipient.
          </p>
          <Link
            href="/emails/mass/new"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded text-white text-[13px] font-semibold mt-5"
            style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            <Plus className="size-4" />
            New Mass Email
          </Link>
        </section>
      ) : (
        <section
          className="bg-white rounded-xl overflow-hidden"
          style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
        >
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Name", "Template", "Sent", "Recipients", "Opens", "Clicks", "Status", "Created"].map((h) => (
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
              {blasts.map((b, idx) => {
                const style = STATUS_STYLES[b.status] ?? STATUS_STYLES.DRAFT;
                const openPct = b.sentCount > 0 ? Math.round((b.openCount / b.sentCount) * 100) : 0;
                const clickPct = b.sentCount > 0 ? Math.round((b.clickCount / b.sentCount) * 100) : 0;
                return (
                  <tr key={b.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#faf8ff]"}>
                    <td className="px-4 py-3 text-[13px]">
                      <Link
                        href={`/emails/mass/${b.id}`}
                        className="font-semibold text-[#131b2e] hover:text-[#3052ff] inline-flex items-center gap-2"
                      >
                        <Mail className="size-4 text-[#3052ff]" />
                        {b.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#444656]">
                      {b.template?.name ?? "--"}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#444656]">
                      {b.sentAt ? formatRelative(b.sentAt) : "--"}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#131b2e] font-semibold">
                      {b.totalCount}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#131b2e]">
                      <span className="font-semibold">{b.openCount}</span>
                      {b.sentCount > 0 && (
                        <span className="text-[#747474] ml-1">({openPct}%)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#131b2e]">
                      <span className="font-semibold">{b.clickCount}</span>
                      {b.sentCount > 0 && (
                        <span className="text-[#747474] ml-1">({clickPct}%)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12px]">
                      <span
                        className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold"
                        style={{ background: style.bg, color: style.fg }}
                      >
                        {style.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#444656]">
                      {formatRelative(b.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
