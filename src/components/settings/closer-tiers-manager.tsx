"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export interface TierUser {
  id: string;
  name: string;
  email: string;
  isCloser: boolean;
  closerTier: number | null;
}

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

export function CloserTiersManager({
  initialTier1Max,
  initialTier2Max,
  users,
}: {
  initialTier1Max: number;
  initialTier2Max: number;
  users: TierUser[];
}) {
  const router = useRouter();
  const [tier1Max, setTier1Max] = useState(initialTier1Max);
  const [tier2Max, setTier2Max] = useState(initialTier2Max);
  const [tiers, setTiers] = useState<Record<string, number | null>>(
    Object.fromEntries(users.map((u) => [u.id, u.closerTier])),
  );
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return users
      .filter((u) => (showAll ? true : u.isCloser || tiers[u.id] != null))
      .filter((u) => !needle || u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle))
      .sort((a, b) => {
        const ta = tiers[a.id] ?? 99;
        const tb = tiers[b.id] ?? 99;
        return ta === tb ? a.name.localeCompare(b.name) : ta - tb;
      });
  }, [users, q, showAll, tiers]);

  const counts = useMemo(() => {
    const c = { 1: 0, 2: 0, 3: 0 } as Record<number, number>;
    Object.values(tiers).forEach((t) => { if (t) c[t] = (c[t] ?? 0) + 1; });
    return c;
  }, [tiers]);

  async function save() {
    setMsg(null);
    if (tier2Max <= tier1Max) { setMsg("Tier 2 cutoff must be greater than Tier 1 cutoff."); return; }
    setSaving(true);
    try {
      const assignments = users.map((u) => ({ userId: u.id, tier: tiers[u.id] ?? null }));
      const res = await fetch("/api/closer-tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier1Max, tier2Max, assignments }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setMsg(e.error ?? "Save failed.");
      } else {
        setMsg("Saved.");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  const card: React.CSSProperties = { background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, padding: 16, marginBottom: 16 };
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#444", display: "block", marginBottom: 4 };
  const input: React.CSSProperties = { border: "1px solid #c9c9c9", borderRadius: 4, padding: "6px 8px", fontSize: 13, width: 160 };

  return (
    <div>
      {/* Debt cutoffs */}
      <div style={card}>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 4px" }}>Debt cutoffs</h2>
        <p style={{ fontSize: 12, color: "#747474", margin: "0 0 12px" }}>
          A deal routes to <strong>Tier 1</strong> under {money(tier1Max)}, <strong>Tier 2</strong> from{" "}
          {money(tier1Max)} to {money(tier2Max)}, and <strong>Tier 3</strong> at {money(tier2Max)} and above.
        </p>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div>
            <label style={label}>Tier 1 upper limit</label>
            <input style={input} type="number" value={tier1Max} onChange={(e) => setTier1Max(Number(e.target.value))} />
          </div>
          <div>
            <label style={label}>Tier 2 upper limit</label>
            <input style={input} type="number" value={tier2Max} onChange={(e) => setTier2Max(Number(e.target.value))} />
          </div>
        </div>
      </div>

      {/* Closer assignments */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
            Closer tiers{" "}
            <span style={{ fontWeight: 400, color: "#747474", fontSize: 12 }}>
              (T1: {counts[1]} · T2: {counts[2]} · T3: {counts[3]})
            </span>
          </h2>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              placeholder="Search name or email"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ ...input, width: 200 }}
            />
            <label style={{ fontSize: 12, color: "#444", display: "inline-flex", gap: 4, alignItems: "center" }}>
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> show all users
            </label>
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#444", borderBottom: "1px solid #e5e5e5" }}>
              <th style={{ padding: "6px 8px" }}>Name</th>
              <th style={{ padding: "6px 8px" }}>Email</th>
              <th style={{ padding: "6px 8px", width: 160 }}>Tier</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} style={{ borderBottom: "1px solid #f1f1f1" }}>
                <td style={{ padding: "6px 8px", fontWeight: 600 }}>{u.name}</td>
                <td style={{ padding: "6px 8px", color: "#747474" }}>{u.email}</td>
                <td style={{ padding: "6px 8px" }}>
                  <select
                    value={tiers[u.id] ?? ""}
                    onChange={(e) => setTiers((p) => ({ ...p, [u.id]: e.target.value ? Number(e.target.value) : null }))}
                    style={{ ...input, width: 150 }}
                  >
                    <option value="">Not a closer</option>
                    <option value="1">Tier 1</option>
                    <option value="2">Tier 2</option>
                    <option value="3">Tier 3</option>
                  </select>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={3} style={{ padding: 16, color: "#747474", textAlign: "center" }}>No matching users.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{ background: "#0176d3", color: "#fff", border: 0, borderRadius: 4, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
        {msg && <span style={{ fontSize: 13, color: msg === "Saved." ? "#2e844a" : "#ba0517" }}>{msg}</span>}
      </div>
    </div>
  );
}
