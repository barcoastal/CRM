"use client";

import { useCallback, useEffect, useState } from "react";

interface SasCustomer {
  customerstatus?: string;
  display?: string;
  company?: string;
  city?: string;
  state?: string;
  phone1?: string;
  email?: string;
  isflagged?: boolean;
  isaudited?: boolean;
  lastaction?: string;
  totalfailed?: number;
  totaldebt?: number;
  totaldebits?: number;
  totalfees?: number;
  totalcitadel?: number;
  balance?: number;
  balance_earmark?: number;
}
interface SasDebit {
  total?: number;
  debitdate?: string;
  status?: string;
  reasonmessage?: string;
  datecleared?: string;
  transactionid?: string;
}
interface SasResponse {
  linked?: boolean;
  customer?: SasCustomer | null;
  debits?: SasDebit[];
  error?: string;
}

function money(n: number | undefined | null): string {
  return `$${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function date(s: string | undefined): string {
  if (!s) return "-";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}
/** NSF / returned = anything that isn't a clean success/pending. */
function isNsf(d: SasDebit): boolean {
  const s = `${d.status ?? ""} ${d.reasonmessage ?? ""}`.toLowerCase();
  if (/success|cleared|pending|scheduled|posted|settled/.test(s)) return false;
  return /nsf|return|fail|reject|insufficient|r\d{2}/.test(s) || (!!d.status && d.status.toLowerCase() !== "successful" && !!d.reasonmessage);
}

export function SasDetailsPanel({ accountId }: { accountId: string }) {
  const [data, setData] = useState<SasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts/${accountId}/sas`);
      const j = (await res.json()) as SasResponse;
      if (!res.ok) setError(j.error ?? "Could not load SAS data");
      setData(j);
    } catch {
      setError("Network error loading SAS data");
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void load();
  }, [load]);

  const c = data?.customer ?? null;
  const debits = data?.debits ?? [];
  const nsfDrafts = debits.filter(isNsf);
  const nsfCount = nsfDrafts.length; // consistent with the rows highlighted below

  return (
    <div style={wrap}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#080707" }}>Payment Processor (SAS)</h3>
        <button onClick={() => void load()} disabled={loading} style={refreshBtn}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      {!loading && !error && !c && (
        <div style={{ fontSize: 13, color: "#706e6b" }}>
          {data?.linked === false
            ? "This account isn't linked to a SAS customer (no Salesforce/SAS id)."
            : "No matching SAS customer found."}
        </div>
      )}

      {c && (
        <>
          {/* Status + NSF banner */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <span style={statusBadge(c.customerstatus)}>{c.customerstatus ?? "Unknown"}</span>
            {nsfCount > 0 && (
              <span style={nsfBadge}>
                {nsfCount} failed / NSF draft{nsfCount === 1 ? "" : "s"}
              </span>
            )}
            {c.isflagged && <span style={flagBadge}>Flagged</span>}
            {c.isaudited && <span style={okBadge}>Audited</span>}
          </div>

          {/* Totals / balance breakdown */}
          <div style={grid}>
            <Stat label="Escrow Balance" value={money(c.balance)} big />
            <Stat label="Earmarked" value={money(c.balance_earmark)} />
            <Stat label="Available" value={money((c.balance ?? 0) - (c.balance_earmark ?? 0))} />
            <Stat label="Total Debt" value={money(c.totaldebt)} />
            <Stat label="Total Drafted" value={money(c.totaldebits)} />
            <Stat label="Total Fees" value={money(c.totalfees)} />
            <Stat label="Citadel Fees" value={money(c.totalcitadel)} />
            <Stat label="Last Activity" value={date(c.lastaction)} />
          </div>

          {/* Draft history */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#3e3e3c", marginBottom: 6 }}>
              Draft History ({debits.length})
            </div>
            {debits.length === 0 ? (
              <div style={{ fontSize: 13, color: "#706e6b" }}>No drafts on record.</div>
            ) : (
              <div style={{ overflowX: "auto", border: "1px solid #e5e5e5", borderRadius: 4 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#fafaf9", borderBottom: "1px solid #d8dde6" }}>
                      <th style={th}>Date</th>
                      <th style={th}>Amount</th>
                      <th style={th}>Status</th>
                      <th style={th}>Reason</th>
                      <th style={th}>Cleared</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debits.slice(0, 60).map((d, i) => {
                      const nsf = isNsf(d);
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid #f3f3f3", background: nsf ? "#fdecea" : undefined }}>
                          <td style={td}>{date(d.debitdate)}</td>
                          <td style={td}>{money(d.total)}</td>
                          <td style={{ ...td, fontWeight: 600, color: statusColor(d.status, nsf) }}>
                            {d.status ?? "-"}
                          </td>
                          <td style={{ ...td, color: nsf ? "#c23934" : "#3e3e3c" }}>{d.reasonmessage ?? "-"}</td>
                          <td style={td}>{date(d.datecleared)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#706e6b", textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontSize: big ? 18 : 14, fontWeight: 700, color: "#080707" }}>{value}</div>
    </div>
  );
}

const wrap: React.CSSProperties = { background: "#fff", border: "1px solid #dddbda", borderRadius: 4, padding: 16, marginBottom: 10 };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 };
const th: React.CSSProperties = { textAlign: "left", padding: "7px 10px", fontWeight: 700, fontSize: 11, color: "#3e3e3c", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "7px 10px", color: "#080707", whiteSpace: "nowrap" };
const refreshBtn: React.CSSProperties = { background: "#fff", border: "1px solid #d8dde6", padding: "4px 12px", borderRadius: 4, fontSize: 13, fontWeight: 600, color: "#0070d2", cursor: "pointer" };
const errorBox: React.CSSProperties = { background: "#fdecea", border: "1px solid #f5c2c0", borderRadius: 4, padding: "8px 12px", fontSize: 13, color: "#c23934", marginBottom: 12 };
const nsfBadge: React.CSSProperties = { background: "#c23934", color: "#fff", padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 700 };
const flagBadge: React.CSSProperties = { background: "#fe9339", color: "#fff", padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 700 };
const okBadge: React.CSSProperties = { background: "#eef4fb", color: "#0070d2", padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600 };
/** Color a draft status: success green, failed/NSF red, everything else neutral. */
function statusColor(status: string | undefined, nsf: boolean): string {
  if (nsf) return "#c23934";
  const s = (status ?? "").toLowerCase();
  if (/success|cleared|settled|posted/.test(s)) return "#2e844a";
  return "#706e6b";
}

function statusBadge(status?: string): React.CSSProperties {
  const s = (status ?? "").toLowerCase();
  const active = s.includes("active");
  const dead = s.includes("cancel") || s.includes("closed") || s.includes("terminat");
  return {
    background: active ? "#2e844a" : dead ? "#706e6b" : "#fe9339",
    color: "#fff",
    padding: "3px 12px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 700,
  };
}
