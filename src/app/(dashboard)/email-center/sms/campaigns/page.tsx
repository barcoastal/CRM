import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = { DRAFT: "#8a94a6", SENDING: "#b45309", SENT: "#1a9e4b", FAILED: "#b3261e" };

export default async function SmsCampaignsPage() {
  const items = await prisma.smsCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const th: React.CSSProperties = { textAlign: "left", padding: "8px 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "#5b6472", borderBottom: "1px solid #e6e8ef" };
  const td: React.CSSProperties = { padding: "10px 12px", fontSize: 13, borderBottom: "1px solid #f1f2f6" };
  return (
    <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "#0d121c" }}>SMS Campaigns</h1>
          <p style={{ fontSize: 13, color: "#5b6472", marginTop: 3 }}>One-off text blasts to a segment or list.</p>
        </div>
        <Link href="/email-center/sms/campaigns/new" style={{ background: "#3052ff", color: "#fff", textDecoration: "none", padding: "9px 16px", borderRadius: 8, fontSize: 14, fontWeight: 700 }}>New campaign</Link>
      </div>
      <div style={{ background: "#fff", border: "1px solid #e6e8ef", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Name</th><th style={th}>Audience</th><th style={th}>Sent</th><th style={th}>Failed</th><th style={th}>Status</th><th style={th}>Created</th></tr></thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td style={td}><Link href={`/email-center/sms/campaigns/${c.id}`} style={{ color: "#3052ff", textDecoration: "none", fontWeight: 600 }}>{c.name}</Link></td>
                <td style={td}>{c.total}</td>
                <td style={{ ...td, fontWeight: 700 }}>{c.sent}</td>
                <td style={td}>{c.failed || "-"}</td>
                <td style={td}><span style={{ color: STATUS_COLOR[c.status] ?? "#5b6472", fontWeight: 700, fontSize: 12 }}>{c.status}</span></td>
                <td style={{ ...td, color: "#8a94a6" }}>{c.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#8a94a6", padding: 28 }}>No SMS campaigns yet. Create one to blast a segment.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
