"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Msg = {
  id: string;
  direction: string;
  status: string;
  body: string;
  createdAt: string;
  errorReason?: string | null;
};

type Template = { id: string; name: string; body: string };

export type SmsPhone = { label: string; number: string };

/**
 * Two-way SMS conversation panel for record pages (SF parity: the SMS tab on
 * the activity rail). Thread is matched by the counterparty number via
 * /api/sms/thread; sends go through /api/sms/send-now (SMS Magic).
 */
export function SmsRailPanel({
  phones,
  opportunityId,
  leadId,
  accountId,
  contactId,
}: {
  phones: readonly SmsPhone[];
  opportunityId?: string;
  leadId?: string;
  accountId?: string;
  contactId?: string;
}) {
  const [number, setNumber] = useState(phones[0]?.number ?? "");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [senders, setSenders] = useState<{ number: string; label: string | null; isDefault: boolean }[]>([]);
  const [from, setFrom] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (n: string, quiet = false) => {
    if (!n) { setMessages([]); setLoading(false); return; }
    if (!quiet) setLoading(true);
    try {
      const res = await fetch(`/api/sms/thread?number=${encodeURIComponent(n)}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(number);
    const t = setInterval(() => void load(number, true), 12000);
    return () => clearInterval(t);
  }, [number, load]);

  useEffect(() => {
    fetch("/api/email-center/sms-templates")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setTemplates((d.items ?? d.templates ?? []).filter((t: Template & { isActive?: boolean }) => t.isActive !== false)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/sms/senders")
      .then((r) => (r.ok ? r.json() : { senders: [] }))
      .then((d) => {
        const list: { number: string; label: string | null; isDefault: boolean }[] = d.senders ?? [];
        setSenders(list);
        setFrom((prev) => prev || (list.find((s) => s.isDefault)?.number ?? list[0]?.number ?? ""));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, loading]);

  async function send() {
    if (!body.trim() || !number || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/sms/send-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: number,
          body: body.trim(),
          from: from || null,
          opportunityId: opportunityId ?? null,
          leadId: leadId ?? null,
          accountId: accountId ?? null,
          contactId: contactId ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error ?? (res.status === 403 ? "You do not have the SMS.Send permission." : "Send failed."));
      } else {
        setBody("");
      }
      await load(number, true);
    } finally {
      setSending(false);
    }
  }

  if (phones.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#747474", fontSize: 13 }}>
        No phone number on this record. Add a phone to start texting.
      </div>
    );
  }

  const unicode = /[^\x00-\x7F]/.test(body);
  const perSeg = unicode ? 70 : 160;
  const segments = body.length === 0 ? 0 : Math.max(1, Math.ceil(body.length / perSeg));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: 420 }}>
      {/* To + From selectors */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingBottom: 6, borderBottom: "1px solid #f3f3f3" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#444", fontWeight: 600, width: 34 }}>To:</span>
          <select
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            style={{ flex: 1, fontSize: 12, border: "1px solid #c9c9c9", borderRadius: 4, padding: "4px 6px", background: "#fff" }}
          >
            {phones.map((p) => (
              <option key={p.number} value={p.number}>
                {p.label} · {p.number}
              </option>
            ))}
          </select>
        </div>
        {senders.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#444", fontWeight: 600, width: 34 }}>From:</span>
            <select
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{ flex: 1, fontSize: 12, border: "1px solid #c9c9c9", borderRadius: 4, padding: "4px 6px", background: "#fff" }}
            >
              {senders.map((s) => (
                <option key={s.number} value={s.number}>
                  {s.label ? `${s.label} · ${s.number}` : s.number}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Thread */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "8px 4px", background: "#fafaf9" }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "#747474", fontSize: 13 }}>Loading conversation…</div>
        ) : messages.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#747474", fontSize: 13 }}>
            No messages yet with this number. Say hello below.
          </div>
        ) : (
          messages.map((m) => {
            const out = m.direction === "OUTBOUND";
            const failed = m.status === "FAILED";
            return (
              <div key={m.id} style={{ display: "flex", justifyContent: out ? "flex-end" : "flex-start", marginBottom: 6 }}>
                <div
                  style={{
                    maxWidth: "78%",
                    background: failed ? "#fddde0" : out ? "#0176d3" : "#f3f3f3",
                    color: failed ? "#8e030f" : out ? "#fff" : "#181818",
                    borderRadius: out ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
                    padding: "7px 10px",
                    fontSize: 13,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {m.body}
                  <div style={{ fontSize: 10, opacity: 0.75, marginTop: 3, textAlign: "right" }}>
                    {new Date(m.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {out ? ` · ${failed ? `failed${m.errorReason ? `: ${m.errorReason.slice(0, 60)}` : ""}` : m.status.toLowerCase()}` : ""}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <div style={{ borderTop: "1px solid #f3f3f3", paddingTop: 6 }}>
        {templates.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              const t = templates.find((x) => x.id === e.target.value);
              if (t) setBody(t.body);
            }}
            style={{ width: "100%", fontSize: 12, border: "1px solid #c9c9c9", borderRadius: 4, padding: "4px 6px", marginBottom: 6, background: "#fff", color: "#444" }}
          >
            <option value="">Insert a template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
          }}
          placeholder="Type a message or select a template"
          style={{ width: "100%", minHeight: 52, border: "1px solid #c9c9c9", borderRadius: 4, padding: 8, fontSize: 13, resize: "vertical" }}
        />
        {error && <div style={{ fontSize: 12, color: "#8e030f", marginTop: 4 }}>{error}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
          <span style={{ fontSize: 11, color: "#747474" }}>
            {body.length > 0 ? `${body.length} chars · ${segments} segment${segments === 1 ? "" : "s"}${unicode ? " (unicode)" : ""}` : ""}
          </span>
          <button
            onClick={() => void send()}
            disabled={!body.trim() || sending}
            style={{
              background: "#0176d3",
              color: "#fff",
              border: 0,
              padding: "6px 16px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              cursor: body.trim() && !sending ? "pointer" : "not-allowed",
              opacity: body.trim() && !sending ? 1 : 0.5,
            }}
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
