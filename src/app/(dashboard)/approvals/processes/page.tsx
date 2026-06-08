import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Plus } from "@/components/icons/lucide";

export default async function ApprovalProcessesPage() {
  await auth();

  const items = await prisma.approvalProcess.findMany({
    orderBy: [{ entityType: "asc" }, { createdAt: "desc" }],
    include: {
      createdBy: { select: { id: true, name: true } },
      steps: { orderBy: { order: "asc" } },
      _count: { select: { requests: true } },
    },
  });

  const byEntity = new Map<string, typeof items>();
  for (const p of items) {
    if (!byEntity.has(p.entityType)) byEntity.set(p.entityType, []);
    byEntity.get(p.entityType)!.push(p);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-[24px] font-bold tracking-tight text-[#131b2e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Approval Processes
          </h1>
          <p className="text-[13px] text-[#444656] mt-1">
            Define multi-step approval rules that route requests through approvers when records match entry criteria.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/approvals"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-[13px] font-semibold text-[#3052ff] bg-[#f2f3ff]"
          >
            Back to Inbox
          </Link>
          <Link
            href="/approvals/processes/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-[13px] font-semibold text-white shadow-[0_8px_24px_rgba(48,82,255,0.18)]"
            style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            <Plus className="size-4" />
            New Process
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <div
          className="bg-white rounded-xl p-10 text-center"
          style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
        >
          <div className="text-[16px] font-bold text-[#131b2e]">No approval processes yet</div>
          <p className="text-[13px] text-[#444656] mt-1 mb-4">
            Create your first process. Pick an entity (Opportunity, Settlement, Fee...), define entry criteria, then add ordered steps with approvers.
          </p>
          <Link
            href="/approvals/processes/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-[13px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            <Plus className="size-4" />
            Create process
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {Array.from(byEntity.entries()).map(([entityType, list]) => (
            <div
              key={entityType}
              className="bg-white rounded-xl overflow-hidden"
              style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
            >
              <div className="px-5 py-4 border-b border-[#f2f3ff]">
                <div className="text-[14px] font-bold text-[#131b2e]">{entityType}</div>
                <div className="text-[12px] text-[#706e6b]">
                  {list.length} process{list.length === 1 ? "" : "es"}
                </div>
              </div>
              <table className="w-full text-[13px]">
                <thead className="bg-[#fafaff]">
                  <tr>
                    {["Name", "Status", "Steps", "Requests", "Owner", ""].map((h) => (
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
                  {list.map((p) => (
                    <tr key={p.id} className="border-b border-[#f2f3ff] last:border-b-0 hover:bg-[#faf8ff]">
                      <td className="px-4 py-3">
                        <Link href={`/approvals/processes/${p.id}`} className="font-semibold text-[#3052ff]">
                          {p.name}
                        </Link>
                        {p.description && (
                          <div className="text-[12px] text-[#706e6b]">{p.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
                          style={
                            p.isActive
                              ? { background: "#e0f5e9", color: "#0d6b3b" }
                              : { background: "#ecebea", color: "#444656" }
                          }
                        >
                          {p.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#444656]">{p.steps.length}</td>
                      <td className="px-4 py-3 text-[#444656]">{p._count.requests}</td>
                      <td className="px-4 py-3 text-[#444656]">{p.createdBy?.name ?? "System"}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/approvals/processes/${p.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[12px] font-semibold text-[#3052ff] bg-[#f2f3ff]"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
