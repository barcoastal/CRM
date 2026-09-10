"use client";

/**
 * Flow Reply War Room: a shared team queue of all inbound email + SMS in one
 * unified list, with inline reply. Email replies go via the agent's Gmail
 * (/api/emails/gmail/send); SMS replies via SMS Magic (/api/sms/send-now).
 * Polls every 15s so new inbound surfaces live.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface Convo {
  kind: "email" | "sms";
  key: string;
  title: string;
  sub: string;
  snippet: string;
  lastAt: string;
  unread: number;
  emailFrom?: string;
  emailSubject?: string;
  smsNumber?: string;
}

interface EmailMsg {
  id: string;
  direction: string;
  fromAddress: string;
  toAddresses: string;
  subject: string;
  bodyText: string | null;
  bodyHtml: string | null;
  createdAt: string;
}
interface SmsMsg {
  id: string;
  direction: string;
  status: string;
  body: string;
  createdAt: string;
}

function displayName(raw: string): string {
  const m = raw.match(/^\s*"?([^"<]+?)"?\s*</);
  if (m) return m[1].trim();
  const at = raw.indexOf("@");
  return at > 0 ? raw.slice(0, at) : raw;
}
function relTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function WarRoomClient() {
  const [convos, setConvos] = useState<Convo[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Convo | null>(null);
  const [emailMsgs, setEmailMsgs] = useState<EmailMsg[]>([]);
  const [smsMsgs, setSmsMsgs] = useState<SmsMsg[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const selRef = useRef<Convo | null>(null);
  selRef.current = sel;

  const loadConvos = useCallback(async () => {
    const [emailRes, smsRes] = await Promise.all([
      fetch("/api/war-room/emails").then((r) => (r.ok ? r.json() : { conversations: [] })).catch(() => ({ conversations: [] })),
      fetch("/api/sms/conversations").then((r) => (r.ok ? r.json() : { conversations: [] })).catch(() => ({ conversations: [] })),
    ]);
    const emailConvos: Convo[] = (emailRes.conversations ?? []).map((c: {
      threadId: string; from: string; name: string | null; subject: string; snippet: string; lastAt: string; unread: number;
    }) => ({
      kind: "email" as const,
      key: `email:${c.threadId}`,
      title: c.name ?? displayName(c.from),
      sub: c.from,
      snippet: c.subject ? `${c.subject}${c.snippet ? " — " + c.snippet : ""}` : c.snippet,
      lastAt: c.lastAt,
      unread: c.unread,
      emailFrom: c.from,
      emailSubject: c.subject,
    }));
    const smsConvos: Convo[] = (smsRes.conversations ?? []).map((c: {
      key: string; number: string; name: string | null; lastBody: string; lastAt: string; unread: number;
    }) => ({
      kind: "sms" as const,
      key: `sms:${c.key}`,
      title: c.name ?? c.number,
      sub: c.number,
      snippet: c.lastBody,
      lastAt: typeof c.lastAt === "string" ? c.lastAt : new Date(c.lastAt).toISOString(),
      unread: c.unread,
      smsNumber: c.number,
    }));
    const merged = [...emailConvos, ...smsConvos].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
    setConvos(merged);
    setLoading(false);
  }, []);

  const openConvo = useCallback(async (c: Convo) => {
    setSel(c);
    setReply("");
    if (c.kind === "email") {
      setSmsMsgs([]);
      const threadId = c.key.slice("email:".length);
      const data = await fetch(`/api/war-room/emails?threadId=${encodeURIComponent(threadId)}`).then((r) => r.json()).catch(() => ({ items: [] }));
      setEmailMsgs(data.items ?? []);
    } else {
      setEmailMsgs([]);
      const data = await fetch(`/api/sms/thread?number=${encodeURIComponent(c.smsNumber ?? "")}`).then((r) => r.json()).catch(() => ({ messages: [] }));
      setSmsMsgs(data.messages ?? []);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load
    void loadConvos();
    const t = setInterval(() => {
      void loadConvos();
      const cur = selRef.current;
      if (cur) void openConvo(cur);
    }, 15000);
    return () => clearInterval(t);
  }, [loadConvos, openConvo]);

  async function send() {
    if (!sel || !reply.trim()) return;
    setSending(true);
    try {
      if (sel.kind === "email") {
        const last = emailMsgs[emailMsgs.length - 1];
        const subject = /^re:/i.test(sel.emailSubject ?? "") ? (sel.emailSubject ?? "") : `Re: ${sel.emailSubject ?? ""}`.trim();
        const res = await fetch("/api/emails/gmail/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: [sel.emailFrom],
            subject,
            bodyHtml: `<p>${reply.replace(/\n/g, "<br/>")}</p>`,
            bodyText: reply,
            replyToMessageId: last?.id,
          }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok || d.error || d.ok === false) { toast.error(d.error ?? "Email failed"); return; }
      } else {
        const res = await fetch("/api/sms/send-now", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: sel.smsNumber, body: reply }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok || d.error) { toast.error(d.error ?? "SMS failed"); return; }
      }
      setReply("");
      toast.success("Sent");
      await openConvo(sel);
      await loadConvos();
    } finally {
      setSending(false);
    }
  }

  const totalUnread = convos.reduce((n, c) => n + c.unread, 0);

  return (
    <div style={{ display: "flex", height: "calc(100vh - 120px)", background: "#fff", border: "1px solid #d8dde6", borderRadius: 6, overflow: "hidden" }}>
      {/* Conversation list */}
      <div style={{ width: 340, borderRight: "1px solid #e5e5e5", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e5e5", fontWeight: 700, fontSize: 14, display: "flex", justifyContent: "space-between" }}>
          <span>Inbound {totalUnread > 0 ? <span style={{ color: "#c23934" }}>({totalUnread})</span> : null}</span>
          <button onClick={() => void loadConvos()} style={{ background: "none", border: "none", color: "#0176d3", cursor: "pointer", fontSize: 12 }}>Refresh</button>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div style={{ padding: 20, color: "#747474", fontSize: 13 }}>Loading...</div>
          ) : convos.length === 0 ? (
            <div style={{ padding: 20, color: "#747474", fontSize: 13 }}>No inbound conversations.</div>
          ) : (
            convos.map((c) => (
              <button
                key={c.key}
                onClick={() => void openConvo(c)}
                style={{
                  display: "block", width: "100%", textAlign: "left", padding: "10px 14px",
                  borderBottom: "1px solid #f3f3f3", background: sel?.key === c.key ? "#f3f6fc" : c.unread > 0 ? "#fffdf3" : "#fff",
                  cursor: "pointer", border: "none", borderLeft: sel?.key === c.key ? "3px solid #0176d3" : "3px solid transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 8, background: c.kind === "email" ? "#eef1f8" : "#eaf5ec", color: c.kind === "email" ? "#3052FF" : "#2e844a" }}>
                    {c.kind === "email" ? "EMAIL" : "SMS"}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
                  <span style={{ fontSize: 11, color: "#747474" }}>{relTime(c.lastAt)}</span>
                  {c.unread > 0 ? <span style={{ width: 8, height: 8, borderRadius: 4, background: "#c23934" }} /> : null}
                </div>
                <div style={{ fontSize: 12, color: "#5c5c5c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.snippet || c.sub}</div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Conversation pane */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {!sel ? (
          <div style={{ margin: "auto", color: "#747474", fontSize: 14 }}>Select a conversation to reply.</div>
        ) : (
          <>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e5e5" }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{sel.title}</div>
              <div style={{ fontSize: 12, color: "#747474" }}>{sel.kind === "email" ? sel.emailFrom : sel.smsNumber}{sel.kind === "email" && sel.emailSubject ? ` · ${sel.emailSubject}` : ""}</div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 16, background: "#fafafa" }}>
              {sel.kind === "email"
                ? emailMsgs.map((m) => (
                    <div key={m.id} style={{ marginBottom: 12, textAlign: m.direction === "OUTBOUND" ? "right" : "left" }}>
                      <div style={{ display: "inline-block", maxWidth: "80%", padding: "8px 12px", borderRadius: 8, background: m.direction === "OUTBOUND" ? "#0176d3" : "#fff", color: m.direction === "OUTBOUND" ? "#fff" : "#181818", border: m.direction === "OUTBOUND" ? "none" : "1px solid #e5e5e5", textAlign: "left" }}>
                        <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 3 }}>{displayName(m.fromAddress)} · {new Date(m.createdAt).toLocaleString()}</div>
                        <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{m.bodyText ?? m.bodyHtml?.replace(/<[^>]+>/g, " ") ?? ""}</div>
                      </div>
                    </div>
                  ))
                : smsMsgs.map((m) => (
                    <div key={m.id} style={{ marginBottom: 8, textAlign: m.direction === "OUTBOUND" ? "right" : "left" }}>
                      <div style={{ display: "inline-block", maxWidth: "75%", padding: "7px 11px", borderRadius: 14, background: m.direction === "OUTBOUND" ? "#0176d3" : "#e9e9eb", color: m.direction === "OUTBOUND" ? "#fff" : "#181818", fontSize: 13, whiteSpace: "pre-wrap", textAlign: "left" }}>
                        {m.body}
                        <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}{m.direction === "OUTBOUND" && m.status ? ` · ${m.status.toLowerCase()}` : ""}</div>
                      </div>
                    </div>
                  ))}
            </div>
            <div style={{ padding: 12, borderTop: "1px solid #e5e5e5", display: "flex", gap: 8 }}>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send(); }}
                rows={2}
                placeholder={sel.kind === "email" ? "Reply by email (Cmd+Enter to send)..." : "Reply by SMS (Cmd+Enter)..."}
                style={{ flex: 1, padding: 8, border: "1px solid #c9c7c5", borderRadius: 4, fontSize: 13, resize: "vertical", fontFamily: "inherit" }}
              />
              <button onClick={() => void send()} disabled={sending || !reply.trim()} style={{ alignSelf: "flex-end", background: "#0176d3", border: "none", color: "#fff", padding: "8px 18px", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: sending ? "wait" : "pointer" }}>
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
