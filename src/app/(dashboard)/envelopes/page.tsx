/**
 * Cross-account envelope list. SLDS-table parity with the other list pages.
 * Server-rendered. Filter chips for status come from the URL ?status=SENT.
 */
import Link from "next/link";
import { prisma } from "@/lib/prisma";

const STATUSES = ["DRAFT", "SENT", "VIEWED", "SIGNED", "COMPLETED", "VOIDED", "DECLINED"];

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  DRAFT: { bg: "#ecebea", color: "#3e3e3c" },
  SENT: { bg: "#d4ecff", color: "#0a3b6f" },
  VIEWED: { bg: "#fff5d8", color: "#806c00" },
  SIGNED: { bg: "#ddf5d6", color: "#0b683b" },
  COMPLETED: { bg: "#ddf5d6", color: "#0b683b" },
  VOIDED: { bg: "#feded2", color: "#8e1f0b" },
  DECLINED: { bg: "#feded2", color: "#8e1f0b" },
};

export default async function EnvelopesListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; templateId?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status && STATUSES.includes(sp.status) ? sp.status : null;
  const templateId = sp.templateId?.trim() || null;

  const where: Record<string, string> = {};
  if (status) where.status = status;
  if (templateId) where.templateId = templateId;

  const [envelopes, templates] = await Promise.all([
    prisma.envelope.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        documentName: true,
        templateName: true,
        recordType: true,
        signerName: true,
        signerEmail: true,
        status: true,
        sentAt: true,
        createdAt: true,
        opportunity: { select: { id: true, name: true, account: { select: { name: true } } } },
        template: { select: { id: true, name: true } },
      },
    }),
    prisma.envelopeTemplate.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: "#706e6b" }}>E-Sign</div>
          <h1 style={{ margin: 0, fontSize: 20 }}>Envelopes ({envelopes.length})</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/templates/esign" style={btnStyle}>Manage Templates</Link>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <Link href="/envelopes" style={chip(!status && !templateId)}>All</Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/envelopes?status=${s}`} style={chip(status === s)}>{s}</Link>
        ))}
      </div>

      {templates.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "#706e6b", alignSelf: "center" }}>TEMPLATE:</span>
          <Link href={`/envelopes${status ? `?status=${status}` : ""}`} style={chip(!templateId)}>Any</Link>
          {templates.map((t) => {
            const params = new URLSearchParams();
            if (status) params.set("status", status);
            params.set("templateId", t.id);
            return (
              <Link key={t.id} href={`/envelopes?${params.toString()}`} style={chip(templateId === t.id)}>
                {t.name}
              </Link>
            );
          })}
        </div>
      )}

      <article style={{ background: "#fff", border: "1px solid #d8dde6", borderRadius: 4 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#fafaf9", borderBottom: "1px solid #d8dde6" }}>
              <th style={th}>Document</th>
              <th style={th}>Signer</th>
              <th style={th}>Status</th>
              <th style={th}>Sent</th>
              <th style={th}>Opportunity</th>
            </tr>
          </thead>
          <tbody>
            {envelopes.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#706e6b" }}>No envelopes.</td>
              </tr>
            ) : (
              envelopes.map((e) => {
                const tone = STATUS_COLORS[e.status] ?? STATUS_COLORS.DRAFT;
                return (
                  <tr key={e.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                    <td style={td}>
                      <Link href={`/envelopes/${e.id}`} style={{ color: "#0070d2" }}>
                        {e.documentName}
                      </Link>
                      {e.templateName && (
                        <div style={{ fontSize: 11, color: "#706e6b" }}>{e.templateName}</div>
                      )}
                    </td>
                    <td style={td}>
                      <div>{e.signerName}</div>
                      <div style={{ fontSize: 11, color: "#706e6b" }}>{e.signerEmail}</div>
                    </td>
                    <td style={td}>
                      <span style={{
                        background: tone.bg,
                        color: tone.color,
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 600,
                      }}>
                        {e.status}
                      </span>
                    </td>
                    <td style={td}>{e.sentAt ? new Date(e.sentAt).toLocaleDateString() : ""}</td>
                    <td style={td}>
                      {e.opportunity ? (
                        <Link href={`/opportunities/${e.opportunity.id}`} style={{ color: "#0070d2" }}>
                          {e.opportunity.name ?? e.opportunity.account?.name ?? e.opportunity.id.slice(-6)}
                        </Link>
                      ) : (
                        <span style={{ color: "#706e6b" }}>--</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </article>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  fontWeight: 700,
  fontSize: 11,
  color: "#3e3e3c",
  textTransform: "uppercase",
  letterSpacing: 0.3,
};
const td: React.CSSProperties = { padding: "10px 12px", color: "#080707" };
const btnStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #d8dde6",
  color: "#0070d2",
  padding: "4px 12px",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
};
function chip(active: boolean): React.CSSProperties {
  return {
    padding: "4px 12px",
    borderRadius: 16,
    fontSize: 12,
    fontWeight: 600,
    textDecoration: "none",
    background: active ? "#0070d2" : "#fff",
    color: active ? "#fff" : "#3e3e3c",
    border: `1px solid ${active ? "#0070d2" : "#d8dde6"}`,
  };
}
