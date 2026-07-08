import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Plus, Activity } from "@/components/icons/lucide";

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
      Inactive
    </span>
  );
}

export default async function FlowsListPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const flows = await prisma.flow.findMany({
    orderBy: [{ entityType: "asc" }, { name: "asc" }],
    include: {
      createdBy: { select: { name: true } },
      _count: { select: { runs: true } },
    },
  });

  // Most recent run per flow (for "last run" column)
  const flowIds = flows.map((f) => f.id);
  const recentRuns =
    flowIds.length > 0
      ? await prisma.flowRun.findMany({
          where: { flowId: { in: flowIds } },
          orderBy: { startedAt: "desc" },
          take: flowIds.length * 3,
          select: { flowId: true, startedAt: true, status: true },
        })
      : [];
  const latestByFlow = new Map<string, { startedAt: Date; status: string }>();
  for (const r of recentRuns) {
    if (!latestByFlow.has(r.flowId)) {
      latestByFlow.set(r.flowId, { startedAt: r.startedAt, status: r.status });
    }
  }

  const byEntity = new Map<string, typeof flows>();
  for (const f of flows) {
    const arr = byEntity.get(f.entityType) ?? [];
    arr.push(f);
    byEntity.set(f.entityType, arr);
  }
  const groups = Array.from(byEntity.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-[24px] font-bold tracking-tight text-[#131b2e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Automation Flows
          </h1>
          <p className="text-[13px] text-[#444656] mt-1">
            Declarative automation. Compose triggers, decisions, and actions visually on a canvas.
          </p>
        </div>
        <Link
          href="/automation/flows/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-[13px] font-semibold text-white shadow-[0_8px_24px_rgba(48,82,255,0.18)]"
          style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
        >
          <Plus className="size-4" />
          New Flow
        </Link>
      </div>

      {flows.length === 0 ? (
        <div
          className="bg-white rounded-xl px-6 py-14 text-center"
          style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
        >
          <Activity className="size-10 mx-auto text-[#c0c0d2]" />
          <div className="mt-3 text-[15px] font-bold text-[#131b2e]">No flows yet</div>
          <p className="text-[13px] text-[#747474] mt-1 max-w-md mx-auto">
            Create your first flow to automate work without writing code. Flows fire when records are
            inserted or updated and walk through your decisions and actions step by step.
          </p>
          <Link
            href="/automation/flows/new"
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded text-[13px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            <Plus className="size-4" />
            Create Flow
          </Link>
        </div>
      ) : (
        groups.map(([entityType, items]) => (
          <div
            key={entityType}
            className="bg-white rounded-xl overflow-hidden"
            style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
          >
            <div className="px-5 py-4 border-b border-[#f2f3ff] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-[#3052ff]" />
                <div className="text-[14px] font-bold text-[#131b2e]">{entityType}</div>
                <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#f2f3ff] text-[#3052ff]">
                  {items.length}
                </span>
              </div>
            </div>
            <table className="w-full text-[13px]">
              <thead className="bg-[#fafaff]">
                <tr>
                  {["Name", "Trigger", "Status", "Runs", "Last Run", "Created", ""].map((h) => (
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
                {items.map((f) => {
                  const last = latestByFlow.get(f.id);
                  return (
                    <tr key={f.id} className="border-b border-[#f2f3ff] last:border-b-0 hover:bg-[#faf8ff]">
                      <td className="px-4 py-3">
                        <Link href={`/automation/flows/${f.id}`} className="font-semibold text-[#3052ff]">
                          {f.name}
                        </Link>
                        {f.description ? (
                          <div className="text-[12px] text-[#747474]">{f.description}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-[#444656]">{f.triggerEvent}</td>
                      <td className="px-4 py-3">{activeBadge(f.isActive)}</td>
                      <td className="px-4 py-3 text-[#444656]">{f._count.runs}</td>
                      <td className="px-4 py-3 text-[#444656]">
                        {last ? `${formatRelative(last.startedAt)} (${last.status})` : "Never"}
                      </td>
                      <td className="px-4 py-3 text-[#747474]">
                        {f.createdBy?.name ?? "System"}, {formatRelative(f.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/automation/flows/${f.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[12px] font-semibold text-[#3052ff] bg-[#f2f3ff]"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
