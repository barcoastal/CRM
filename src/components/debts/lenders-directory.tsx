"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLenders, type DbLender } from "@/lib/use-lenders";
import { isVictoryCreditor } from "@/lib/creditor-agreements";

/**
 * The Lender directory page: every lender we track (DB-backed), searchable,
 * with Legal routing, risk/COJ/TRO flags and notes. Admin roles can edit
 * rows and add new lenders; the contract analyzer also auto-adds funders it
 * meets that are not on the list.
 */

type SortKey = "name" | "aka" | "legal" | "risk" | "flags" | "venue" | "notes";

const COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: "name", label: "Lender" },
  { key: "aka", label: "AKA / DBA" },
  { key: "legal", label: "Legal" },
  { key: "risk", label: "Risk" },
  { key: "flags", label: "Flags" },
  { key: "venue", label: "Sues in" },
  { key: "notes", label: "Notes" },
];

const DEFAULT_WIDTHS: Record<string, number> = {
  name: 220,
  aka: 180,
  legal: 90,
  risk: 60,
  flags: 130,
  venue: 110,
  notes: 420,
};

const legalOf = (l: DbLender): "Victory" | "Citadel" =>
  (l.legal as "Victory" | "Citadel" | null) ?? (isVictoryCreditor(l.name) ? "Victory" : "Citadel");

