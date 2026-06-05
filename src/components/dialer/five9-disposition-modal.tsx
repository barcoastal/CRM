"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FIVE9_TO_CRM_DISPOSITION } from "@/lib/five9/disposition-map";

interface Props {
  open: boolean;
  callId: string;
  leadId?: string | null;
  phone: string;
  onClose: () => void;
  onSaved?: () => void;
}

/**
 * Five9-native disposition modal that pops after hangup.
 * Lists all 30 mapped + every Five9 raw disposition the agent can pick.
 * Selecting a mapped one fires the CRM lead pipeline; selecting an unmapped
 * one just saves to Five9.
 */
export function Five9DispositionModal({ open, callId, leadId, phone, onClose, onSaved }: Props) {
  const [selected, setSelected] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");

  // Group: mapped first (with green pill), then unmapped Five9-only
  const mappedKeys = useMemo(() => Object.keys(FIVE9_TO_CRM_DISPOSITION), []);

  const visibleMapped = useMemo(() => {
    const f = filter.toLowerCase().trim();
    if (!f) return mappedKeys;
    return mappedKeys.filter((k) => k.toLowerCase().includes(f) || FIVE9_TO_CRM_DISPOSITION[k].toLowerCase().includes(f));
  }, [filter, mappedKeys]);

  async function save() {
    if (!selected) {
      toast.error("Pick a disposition");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/dialer/five9/agent/set-disposition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId, dispositionName: selected, notes, leadId }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; mirrored?: boolean };
      if (!data.ok) {
        toast.error(data.error ?? "Failed to save disposition");
      } else {
        toast.success(data.mirrored ? `Logged in Five9 + CRM as ${selected}` : `Logged in Five9 as ${selected}`);
        onSaved?.();
        onClose();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #ecebea" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Log call disposition</h2>
          <div style={{ color: "#706e6b", fontSize: 13, marginTop: 4 }}>{phone}</div>
        </div>

        <div style={{ padding: 20 }}>
          <label style={lbl}>Search</label>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter dispositions…"
            style={input}
          />

          <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid #d8dde6", borderRadius: 4, marginTop: 8 }}>
            {visibleMapped.map((five9Name) => {
              const crm = FIVE9_TO_CRM_DISPOSITION[five9Name];
              const isSelected = selected === five9Name;
              return (
                <button
                  key={five9Name}
                  onClick={() => setSelected(five9Name)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 12px",
                    border: 0,
                    borderBottom: "1px solid #ecebea",
                    background: isSelected ? "#eaf5fe" : "#fff",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontWeight: isSelected ? 600 : 400 }}>{five9Name}</span>
                  <span style={{ fontSize: 11, color: "#04844b", background: "#d4f1e3", padding: "2px 6px", borderRadius: 10 }}>
                    → {crm}
                  </span>
                </button>
              );
            })}
            {visibleMapped.length === 0 && (
              <div style={{ padding: 12, fontSize: 13, color: "#706e6b" }}>No matches.</div>
            )}
          </div>

          <label style={{ ...lbl, marginTop: 12 }}>Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            style={{ ...input, height: "auto", fontFamily: "inherit" }}
          />
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid #ecebea", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} disabled={busy} style={btnSecondary}>Cancel</button>
          <button onClick={save} disabled={busy || !selected} style={btnPrimary}>Save</button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  zIndex: 9000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const modal: React.CSSProperties = {
  background: "#fff",
  borderRadius: 8,
  width: 540,
  maxWidth: "90vw",
  maxHeight: "85vh",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};
const lbl: React.CSSProperties = { display: "block", fontSize: 11, color: "#706e6b", marginBottom: 4, marginTop: 4 };
const input: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  border: "1px solid #d8dde6",
  borderRadius: 4,
  fontSize: 13,
  boxSizing: "border-box",
};
const btnPrimary: React.CSSProperties = {
  background: "#0070d2",
  color: "#fff",
  padding: "8px 16px",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  border: 0,
  cursor: "pointer",
};
const btnSecondary: React.CSSProperties = {
  background: "#fff",
  color: "#0070d2",
  padding: "8px 16px",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  border: "1px solid #0070d2",
  cursor: "pointer",
};
