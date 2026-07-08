import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Plus, Activity } from "@/components/icons/lucide";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function formatRelative(dt: Date | string | null | undefined): string {
  if (!dt) return "Never";
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

function activeBadge(isActive: boolean) {
  return isActive ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#e0f5e9] text-[#0d6b3b]">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#ecebea] text-[#444656]">
      Paused
    </span>
  );
}

export default async function EngagementListPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const sequences = await prisma.engagementSequence.findMany({
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    include: {
      createdBy: { select: { name: true } },
      _count: { select: { enrollments: true, steps: true } },
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
            Engagement Sequences
          </h1>
          <p className="text-[13px] text-[#444656] mt-1">
            <Link href="/marketing" className="text-[#3052ff]">Marketing</Link> / Engagement
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/marketing/engagement/lists"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded text-[13px] font-semibold text-[#3052ff] bg-[#f2f3ff]"
          >
            Lead Lists
          </Link>
          <Link
            href="/marketing/engagement/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-[13px] font-semibold text-white shadow-[0_8px_24px_rgba(48,82,255,0.18)]"
            style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            <Plus className="size-4" />
            New Sequence
          </Link>
        </div>
      </div>

      {sequences.length === 0 ? (
        <div
          className="bg-white rounded-xl px-6 py-14 text-center"
          style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
        >
          <Activity className="size-10 mx-auto text-[#c0c0d2]" />
          <div className="mt-3 text-[15px] font-bold text-[#131b2e]">No sequences yet</div>
          <p className="text-[13px] text-[#747474] mt-1 max-w-md mx-auto">
            Build a drip email program. Define entry criteria, add steps (send, wait, branch),
            and let the cron auto-enroll matching leads.
          </p>
          <Link
            href="/marketing/engagement/new"
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded text-[13px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            <Plus className="size-4" />
            Create Sequence
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}>
          <table className="w-full text-[13px]">
            <thead className="bg-[#fafaff]">
              <tr>
                {["Name", "Status", "Steps", "Enrolled", "Completed", "Exited", "Updated", ""].map((h) => (
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
              {sequences.map((s) => (
                <tr key={s.id} className="border-b border-[#f2f3ff] last:border-b-0 hover:bg-[#faf8ff]">
                  <td className="px-4 py-3">
                    <Link href={`/marketing/engagement/${s.id}`} className="font-semibold text-[#3052ff]">
                      {s.name}
                    </Link>
                    {s.description ? (
                      <div className="text-[12px] text-[#747474] truncate max-w-md">{s.description}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{activeBadge(s.isActive)}</td>
                  <td className="px-4 py-3 text-[#444656]">{s._count.steps}</td>
                  <td className="px-4 py-3 text-[#444656]">{s.totalEnrolled}</td>
                  <td className="px-4 py-3 text-[#444656]">{s.totalCompleted}</td>
                  <td className="px-4 py-3 text-[#444656]">{s.totalExited}</td>
                  <td className="px-4 py-3 text-[#747474]">{formatRelative(s.updatedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/marketing/engagement/${s.id}`}
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
