import Link from "next/link";
import { auth } from "@/lib/auth";
import { listMyPendingApprovals, listMySubmittedApprovals } from "@/lib/approvals/engine";
import { LayoutList, Send, Settings } from "@/components/icons/lucide";
import { RecallButton } from "@/components/approvals/recall-button";

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

function entityHref(entityType: string, entityId: string): string {
  const map: Record<string, string> = {
    Opportunity: "opportunities",
    Settlement: "settlements",
    Fee: "fees",
    Offer: "offers",
    Lead: "leads",
    Case: "cases",
  };
  return `/${map[entityType] ?? entityType.toLowerCase() + "s"}/${entityId}`;
}

function statusPill(status: string) {
  const tone: Record<string, { bg: string; fg: string }> = {
    PENDING: { bg: "#fff5cf", fg: "#7a5c00" },
    APPROVED: { bg: "#e0f5e9", fg: "#0d6b3b" },
    REJECTED: { bg: "#fde2e2", fg: "#9d1414" },
    RECALLED: { bg: "#ecebea", fg: "#444656" },
  };
  const t = tone[status] ?? tone.PENDING;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
      style={{ background: t.bg, color: t.fg }}
    >
      {status}
    </span>
  );
}

export default async function ApprovalsLandingPage() {
  const session = await auth();
  const userId = session?.user?.id ?? "";

  const [pending, submitted] = await Promise.all([
    userId ? listMyPendingApprovals(userId) : Promise.resolve([]),
    userId ? listMySubmittedApprovals(userId) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-[24px] font-bold tracking-tight text-[#131b2e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Approvals
          </h1>
          <p className="text-[13px] text-[#444656] mt-1">
            Review approval requests assigned to you, track requests you submitted, and manage approval processes.
          </p>
        </div>
        <Link
          href="/approvals/processes"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-[13px] font-semibold text-white shadow-[0_8px_24px_rgba(48,82,255,0.18)]"
          style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
        >
          <Settings className="size-4" />
          Manage Processes
        </Link>
      </div>

      <div
        className="bg-white rounded-xl overflow-hidden"
        style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
      >
        <div className="px-5 py-4 border-b border-[#f2f3ff] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutList className="size-4 text-[#3052ff]" />
            <div className="text-[14px] font-bold text-[#131b2e]">My Approvals Inbox</div>
            <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#f2f3ff] text-[#3052ff]">
              {pending.length}
            </span>
          </div>
        </div>
        {pending.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-[#747474]">
            No requests waiting for your approval.
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-[#fafaff]">
              <tr>
                {["Process", "Record", "Submitted By", "Submitted", ""].map((h) => (
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
              {pending.map((r) => (
                <tr key={r.id} className="border-b border-[#f2f3ff] last:border-b-0 hover:bg-[#faf8ff]">
                  <td className="px-4 py-3">
                    <Link href={`/approvals/requests/${r.id}`} className="font-semibold text-[#3052ff]">
                      {r.process.name}
                    </Link>
                    <div className="text-[12px] text-[#747474]">
                      Step: {r.currentStep?.name ?? "Unknown"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#444656]">
                    <Link href={entityHref(r.entityType, r.entityId)} className="text-[#3052ff]">
                      {r.entityType} {r.entityId.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#444656]">{r.submittedBy?.name ?? "Unknown"}</td>
                  <td className="px-4 py-3 text-[#444656]">{formatRelative(r.submittedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/approvals/requests/${r.id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[12px] font-semibold text-[#3052ff] bg-[#f2f3ff]"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div
        className="bg-white rounded-xl overflow-hidden"
        style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
      >
        <div className="px-5 py-4 border-b border-[#f2f3ff] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="size-4 text-[#3052ff]" />
            <div className="text-[14px] font-bold text-[#131b2e]">Submitted by Me</div>
            <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#f2f3ff] text-[#3052ff]">
              {submitted.length}
            </span>
          </div>
        </div>
        {submitted.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-[#747474]">
            You have not submitted any approval requests yet.
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-[#fafaff]">
              <tr>
                {["Process", "Record", "Status", "Submitted", ""].map((h) => (
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
              {submitted.map((r) => (
                <tr key={r.id} className="border-b border-[#f2f3ff] last:border-b-0 hover:bg-[#faf8ff]">
                  <td className="px-4 py-3">
                    <Link href={`/approvals/requests/${r.id}`} className="font-semibold text-[#3052ff]">
                      {r.process.name}
                    </Link>
                    <div className="text-[12px] text-[#747474]">
                      {r.status === "PENDING" ? `Current step: ${r.currentStep?.name ?? "Unknown"}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#444656]">
                    <Link href={entityHref(r.entityType, r.entityId)} className="text-[#3052ff]">
                      {r.entityType} {r.entityId.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{statusPill(r.status)}</td>
                  <td className="px-4 py-3 text-[#444656]">{formatRelative(r.submittedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {r.status === "PENDING" && <RecallButton requestId={r.id} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
