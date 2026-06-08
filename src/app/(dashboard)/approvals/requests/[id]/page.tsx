import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RequestDecisionPanel } from "@/components/approvals/request-decision-panel";

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

export default async function ApprovalRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id ?? "";
  const { id } = await params;

  const request = await prisma.approvalRequest.findUnique({
    where: { id },
    include: {
      process: { include: { steps: { orderBy: { order: "asc" } } } },
      currentStep: true,
      submittedBy: { select: { id: true, name: true, email: true, managerId: true } },
      actions: {
        orderBy: { createdAt: "asc" },
        include: {
          actor: { select: { id: true, name: true } },
          step: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!request) notFound();

  // Compute whether current user can act.
  let canApprove = false;
  if (request.status === "PENDING" && request.currentStep) {
    if (request.currentStep.useSubmitterManager) {
      canApprove = request.submittedBy?.managerId === userId;
    } else {
      canApprove = request.currentStep.approverUserIds.includes(userId);
    }
  }
  const canRecall = request.status === "PENDING" && request.submittedById === userId;

  const snapshot = (request.snapshot ?? {}) as Record<string, unknown>;
  const snapshotEntries = Object.entries(snapshot)
    .filter(([k]) => !k.startsWith("_") && k !== "snapshot")
    .slice(0, 30);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.4px] font-semibold text-[#706e6b]">
            Approval Request
          </div>
          <h1
            className="text-[24px] font-bold tracking-tight text-[#131b2e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            {request.process.name}
          </h1>
          <div className="flex items-center gap-2 mt-1 text-[13px] text-[#444656]">
            {statusPill(request.status)}
            <span>
              Submitted {new Date(request.submittedAt).toLocaleString()} by {request.submittedBy?.name ?? "Unknown"}
            </span>
          </div>
        </div>
        <Link
          href="/approvals"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-[13px] font-semibold text-[#3052ff] bg-[#f2f3ff]"
        >
          Back to Approvals
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-5">
          <div
            className="bg-white rounded-xl overflow-hidden"
            style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
          >
            <div className="px-5 py-4 border-b border-[#f2f3ff]">
              <div className="text-[14px] font-bold text-[#131b2e]">Approval Path</div>
              <div className="text-[12px] text-[#706e6b]">
                {request.process.steps.length} step{request.process.steps.length === 1 ? "" : "s"} total
              </div>
            </div>
            <div className="divide-y divide-[#f2f3ff]">
              {request.process.steps.map((step, idx) => {
                const isCurrent = request.currentStepId === step.id;
                const isPast =
                  request.status !== "PENDING"
                    ? false
                    : request.process.steps.findIndex((s) => s.id === request.currentStepId) > idx;
                return (
                  <div key={step.id} className="px-5 py-3 flex items-center gap-3">
                    <span
                      className="inline-flex items-center justify-center size-7 rounded-full text-[12px] font-bold"
                      style={
                        isCurrent
                          ? { background: "linear-gradient(135deg, #0034e4, #3052ff)", color: "#fff" }
                          : isPast
                          ? { background: "#e0f5e9", color: "#0d6b3b" }
                          : { background: "#ecebea", color: "#706e6b" }
                      }
                    >
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <div className="text-[13px] font-semibold text-[#131b2e]">{step.name}</div>
                      <div className="text-[12px] text-[#706e6b]">
                        {step.useSubmitterManager
                          ? "Routes to submitter's manager"
                          : step.approverUserIds.length > 0
                          ? `${step.approverUserIds.length} approver${step.approverUserIds.length === 1 ? "" : "s"}`
                          : "No approvers"}
                      </div>
                    </div>
                    {isCurrent && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#fff5cf] text-[#7a5c00]">
                        Awaiting
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className="bg-white rounded-xl overflow-hidden"
            style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
          >
            <div className="px-5 py-4 border-b border-[#f2f3ff]">
              <div className="text-[14px] font-bold text-[#131b2e]">Action History</div>
            </div>
            <div className="divide-y divide-[#f2f3ff]">
              {request.actions.map((a) => (
                <div key={a.id} className="px-5 py-3 flex items-start gap-3">
                  <div
                    className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold mt-0.5"
                    style={actionTone(a.kind)}
                  >
                    {a.kind}
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] text-[#131b2e]">
                      <span className="font-semibold">{a.actor?.name ?? "System"}</span>
                      {a.step?.name && (
                        <span className="text-[#706e6b]"> on {a.step.name}</span>
                      )}
                    </div>
                    {a.comments && (
                      <div className="text-[12px] text-[#444656] mt-1 whitespace-pre-wrap">
                        {a.comments}
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] text-[#706e6b] whitespace-nowrap">
                    {new Date(a.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className="bg-white rounded-xl overflow-hidden"
            style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
          >
            <div className="px-5 py-4 border-b border-[#f2f3ff]">
              <div className="text-[14px] font-bold text-[#131b2e]">Record Snapshot</div>
              <div className="text-[12px] text-[#706e6b]">
                Values captured at submission time.
              </div>
            </div>
            <div className="divide-y divide-[#f2f3ff]">
              {snapshotEntries.length === 0 && (
                <div className="px-5 py-6 text-[13px] text-[#706e6b] text-center">
                  No snapshot data.
                </div>
              )}
              {snapshotEntries.map(([k, v]) => (
                <div key={k} className="px-5 py-2 flex items-start gap-3 text-[13px]">
                  <div className="w-44 text-[#706e6b] font-semibold text-[12px]">{k}</div>
                  <div className="flex-1 text-[#131b2e] break-all">
                    {v === null || v === undefined ? "-" : String(typeof v === "object" ? JSON.stringify(v) : v).slice(0, 200)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div
            className="bg-white rounded-xl p-5 space-y-3"
            style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
          >
            <div className="text-[14px] font-bold text-[#131b2e]">Request</div>
            <Row label="Process">
              <Link href={`/approvals/processes/${request.processId}`} className="text-[#3052ff]">
                {request.process.name}
              </Link>
            </Row>
            <Row label="Record">
              <Link
                href={entityHref(request.entityType, request.entityId)}
                className="text-[#3052ff]"
              >
                {request.entityType} {request.entityId.slice(0, 12)}
              </Link>
            </Row>
            <Row label="Submitter">{request.submittedBy?.name ?? "Unknown"}</Row>
            <Row label="Submitted">{new Date(request.submittedAt).toLocaleString()}</Row>
            {request.decidedAt && (
              <Row label="Decided">{new Date(request.decidedAt).toLocaleString()}</Row>
            )}
            {request.comments && (
              <Row label="Comments">
                <div className="whitespace-pre-wrap">{request.comments}</div>
              </Row>
            )}
          </div>

          <RequestDecisionPanel
            requestId={request.id}
            canApprove={canApprove}
            canRecall={canRecall}
            status={request.status}
          />
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-[13px]">
      <div className="w-24 text-[12px] font-semibold text-[#706e6b]">{label}</div>
      <div className="flex-1 text-[#131b2e]">{children}</div>
    </div>
  );
}

function actionTone(kind: string): { background: string; color: string } {
  switch (kind) {
    case "APPROVED":
      return { background: "#e0f5e9", color: "#0d6b3b" };
    case "REJECTED":
      return { background: "#fde2e2", color: "#9d1414" };
    case "RECALLED":
      return { background: "#ecebea", color: "#444656" };
    case "SUBMITTED":
      return { background: "#f2f3ff", color: "#3052ff" };
    default:
      return { background: "#ecebea", color: "#444656" };
  }
}
