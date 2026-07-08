import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OBJECT_METADATA } from "@/lib/reports/object-metadata";
import { BarChart3, Plus, Play, Pencil } from "@/components/icons/lucide";
import { DeleteReportButton } from "@/components/reports/delete-report-button";

function formatRelative(dt: Date | string | null): string {
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

export default async function ReportsPage() {
  await auth();

  const reports = await prisma.report.findMany({
    orderBy: [{ objectType: "asc" }, { updatedAt: "desc" }],
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });

  // Group by objectType
  const byObject = new Map<string, typeof reports>();
  for (const r of reports) {
    const k = r.objectType;
    if (!byObject.has(k)) byObject.set(k, []);
    byObject.get(k)!.push(r);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-[24px] font-bold tracking-tight text-[#131b2e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Reports
          </h1>
          <p className="text-[13px] text-[#444656] mt-1">
            Build, save, and run reports across Leads, Opportunities, Accounts, Cases, and more.
          </p>
        </div>
        <Link
          href="/reports/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-[13px] font-semibold text-white shadow-[0_8px_24px_rgba(48,82,255,0.18)]"
          style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
        >
          <Plus className="size-4" />
          New Report
        </Link>
      </div>

      {reports.length === 0 ? (
        <div
          className="bg-white rounded-xl p-10 text-center"
          style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
        >
          <div
            className="size-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            <BarChart3 className="size-7 text-white" />
          </div>
          <div className="text-[16px] font-bold text-[#131b2e]">No reports yet</div>
          <p className="text-[13px] text-[#444656] mt-1 mb-4">
            Build your first report. Pick an object, choose columns, add filters, and save it for the team.
          </p>
          <Link
            href="/reports/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-[13px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            <Plus className="size-4" />
            Create your first report
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {Array.from(byObject.entries()).map(([objectType, list]) => {
            const meta = OBJECT_METADATA[objectType];
            return (
              <div
                key={objectType}
                className="bg-white rounded-xl overflow-hidden"
                style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
              >
                <div className="px-5 py-4 border-b border-[#f2f3ff] flex items-center justify-between">
                  <div>
                    <div className="text-[14px] font-bold text-[#131b2e]">
                      {meta?.pluralLabel ?? objectType}
                    </div>
                    <div className="text-[12px] text-[#747474]">
                      {list.length} report{list.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
                <table className="w-full text-[13px]">
                  <thead className="bg-[#fafaff]">
                    <tr>
                      {["Name", "Object", "Last Run", "Owner", ""].map((h) => (
                        <th
                          key={h}
                          className="text-left px-4 py-2 text-[11px] uppercase tracking-[0.4px] font-semibold text-[#444656] border-b border-[#f2f3ff]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => (
                      <tr key={r.id} className="border-b border-[#f2f3ff] last:border-b-0 hover:bg-[#faf8ff]">
                        <td className="px-4 py-3">
                          <Link
                            href={`/reports/${r.id}`}
                            className="font-semibold text-[#3052ff]"
                          >
                            {r.name}
                          </Link>
                          {r.description && (
                            <div className="text-[12px] text-[#747474]">{r.description}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[#444656]">
                          {OBJECT_METADATA[r.objectType]?.label ?? r.objectType}
                        </td>
                        <td className="px-4 py-3 text-[#444656]">{formatRelative(r.lastRunAt)}</td>
                        <td className="px-4 py-3 text-[#444656]">
                          {r.createdBy?.name ?? "System"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <Link
                              href={`/reports/${r.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[12px] font-semibold text-[#3052ff] bg-[#f2f3ff]"
                            >
                              <Play className="size-3" />
                              Run
                            </Link>
                            <Link
                              href={`/reports/builder?objectType=${r.objectType}&id=${r.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[12px] font-semibold text-[#444656] bg-[#f2f3ff]"
                            >
                              <Pencil className="size-3" />
                              Edit
                            </Link>
                            <DeleteReportButton id={r.id} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
