import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SmsFlowsPage() {
  const flows = await prisma.flow.findMany({ orderBy: { updatedAt: "desc" }, take: 200 });
  const smsFlows = flows.filter((f) => {
    const g = f.graph as { nodes?: Array<{ kind?: string }> } | null;
    return Array.isArray(g?.nodes) && g!.nodes!.some((n) => n.kind === "send_sms");
  });

  const th: React.CSSProperties = { textAlign: "left", padding: "8px 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#5b6472", borderBottom: "1px solid #e6e8ef" };
  const td: React.CSSProperties = { padding: "10px 12px", fontSize: 13, borderBottom: "1px solid #f1f2f6" };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "#0d121c" }}>SMS Flows</h1>
          <p style={{ fontSize: 13, color: "#5b6472", marginTop: 3 }}>Automated flows that include a text step. Build a flow and add a &ldquo;Send SMS&rdquo; step.</p>
        </div>
        <Link href="/email-center/flows/new" style={{ background: "#3052ff", color: "#fff", textDecoration: "none", padding: "9px 16px", borderRadius: 8, fontSize: 14, fontWeight: 700 }}>New flow</Link>
      </div>
      <div style={{ background: "#fff", border: "1px solid #e6e8ef", borderRadius: 10, overflow: "hidden", marginTop: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Flow</th><th style={th}>Trigger</th><th style={th}>Entity</th><th style={th}>Active</th></tr></thead>
          <tbody>
            {smsFlows.map((f) => (
              <tr key={f.id}>
                <td style={td}><Link href={`/email-center/flows/${f.id}`} style={{ color: "#3052ff", textDecoration: "none", fontWeight: 600 }}>{f.name}</Link></td>
                <td style={td}>{f.triggerEvent}</td>
                <td style={td}>{f.entityType}</td>
                <td style={td}>{f.isActive ? <span style={{ color: "#1a9e4b", fontWeight: 700 }}>On</span> : <span style={{ color: "#8a94a6" }}>Off</span>}</td>
              </tr>
            ))}
            {smsFlows.length === 0 && <tr><td colSpan={4} style={{ ...td, textAlign: "center", color: "#8a94a6", padding: 26 }}>No SMS flows yet. Create a flow and add a &ldquo;Send SMS&rdquo; step.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
