// src/app/(dashboard)/email-center/flows/[id]/report/page.tsx
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { computeRates, type MessageAgg } from "@/lib/email/reports";

export const dynamic = "force-dynamic";

export default async function FlowReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const flow = await prisma.flow.findUnique({ where: { id }, select: { id: true, name: true, entityType: true } });
  if (!flow) notFound();

  const msgWhere = { flowId: id, direction: "OUTBOUND" } as const;
  const [total, delivered, uniqueOpens, uniqueClicks, byStatus, runCount, recent] = await Promise.all([
    prisma.emailMessage.count({ where: msgWhere }),
    prisma.emailMessage.count({ where: { ...msgWhere, deliveredAt: { not: null } } }),
    prisma.emailMessage.count({ where: { ...msgWhere, openedAt: { not: null } } }),
    prisma.emailMessage.count({ where: { ...msgWhere, firstClickedAt: { not: null } } }),
    prisma.emailMessage.groupBy({ by: ["status"], where: msgWhere, _count: true }),
    prisma.flowRun.count({ where: { flowId: id } }),
    prisma.emailMessage.findMany({
      where: msgWhere,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, toAddresses: true, status: true, openCount: true, clickCount: true, createdAt: true },
    }),
  ]);
  const sc = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;
  const agg: MessageAgg = { total, delivered, uniqueOpens, uniqueClicks, bounced: sc("BOUNCED"), complained: sc("COMPLAINED"), unsubscribed: 0, failed: sc("FAILED") };
  const rates = computeRates(agg);
  const stats = [
    { label: "Runs", value: String(runCount) },
    { label: "Emails sent", value: String(total) },
    { label: "Delivery rate", value: `${rates.deliveryRate}%` },
    { label: "Open rate", value: `${rates.openRate}%` },
    { label: "Click rate", value: `${rates.clickRate}%` },
    { label: "Bounce rate", value: `${rates.bounceRate}%` },
  ];

  return (
    <div className="ec-flows-wrap">
      <div className="ec-flows-head">
        <div>
          <h1 className="ec-flows-title">{flow.name}</h1>
          <p className="ec-flows-sub">Flow performance · {flow.entityType} automation</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="ec-btn ec-btn-ghost" href={`/automation/flows/${flow.id}`}>Edit</Link>
          <Link className="ec-btn ec-btn-ghost" href="/email-center/flows">Back</Link>
        </div>
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
        {recent.length === 0 ? (
          <div className="ec-flow-row"><span className="ec-flow-main" style={{ color: "var(--ec-faint)" }}>No emails sent by this flow yet.</span></div>
        ) : recent.map((m) => (
          <div key={m.id} className="ec-flow-row">
            <span className="ec-flow-main" style={{ fontSize: 13 }}>{m.toAddresses}</span>
            {m.openCount > 0 ? <span className="ec-pill ec-pill-green">{m.openCount} opens</span> : null}
            {m.clickCount > 0 ? <span className="ec-pill ec-pill-green">{m.clickCount} clicks</span> : null}
            <span className="ec-flow-stat">{new Date(m.createdAt).toLocaleDateString()}</span>
            <span className={`ec-pill ${m.status === "FAILED" || m.status === "BOUNCED" ? "ec-pill-danger" : "ec-pill-neutral"}`}>{m.status.toLowerCase()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
