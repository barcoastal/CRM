import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusPill } from "@/components/slds/record-page";
import { sasOutboundMode } from "@/lib/payment-processors/sas-outbound";
import { ramOutboundMode } from "@/lib/payment-processors/ram-outbound";
import { DrainNowButton } from "@/components/payment-processors/drain-now-button";

export const dynamic = "force-dynamic";

/**
 * Processor sync journal - every outbound SAS/RAM payload (DRY_RUN in test
 * mode, real send in live mode). This is the audit surface for approving the
 * exact JSON/SOAP fields before flipping *_OUTBOUND_MODE=live.
 */
export default async function ProcessorLogPage() {
  const [logs, pending, failed] = await Promise.all([
    prisma.processorSyncLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.draft.count({ where: { processorSyncStatus: "PENDING" } }),
    prisma.draft.count({ where: { processorSyncStatus: "FAILED" } }),
  ]);

  const statusTone = (s: string) =>
    s === "SUCCESS" ? "success" : s === "FAILED" ? "danger" : "neutral";

  return (
    <div style={{ padding: 16 }}>
      <div style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 8, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, color: "#444444" }}>Processor Sync Journal</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#181818" }}>
            SAS: {sasOutboundMode() === "live" ? "LIVE" : "Test mode"} · RAM: {ramOutboundMode() === "live" ? "LIVE" : "Test mode"}
          </div>
        </div>
        <div style={{ fontSize: 13, color: "#181818" }}>
          Queue: <b>{pending}</b> pending{failed > 0 && <> · <span style={{ color: "#c23934" }}><b>{failed}</b> failed</span></>}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <DrainNowButton />
          <Link href="/integrations" style={{ fontSize: 13, color: "#0176d3" }}>Credentials</Link>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 8, overflow: "hidden" }}>
        {logs.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#747474", fontSize: 13 }}>
            No outbound calls journaled yet. Skip, edit, or charge a payment and the payload will appear here.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#fafaf9", borderBottom: "1px solid #c9c9c9" }}>
                <th style={th}>When</th>
                <th style={th}>Processor</th>
                <th style={th}>Method</th>
                <th style={th}>Mode</th>
                <th style={th}>Status</th>
                <th style={th}>Drafts</th>
                <th style={th}>Payload</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} style={{ borderBottom: "1px solid #f3f3f3", verticalAlign: "top" }}>
                  <td style={td}>{l.createdAt.toLocaleString()}</td>
                  <td style={td}>{l.provider}</td>
                  <td style={td}>{l.method}</td>
                  <td style={td}>
                    <StatusPill label={l.mode} tone={l.mode === "LIVE" ? "warning" : "neutral"} />
                  </td>
                  <td style={td}>
                    <StatusPill label={l.status} tone={statusTone(l.status)} />
                    {l.error && <div style={{ color: "#c23934", fontSize: 11, marginTop: 4, maxWidth: 220 }}>{l.error}</div>}
                  </td>
                  <td style={td}>{l.draftIds.length}</td>
                  <td style={{ ...td, maxWidth: 520 }}>
                    <details>
                      <summary style={{ cursor: "pointer", color: "#0176d3" }}>view</summary>
                      <pre style={pre}>{JSON.stringify(l.payload, null, 2)}</pre>
                      {l.response != null && (
                        <>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#444444", marginTop: 6 }}>Response</div>
                          <pre style={pre}>{JSON.stringify(l.response, null, 2)}</pre>
                        </>
                      )}
                    </details>
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

const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 11, fontWeight: 700, color: "#444444", textTransform: "uppercase", letterSpacing: 0.4 };
const td: React.CSSProperties = { padding: "8px 10px", color: "#181818" };
const pre: React.CSSProperties = { background: "#f3f3f3", border: "1px solid #e5e5e5", borderRadius: 4, padding: 8, fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-all", margin: "6px 0 0" };
