"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Convo {
  key: string; number: string; name: string | null;
  leadId: string | null; accountId: string | null;
  lastBody: string; lastAt: string; lastDir: string; unread: number;
}
interface Msg { id: string; direction: string; status: string; body: string; createdAt: string; errorReason: string | null }

const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const prettyNumber = (n: string) => { const d = n.replace(/[^0-9]/g, ""); const t = d.length > 10 ? d.slice(-10) : d; return t.length === 10 ? `(${t.slice(0, 3)}) ${t.slice(3, 6)}-${t.slice(6)}` : n; };

export default function SmsConsolePage() {
  const [convos, setConvos] = useState<Convo[]>([]);
  const [active, setActive] = useState<Convo | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const loadConvos = useCallback(async () => {
    const d = await fetch("/api/sms/conversations").then((r) => (r.ok ? r.json() : { conversations: [] })).catch(() => ({ conversations: [] }));
    setConvos(d.conversations ?? []);
  }, []);

  const loadThread = useCallback(async (number: string) => {
    const d = await fetch(`/api/sms/thread?number=${encodeURIComponent(number)}`).then((r) => (r.ok ? r.json() : { messages: [] })).catch(() => ({ messages: [] }));
    setMsgs(d.messages ?? []);
  }, []);

  useEffect(() => { void loadConvos(); const id = setInterval(loadConvos, 15000); return () => clearInterval(id); }, [loadConvos]);
  useEffect(() => {
    if (!active) return;
    void loadThread(active.number);
    const id = setInterval(() => loadThread(active.number), 8000);
    return () => clearInterval(id);
  }, [active, loadThread]);
  useEffect(() => { if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight; }, [msgs]);

  async function send() {
    if (!active || !draft.trim()) return;
    setSending(true); setErr(null);
    try {
      const res = await fetch("/api/sms/send-now", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: active.number, body: draft.trim(), leadId: active.leadId, accountId: active.accountId }),
      });
      if (res.ok) { setDraft(""); await loadThread(active.number); await loadConvos(); }
      else setErr((await res.json().catch(() => ({}))).error ?? "Send failed.");
    } finally { setSending(false); }
  }

  const th: React.CSSProperties = { display: "flex", flexDirection: "column", height: "calc(100vh - 130px)", minHeight: 420 };
  return (
    <div>
      <header style={{ background: "#fff", padding: "14px 20px", border: "1px solid #c9c9c9", borderRadius: 4, marginBottom: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#181818", margin: 0 }}>Text Messages</h1>
        <p style={{ fontSize: 13, color: "#747474", marginTop: 3 }}>Two-way SMS via SMS Magic. Replies land here automatically.</p>
      </header>

      <div style={{ display: "flex", gap: 12, ...th }}>
        {/* Conversation list */}
        <div style={{ width: 320, background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, overflowY: "auto" }}>
          {convos.length === 0 && <div style={{ padding: 20, color: "#747474", fontSize: 13, textAlign: "center" }}>No conversations yet.</div>}
          {convos.map((c) => {
            const on = active?.key === c.key;
            return (
              <button key={c.key} onClick={() => setActive(c)}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", border: 0, borderBottom: "1px solid #f1f1f1", background: on ? "#eef4ff" : "#fff", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#181818" }}>{c.name ?? prettyNumber(c.number)}</span>
                  {c.unread > 0 && <span style={{ background: "#0176d3", color: "#fff", borderRadius: 9, fontSize: 11, fontWeight: 700, padding: "0 6px" }}>{c.unread}</span>}
                </div>
                <div style={{ fontSize: 12, color: "#747474", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.lastDir === "INBOUND" ? "" : "You: "}{c.lastBody}
                </div>
                <div style={{ fontSize: 11, color: "#a0a0a0", marginTop: 2 }}>{c.name ? prettyNumber(c.number) + " · " : ""}{fmt(c.lastAt)}</div>
              </button>
            );
          })}
        </div>

        {/* Thread + compose */}
        <div style={{ flex: 1, background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, display: "flex", flexDirection: "column", minWidth: 320 }}>
          {!active ? (
            <div style={{ margin: "auto", color: "#747474", fontSize: 14 }}>Select a conversation.</div>
          ) : (
            <>
              <div style={{ padding: "10px 14px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{active.name ?? prettyNumber(active.number)}</div>
                  <div style={{ fontSize: 12, color: "#747474" }}>{prettyNumber(active.number)}</div>
                </div>
                {active.leadId ? <Link href={`/leads/${active.leadId}`} style={{ color: "#0176d3", fontSize: 12, textDecoration: "none" }}>Open lead</Link>
                  : active.accountId ? <Link href={`/accounts/${active.accountId}`} style={{ color: "#0176d3", fontSize: 12, textDecoration: "none" }}>Open account</Link> : null}
              </div>
              <div ref={threadRef} style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 8, background: "#fafbfc" }}>
                {msgs.map((m) => {
                  const out = m.direction === "OUTBOUND";
                  return (
                    <div key={m.id} style={{ alignSelf: out ? "flex-end" : "flex-start", maxWidth: "72%" }}>
                      <div style={{ background: out ? "#0176d3" : "#fff", color: out ? "#fff" : "#181818", border: out ? 0 : "1px solid #e0e0e0", borderRadius: 12, padding: "8px 12px", fontSize: 14, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>{m.body}</div>
                      <div style={{ fontSize: 10.5, color: "#a0a0a0", marginTop: 2, textAlign: out ? "right" : "left" }}>
                        {fmt(m.createdAt)}{out ? ` · ${m.status === "FAILED" ? "failed" : m.status.toLowerCase()}` : ""}
                      </div>
                    </div>
                  );
                })}
                {msgs.length === 0 && <div style={{ margin: "auto", color: "#a0a0a0", fontSize: 13 }}>No messages yet.</div>}
              </div>
              <div style={{ borderTop: "1px solid #eee", padding: 10 }}>
                {err && <div style={{ color: "#c0392b", fontSize: 12, marginBottom: 6 }}>{err}</div>}
                <div style={{ display: "flex", gap: 8 }}>
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} placeholder="Type a message..."
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                    style={{ flex: 1, border: "1px solid #cfd6e4", borderRadius: 6, padding: "8px 10px", fontSize: 14, resize: "none", fontFamily: "inherit" }} />
                  <button onClick={send} disabled={sending || !draft.trim()}
                    style={{ background: "#0176d3", color: "#fff", border: 0, borderRadius: 6, padding: "0 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: sending || !draft.trim() ? 0.5 : 1 }}>
                    {sending ? "..." : "Send"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
