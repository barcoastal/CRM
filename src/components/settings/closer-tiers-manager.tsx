"use client";

import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { closerDebtRange, closerTierConfigSchema } from "@/lib/closer-tier-config";

export interface TierUser {
  id: string;
  name: string;
  email: string;
  isCloser: boolean;
  closerTier: number | null;
}
type Assignment = { userId: string; tier: number | null; isCloser: boolean };
const colors: Record<number, string> = { 1: "#6956b9", 2: "#0176d3", 3: "#2e844a" };

export function CloserTiersManager({ initialTier1Max, initialTier2Max, users, canEdit = true }: {
  initialTier1Max: number;
  initialTier2Max: number;
  users: TierUser[];
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [small, setSmall] = useState(String(initialTier1Max));
  const [large, setLarge] = useState(String(initialTier2Max));
  const [assignments, setAssignments] = useState<Record<string, Assignment>>(() => Object.fromEntries(
    users.map((u) => [u.id, { userId: u.id, tier: u.closerTier, isCloser: u.isCloser || u.closerTier !== null }]),
  ));
  const [baseline, setBaseline] = useState(() => ({ small: String(initialTier1Max), large: String(initialTier2Max), assignments }));
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [newUser, setNewUser] = useState("");
  const [newTier, setNewTier] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const changed = useMemo(() => Object.values(assignments).filter((a) => {
    const prev = baseline.assignments[a.userId];
    return a.tier !== prev.tier || a.isCloser !== prev.isCloser;
  }), [assignments, baseline]);
  const dirty = small !== baseline.small || large !== baseline.large || changed.length > 0;
  const tier1Max = small === "" ? NaN : Number(small);
  const tier2Max = large === "" ? NaN : Number(large);
  const valid = closerTierConfigSchema.safeParse({ tier1Max, tier2Max, assignments: changed }).success;
  const roster = users.filter((u) => assignments[u.id].isCloser);
  const needle = query.trim().toLowerCase();
  const rows = roster.filter((u) => !needle || `${u.name} ${u.email}`.toLowerCase().includes(needle))
    .sort((a, b) => (assignments[a.id].tier ?? 4) - (assignments[b.id].tier ?? 4) || a.name.localeCompare(b.name));
  const candidates = users.filter((u) => !assignments[u.id].isCloser);

  function change(userId: string, next: Partial<Assignment>) {
    setMessage(null);
    setAssignments((prev) => ({ ...prev, [userId]: { ...prev[userId], ...next } }));
  }
  function addCloser() {
    if (!newUser || !newTier) return;
    change(newUser, { isCloser: true, tier: Number(newTier) });
    setNewUser(""); setNewTier(""); setAdding(false); setQuery("");
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!valid || saving || !canEdit) return;
    setMessage(null); setSaving(true);
    try {
      const response = await fetch("/api/closer-tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier1Max, tier2Max, assignments: changed }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not save closer setup. Please try again.");
      setBaseline({ small, large, assignments });
      setMessage({ ok: true, text: "Closer setup saved. These tiers now apply to client routing." });
      router.refresh();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Could not save closer setup. Please try again." });
    } finally { setSaving(false); }
  }

  return (
    <form className="fm-setup" onSubmit={save}>
      {!canEdit && <div className="fm-notice">You can view closer eligibility here. An administrator can update the roster and debt limits.</div>}
      <section className="fm-card" aria-labelledby="fm-tier-heading">
        <h2 id="fm-tier-heading">Client debt by tier</h2>
        <p className="fm-muted">Set the client debt size each tier handles. Tier 1 is the most senior tier, for the largest clients.</p>
        <div className="fm-tier-grid">
          {[1, 2, 3].map((tier) => (
            <div key={tier} className="fm-tier-card" style={{ "--tier-color": colors[tier] } as CSSProperties}>
              <span className="fm-tier-label">TIER {tier}{tier === 1 ? " · TOP TIER" : ""}</span>
              <strong>{closerDebtRange(tier, tier1Max, tier2Max)}</strong>
              <p>{roster.filter((u) => assignments[u.id].tier === tier).length} assigned · {tier === 1 ? "Largest" : tier === 2 ? "Mid-size" : "Smaller"} clients</p>
            </div>
          ))}
        </div>
        <div className="fm-fields">
          <label htmlFor="fm-small">Tier 2 minimum client debt ($)
            <input id="fm-small" className="fm-input" type="number" min="0" max="2147483647" step="1" required value={small} disabled={!canEdit || saving} onChange={(e) => { setSmall(e.target.value); setMessage(null); }} />
          </label>
          <label htmlFor="fm-large">Tier 1 minimum client debt ($)
            <input id="fm-large" className="fm-input" type="number" min="0" max="2147483647" step="1" required value={large} disabled={!canEdit || saving} onChange={(e) => { setLarge(e.target.value); setMessage(null); }} />
          </label>
        </div>
        <p className="fm-muted" style={{ marginBottom: 0 }}>Clients below the Tier 2 minimum go to Tier 3. The exact cutoff qualifies for the higher tier. Limits apply to every closer in that tier; transfer availability may offer a fallback tier.</p>
        {!valid && <div className="fm-notice fm-error" role="alert" style={{ marginTop: 12 }}>Enter nonnegative whole-dollar limits. The Tier 1 minimum must be greater than the Tier 2 minimum.</div>}
      </section>

      <section className="fm-card" aria-labelledby="fm-roster-heading">
        <div className="fm-toolbar">
          <div>
            <h2 id="fm-roster-heading">Closer Setup <span style={{ color: "#606b79", fontSize: 13, fontWeight: 400 }}>· {roster.length} closers</span></h2>
            <p className="fm-muted" style={{ marginBottom: 0 }}>Assign each closer a tier to set which clients they can handle.</p>
          </div>
          {canEdit && <button type="button" className="fm-button fm-button-secondary" disabled={saving || candidates.length === 0} onClick={() => setAdding(!adding)}>{adding ? "Cancel" : "+ Add closer"}</button>}
        </div>
        {adding && canEdit && (
          <div className="fm-add-closer">
            <select aria-label="User to add as a closer" className="fm-input" value={newUser} disabled={saving} onChange={(e) => setNewUser(e.target.value)}>
              <option value="">Choose a CRM user…</option>
              {candidates.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.email}</option>)}
            </select>
            <select aria-label="Tier for new closer" className="fm-input" value={newTier} disabled={saving} onChange={(e) => setNewTier(e.target.value)}>
              <option value="">Choose a tier…</option>
              {[1, 2, 3].map((tier) => <option key={tier} value={tier}>Tier {tier} · {closerDebtRange(tier, tier1Max, tier2Max)}</option>)}
            </select>
            <button type="button" className="fm-button" disabled={!newUser || !newTier || saving || !valid} onClick={addCloser}>Add to roster</button>
          </div>
        )}
        <input className="fm-input" aria-label="Search closers" placeholder="Search closer name or email" value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: 280, marginBottom: 14 }} />
        <div className="fm-table-wrap">
          <table className="fm-table">
            <thead><tr><th scope="col">Closer</th><th scope="col">Assigned tier</th><th scope="col">Client debt they handle</th>{canEdit && <th scope="col"><span className="sr-only">Actions</span></th>}</tr></thead>
            <tbody>
              {rows.map((user) => {
                const tier = assignments[user.id].tier;
                return (
                  <tr key={user.id}>
                    <td><strong>{user.name}</strong><small>{user.email}</small></td>
                    <td><select aria-label={`Tier for ${user.name}`} className="fm-input" value={tier ?? ""} disabled={!canEdit || saving} onChange={(e) => change(user.id, { tier: e.target.value ? Number(e.target.value) : null })}>
                      <option value="">Unassigned</option>
                      <option value="1">Tier 1 · Top tier</option><option value="2">Tier 2</option><option value="3">Tier 3</option>
                    </select></td>
                    <td className="fm-debt-range">{closerDebtRange(tier, tier1Max, tier2Max)}</td>
                    {canEdit && <td style={{ textAlign: "right" }}><button type="button" className="fm-remove" aria-label={`Remove ${user.name} from closer roster`} disabled={saving} onClick={() => change(user.id, { isCloser: false, tier: null })}>Remove</button></td>}
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={canEdit ? 4 : 3} className="fm-empty">{needle ? "No closers match your search." : "No closers set up yet. Add a CRM user and choose their tier."}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {message && <div role={message.ok ? "status" : "alert"} className={`fm-notice ${message.ok ? "fm-success" : "fm-error"}`}>{message.text}</div>}
      {canEdit && <div className="fm-actions">
        <button className="fm-button" type="submit" disabled={saving || !dirty || !valid}>{saving ? "Saving…" : "Save closer setup"}</button>
        {dirty && <button className="fm-button fm-button-secondary" type="button" disabled={saving} onClick={() => {
          setSmall(baseline.small); setLarge(baseline.large); setAssignments(baseline.assignments); setMessage(null); setAdding(false);
        }}>Discard changes</button>}
        {dirty && <span style={{ fontSize: 13, color: "#7c5800" }}>Unsaved changes · Save to apply tiers and debt limits.</span>}
      </div>}
    </form>
  );
}
