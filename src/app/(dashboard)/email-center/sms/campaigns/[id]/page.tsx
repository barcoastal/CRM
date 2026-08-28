import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SendButton } from "./send-button";

export const dynamic = "force-dynamic";

export default async function SmsCampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await prisma.smsCampaign.findUnique({ where: { id } });
  if (!c) notFound();
  const grouped = await prisma.smsMessage.groupBy({ by: ["status"], where: { smsCampaignId: id }, _count: { _all: true } });
  const stats: Record<string, number> = {};
  for (const g of grouped) stats[g.status] = g._count._all;

  const seg = c.segmentId ? await prisma.segment.findUnique({ where: { id: c.segmentId }, select: { name: true } }) : null;
  const card: React.CSSProperties = { background: "#fff", border: "1px solid #e6e8ef", borderRadius: 10, padding: 18, marginBottom: 16 };
  const stat = (label: string, val: number, color = "#0d121c") => (
    <div style={{ flex: 1 }}><div style={{ fontSize: 22, fontWeight: 800, color }}>{val}</div><div style={{ fontSize: 12, color: "#5b6472" }}>{label}</div></div>
  );

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
      <Link href="/email-center/sms/campaigns" style={{ color: "#3052ff", fontSize: 13, textDecoration: "none" }}>&lsaquo; All campaigns</Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", margin: "8px 0 16px" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "#0d121c" }}>{c.name}</h1>
          <p style={{ fontSize: 13, color: "#5b6472", marginTop: 4 }}>
            {c.entity === "Lead" ? "Leads" : "Contacts"}{seg ? ` · ${seg.name}` : " · all with a phone"} · <strong>{c.total}</strong> recipients
          </p>
        </div>
        <SendButton id={c.id} disabled={c.status === "SENT" || c.status === "SENDING"} />
      </div>

      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#5b6472", marginBottom: 8 }}>MESSAGE</div>
        <div style={{ fontSize: 14, color: "#0d121c", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{c.body}</div>
      </div>

      <div style={{ ...card, display: "flex", gap: 12 }}>
        {stat("Recipients", c.total)}
        {stat("Sent", stats.SENT ?? c.sent, "#1a9e4b")}
        {stat("Delivered", stats.DELIVERED ?? 0, "#1a9e4b")}
        {stat("Failed", stats.FAILED ?? c.failed, "#b3261e")}
        {stat("Replies", stats.RECEIVED ?? 0, "#3052ff")}
      </div>
    </div>
  );
}
