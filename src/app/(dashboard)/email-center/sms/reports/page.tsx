import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SmsReportsPage() {
  const [byDir, recentCampaigns, last30] = await Promise.all([
    prisma.smsMessage.groupBy({ by: ["direction", "status"], _count: { _all: true } }),
    prisma.smsCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.smsMessage.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } } }),
  ]);

  const n = (dir: string, status?: string) =>
    byDir.filter((g) => g.direction === dir && (!status || g.status === status)).reduce((s, g) => s + g._count._all, 0);

  const outbound = n("OUTBOUND");
  const delivered = n("OUTBOUND", "DELIVERED");
  const sent = n("OUTBOUND", "SENT") + delivered;
  const failed = n("OUTBOUND", "FAILED");
  const inbound = n("INBOUND");
  const deliveryRate = sent + failed > 0 ? Math.round((delivered / (sent + failed)) * 100) : 0;

  const card: React.CSSProperties = { background: "#fff", border: "1px solid #e6e8ef", borderRadius: 10, padding: 18 };
  const big = (label: string, val: string | number, color = "#0d121c") => (
    <div style={card}><div style={{ fontSize: 26, fontWeight: 800, color }}>{val}</div><div style={{ fontSize: 12, color: "#5b6472", marginTop: 2 }}>{label}</div></div>
  );
  const th: React.CSSProperties = { textAlign: "left", padding: "8px 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#5b6472", borderBottom: "1px solid #e6e8ef" };
  const td: React.CSSProperties = { padding: "9px 12px", fontSize: 13, borderBottom: "1px solid #f1f2f6" };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", color: "#0d121c" }}>SMS Reports</h1>
      <p style={{ fontSize: 13, color: "#5b6472", marginBottom: 16 }}>All-time totals across booking texts, flows, campaigns, and agent replies.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        {big("Outbound sent", sent, "#0d121c")}
        {big("Delivered", delivered, "#1a9e4b")}
        {big("Delivery rate", `${deliveryRate}%`, "#1a9e4b")}
        {big("Failed", failed, failed ? "#b3261e" : "#0d121c")}
        {big("Replies in", inbound, "#3052ff")}
        {big("Last 30 days", last30, "#0d121c")}
      </div>

      <div style={{ background: "#fff", border: "1px solid #e6e8ef", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid #eef0f4", fontWeight: 700, fontSize: 14 }}>Recent campaigns</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Name</th><th style={th}>Audience</th><th style={th}>Sent</th><th style={th}>Failed</th><th style={th}>Status</th></tr></thead>
          <tbody>
            {recentCampaigns.map((c) => (
              <tr key={c.id}>
                <td style={td}><Link href={`/email-center/sms/campaigns/${c.id}`} style={{ color: "#3052ff", textDecoration: "none", fontWeight: 600 }}>{c.name}</Link></td>
                <td style={td}>{c.total}</td><td style={{ ...td, fontWeight: 700 }}>{c.sent}</td><td style={td}>{c.failed || "-"}</td><td style={td}>{c.status}</td>
              </tr>
            ))}
            {recentCampaigns.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "#8a94a6", padding: 24 }}>No campaigns yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