export function LendersDirectory() {
  const { lenders, canEdit, refresh } = useLenders();
  const [q, setQ] = useState("");
  const [risk, setRisk] = useState("");
  const [onlyCoj, setOnlyCoj] = useState(false);
  const [onlyTro, setOnlyTro] = useState(false);
  const [legal, setLegal] = useState("");
  const [editing, setEditing] = useState<DbLender | "new" | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return DEFAULT_WIDTHS;
    try {
      const raw = window.localStorage.getItem("sf:lenderCols.v1");
      return raw ? { ...DEFAULT_WIDTHS, ...(JSON.parse(raw) as Record<string, number>) } : DEFAULT_WIDTHS;
    } catch {
      return DEFAULT_WIDTHS;
    }
  });
  const dragRef = { current: null as null | { key: string; startX: number; startW: number } };

  const startResize = (key: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const start = { key, startX: e.clientX, startW: widths[key] ?? DEFAULT_WIDTHS[key] ?? 120 };
    const onMove = (ev: PointerEvent) => {
      const w = Math.max(50, start.startW + (ev.clientX - start.startX));
      setWidths((prev) => {
        const next = { ...prev, [key]: w };
        try {
          window.localStorage.setItem("sf:lenderCols.v1", JSON.stringify(next));
        } catch {
          // ignore quota errors
        }
        return next;
      });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    void dragRef;
  };

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    const filtered = lenders.filter((l) => {
      if (n && !`${l.name} ${l.aka ?? ""} ${l.notes ?? ""}`.toLowerCase().includes(n)) return false;
      if (risk && String(l.lienRiskLevel ?? "") !== risk) return false;
      if (onlyCoj && !l.coj) return false;
      if (onlyTro && !l.tro) return false;
      if (legal && legalOf(l) !== legal) return false;
      return true;
    });
    const val = (l: DbLender): string | number => {
      switch (sort.key) {
        case "name": return l.name.toLowerCase();
        case "aka": return (l.aka ?? "").toLowerCase();
        case "legal": return legalOf(l);
        case "risk": return l.lienRiskLevel ?? 99;
        case "flags": return (l.coj ? 2 : 0) + (l.tro ? 1 : 0);
        case "venue": return (l.venue ?? "").toLowerCase() || "zzz";
        case "notes": return (l.notes ?? "").toLowerCase() || "zzz";
      }
    };
    return [...filtered].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (va < vb) return -1 * sort.dir;
      if (va > vb) return 1 * sort.dir;
      return a.name.localeCompare(b.name);
    });
  }, [lenders, q, risk, onlyCoj, onlyTro, legal, sort]);

  const riskChip = (level?: number | null) => {
    if (!level) return null;
    const st =
      level === 1
        ? { bg: "#eaf5ec", color: "#2e844a" }
        : level === 2
        ? { bg: "#fdf3e2", color: "#8c5f10" }
        : { bg: "#fdecea", color: "#c23934" };
    return (
      <span style={{ padding: "1px 10px", borderRadius: 10, background: st.bg, color: st.color, fontSize: 11, fontWeight: 700 }}>
        {level}
      </span>
    );
  };
  const warn = (label: string) => (
    <span style={{ padding: "1px 8px", borderRadius: 10, background: "#fdecea", color: "#c23934", fontSize: 11, fontWeight: 700, marginRight: 4 }}>
      {label}
    </span>
  );

  return (
    <div style={{ padding: 12 }}>
      <div
        style={{
          background: "#fff",
          border: "1px solid #c9c9c9",
          borderRadius: 4,
          padding: "12px 16px",
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#181818", flex: 1 }}>
            Lenders ({rows.length}{rows.length !== lenders.length ? ` of ${lenders.length}` : ""})
          </h1>
          {canEdit && (
            <button onClick={() => setEditing("new")} style={btnPrimary}>
              + New Lender
            </button>
          )}
        </div>
        <p style={{ margin: "4px 0 10px", fontSize: 13, color: "#747474" }}>
          Every lender we track: legal routing, risk level, COJ / TRO exposure, venue and
          negotiation notes. The same data shows next to the creditor picker when adding a debt.
          New funders found by the contract analyzer are added here automatically.
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search lender, alias or note..."
            style={{ height: 32, padding: "0 10px", border: "1px solid #c9c7c5", borderRadius: 4, fontSize: 13, width: 280 }}
          />
          <select value={legal} onChange={(e) => setLegal(e.target.value)} style={sel}>
            <option value="">All legal</option>
            <option value="Victory">Victory</option>
            <option value="Citadel">Citadel</option>
          </select>
          <select value={risk} onChange={(e) => setRisk(e.target.value)} style={sel}>
            <option value="">All risk levels</option>
            <option value="1">Risk 1 - works with us</option>
            <option value="2">Risk 2 - medium</option>
            <option value="3">Risk 3 - aggressive</option>
          </select>
          <label style={chk}>
            <input type="checkbox" checked={onlyCoj} onChange={(e) => setOnlyCoj(e.target.checked)} /> COJ only
          </label>
          <label style={chk}>
            <input type="checkbox" checked={onlyTro} onChange={(e) => setOnlyTro(e.target.checked)} /> TRO only
          </label>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" }}>
          <thead>
            <tr style={{ background: "#fafaf9", borderBottom: "1px solid #c9c9c9" }}>
              {COLUMNS.map((c) => (
                <th key={c.key} style={{ ...th, width: widths[c.key], position: "relative" }}>
                  <button
                    onClick={() => toggleSort(c.key)}
                    style={{
                      background: "none",
                      border: 0,
                      padding: 0,
                      font: "inherit",
                      color: "inherit",
                      textTransform: "inherit",
                      letterSpacing: "inherit",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {c.label}
                    {sort.key === c.key && <span style={{ marginLeft: 4 }}>{sort.dir === 1 ? "▲" : "▼"}</span>}
                  </button>
                  <span
                    onPointerDown={startResize(c.key)}
                    style={{
                      position: "absolute",
                      top: 0,
                      right: -3,
                      width: 7,
                      height: "100%",
                      cursor: "col-resize",
                      zIndex: 2,
                    }}
                  />
                </th>
              ))}
              {canEdit && <th style={{ ...th, width: 60 }} />}
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} style={{ borderBottom: "1px solid #f3f3f3", verticalAlign: "top" }}>
                <td style={{ ...td, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {l.name}
                  {l.source === "CONTRACT_ANALYSIS" && (
                    <span title="Added automatically by the contract analyzer" style={{ marginLeft: 6, fontSize: 10, color: "#3052FF", fontWeight: 700 }}>
                      AI
                    </span>
                  )}
                </td>
                <td style={{ ...td, color: "#747474" }}>{l.aka ?? ""}</td>
                <td style={td}>
                  <span
                    style={{
                      padding: "1px 10px",
                      borderRadius: 10,
                      background: legalOf(l) === "Victory" ? "#eaf5ec" : "#eef1f8",
                      color: legalOf(l) === "Victory" ? "#2e844a" : "#3052FF",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {legalOf(l)}
                  </span>
                </td>
                <td style={td}>{riskChip(l.lienRiskLevel)}</td>
                <td style={{ ...td, overflow: "hidden" }}>
                  {l.coj && warn("COJ")}
                  {l.tro && warn("TRO")}
                  {l.plaidFinicity && (
                    <span style={{ padding: "1px 8px", borderRadius: 10, background: "#eef1f8", color: "#3052FF", fontSize: 11, fontWeight: 700 }}>
                      Plaid
                    </span>
                  )}
                </td>
                <td style={td}>{l.venue ?? ""}</td>
                <td style={{ ...td, lineHeight: 1.5 }}>{l.notes ?? ""}</td>
                {canEdit && (
                  <td style={{ ...td, textAlign: "right" }}>
                    <button onClick={() => setEditing(l)} style={{ background: "none", border: 0, color: "#0176d3", cursor: "pointer", fontSize: 13 }}>
                      Edit
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 8 : 7} style={{ padding: 24, textAlign: "center", color: "#747474" }}>
                  No lenders match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <LenderEditModal
          lender={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function LenderEditModal({
  lender,
  onClose,
  onSaved,
}: {
  lender: DbLender | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [f, setF] = useState({
    name: lender?.name ?? "",
    aka: lender?.aka ?? "",
    lienRiskLevel: lender?.lienRiskLevel ? String(lender.lienRiskLevel) : "",
    coj: lender?.coj ?? false,
    tro: lender?.tro ?? false,
    plaidFinicity: lender?.plaidFinicity ?? false,
    venue: lender?.venue ?? "",
    legal: lender?.legal ?? "",
    notes: lender?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!f.name.trim()) {
      setError("Lender name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = {
        name: f.name,
        aka: f.aka || null,
        lienRiskLevel: f.lienRiskLevel ? Number(f.lienRiskLevel) : null,
        coj: f.coj,
        tro: f.tro,
        plaidFinicity: f.plaidFinicity,
        venue: f.venue || null,
        legal: f.legal || null,
        notes: f.notes || null,
      };
      const res = await fetch(lender ? `/api/lenders/${lender.id}` : "/api/lenders", {
        method: lender ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Could not save.");
        return;
      }
      toast.success(lender ? "Lender updated" : "Lender added");
      await onSaved();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!lender) return;
    if (!confirm(`Delete "${lender.name}" from the lender list?`)) return;
    setBusy(true);
    const res = await fetch(`/api/lenders/${lender.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      toast.success("Lender deleted");
      await onSaved();
    } else {
      toast.error("Could not delete");
    }
  }

  return (
    <div style={overlay} onClick={() => !busy && onClose()}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: "0 0 14px", fontSize: 16, color: "#181818" }}>
          {lender ? `Edit ${lender.name}` : "New Lender"}
        </h2>

        <label style={label}>Lender name</label>
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} style={input} />

        <label style={label}>AKA / DBA (separate with /)</label>
        <input value={f.aka} onChange={(e) => setF({ ...f, aka: e.target.value })} style={input} placeholder="e.g. ODK Capital / Rapid" />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div>
            <label style={label}>Risk level</label>
            <select value={f.lienRiskLevel} onChange={(e) => setF({ ...f, lienRiskLevel: e.target.value })} style={{ ...input, background: "#fff" }}>
              <option value="">Unknown</option>
              <option value="1">1 - works with us</option>
              <option value="2">2 - medium</option>
              <option value="3">3 - aggressive</option>
            </select>
          </div>
          <div>
            <label style={label}>Legal</label>
            <select value={f.legal} onChange={(e) => setF({ ...f, legal: e.target.value })} style={{ ...input, background: "#fff" }}>
              <option value="">Auto (VLP list)</option>
              <option value="Victory">Victory</option>
              <option value="Citadel">Citadel</option>
            </select>
          </div>
          <div>
            <label style={label}>Sues in</label>
            <input value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} style={input} placeholder="NY" />
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, margin: "2px 0 12px" }}>
          <label style={chk}>
            <input type="checkbox" checked={f.coj} onChange={(e) => setF({ ...f, coj: e.target.checked })} /> COJ
          </label>
          <label style={chk}>
            <input type="checkbox" checked={f.tro} onChange={(e) => setF({ ...f, tro: e.target.checked })} /> TRO
          </label>
          <label style={chk}>
            <input type="checkbox" checked={f.plaidFinicity} onChange={(e) => setF({ ...f, plaidFinicity: e.target.checked })} /> Plaid/Finicity
          </label>
        </div>

        <label style={label}>Notes for agents</label>
        <textarea
          value={f.notes}
          onChange={(e) => setF({ ...f, notes: e.target.value })}
          rows={4}
          style={{ ...input, height: "auto", padding: 8, resize: "vertical" }}
          placeholder="Attorneys, tactics, how fast they sue, what settlements they take..."
        />

        {error && <div style={{ margin: "0 0 10px", fontSize: 13, color: "#c23934" }}>{error}</div>}

        <div style={{ display: "flex", gap: 8 }}>
          {lender && (
            <button onClick={remove} disabled={busy} style={{ ...btnGhost, color: "#c23934", marginRight: "auto" }}>
              Delete
            </button>
          )}
          <button onClick={onClose} disabled={busy} style={{ ...btnGhost, marginLeft: lender ? 0 : "auto" }}>
            Cancel
          </button>
          <button onClick={save} disabled={busy} style={btnPrimary}>
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  fontWeight: 700,
  fontSize: 12,
  color: "#444444",
  textTransform: "uppercase",
  letterSpacing: 0.3,
};
const td: React.CSSProperties = { padding: "8px 12px", color: "#181818" };
const sel: React.CSSProperties = { height: 32, padding: "0 8px", border: "1px solid #c9c7c5", borderRadius: 4, fontSize: 13, background: "#fff" };
const chk: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" };
const btnPrimary: React.CSSProperties = { background: "#0176d3", border: "none", padding: "6px 16px", borderRadius: 4, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" };
const btnGhost: React.CSSProperties = { background: "#fff", border: "1px solid #c9c9c9", padding: "6px 16px", borderRadius: 4, fontSize: 13, fontWeight: 600, color: "#444444", cursor: "pointer" };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(8,7,7,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 };
const modal: React.CSSProperties = { background: "#fff", borderRadius: 8, padding: 20, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.2)" };
const label: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: "#444444", margin: "0 0 4px" };
const input: React.CSSProperties = { width: "100%", height: 32, padding: "0 8px", border: "1px solid #c9c7c5", borderRadius: 4, fontSize: 13, marginBottom: 12, boxSizing: "border-box" };
