import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LayoutDashboard, Plus, BarChart3 } from "@/components/icons/lucide";

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

export default async function DashboardsIndexPage() {
  const session = await auth();
  const userId = session?.user?.id;

  const dashboards = await prisma.dashboard.findMany({
    where: userId
      ? { OR: [{ isShared: true }, { createdById: userId }] }
      : { isShared: true },
    orderBy: { updatedAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { tiles: true } },
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
            Dashboards
          </h1>
          <p className="text-[13px] text-[#444656] mt-1">
            Compose KPI tiles and charts into focused, shareable workspaces.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboards/new"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded text-white text-[13px] font-semibold"
            style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            <Plus className="size-4" />
            New Dashboard
          </Link>
        </div>
      </div>

      {dashboards.length === 0 ? (
        <section
          className="bg-white rounded-xl px-10 py-14 text-center"
          style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
        >
          <div
            className="size-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            <LayoutDashboard className="size-7 text-white" />
          </div>
          <h2
            className="text-[20px] font-bold text-[#131b2e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Build a dashboard
          </h2>
          <p className="text-[13px] text-[#444656] mt-2 max-w-md mx-auto">
            Start with a name, drop in a couple of KPI tiles, and share with your team. Tiles are powered by built-in queries or saved Reports.
          </p>
          <Link
            href="/dashboards/new"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded text-white text-[13px] font-semibold mt-5"
            style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            <Plus className="size-4" />
            Build a dashboard
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
                {["Name", "Description", "Tiles", "Shared", "Owner", "Updated"].map((h) => (
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
              {dashboards.map((d, idx) => (
                <tr key={d.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#faf8ff]"}>
                  <td className="px-4 py-3 text-[13px]">
                    <Link
                      href={`/dashboards/${d.id}`}
                      className="font-semibold text-[#131b2e] hover:text-[#3052ff] inline-flex items-center gap-2"
                    >
                      <BarChart3 className="size-4 text-[#3052ff]" />
                      {d.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#444656]">
                    {d.description ?? <span className="text-[#706e6b]">--</span>}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#131b2e] font-semibold">
                    {d._count.tiles}
                  </td>
                  <td className="px-4 py-3 text-[12px]">
                    {d.isShared ? (
                      <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-[rgba(48,82,255,0.1)] text-[#3052ff]">
                        Shared
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-[#f2f3ff] text-[#444656]">
                        Private
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#444656]">
                    {d.createdBy?.name ?? "--"}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#444656]">
                    {formatRelative(d.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
