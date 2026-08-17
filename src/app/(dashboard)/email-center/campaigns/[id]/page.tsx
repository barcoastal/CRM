import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

function rate(part: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mass = await prisma.massEmail.findUnique({
    where: { id },
    include: {
      template: { select: { name: true } },
      fromUser: { select: { name: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true, toAddresses: true, status: true, openCount: true, clickCount: true, errorReason: true,
        },
      },
    },
  });
  if (!mass) notFound();
  const stats: Array<{ label: string; value: string }> = [
    { label: "Recipients", value: String(mass.totalCount) },
    { label: "Sent", value: String(mass.sentCount) },
    { label: "Failed", value: String(mass.failedCount) },
    { label: "Suppressed", value: String(mass.suppressedCount) },
    { label: "Open rate", value: rate(mass.openCount, mass.sentCount) },
    { label: "Click rate", value: rate(mass.clickCount, mass.sentCount) },
  ];
  return (
    <div className="ec-flows-wrap">
      <div className="ec-flows-head">
        <div>
          <h1 className="ec-flows-title">{mass.name}</h1>
          <p className="ec-flows-sub">
            {mass.status.toLowerCase()}
            {mass.template?.name ? ` · ${mass.template.name}` : ""}
            {mass.fromUser?.name ? ` · from ${mass.fromUser.name}` : ""}
            {mass.sentAt ? ` · sent ${mass.sentAt.toLocaleString()}` : ""}
          </p>
        </div>
        <Link className="ec-btn ec-btn-ghost" href="/email-center/campaigns">Back</Link>
      </div>
      <div className="ec-stat-grid">
        {stats.map((s) => (
          <div key={s.label} className="ec-stat-card">
            <div className="ec-stat-value">{s.value}</div>
            <div className="ec-stat-label">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="ec-flows-list" style={{ marginTop: 18 }}>
        {mass.messages.map((m) => (
          <div key={m.id} className="ec-flow-row">
            <span className="ec-flow-main" style={{ fontSize: 13 }}>{m.toAddresses}</span>
            {m.openCount > 0 ? <span className="ec-pill ec-pill-green">{m.openCount} opens</span> : null}
            {m.clickCount > 0 ? <span className="ec-pill ec-pill-green">{m.clickCount} clicks</span> : null}
            {m.errorReason ? <span className="ec-flow-stat">{m.errorReason.slice(0, 60)}</span> : null}
            <span className={`ec-pill ${m.status === "FAILED" ? "ec-pill-danger" : "ec-pill-neutral"}`}>
              {m.status.toLowerCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
