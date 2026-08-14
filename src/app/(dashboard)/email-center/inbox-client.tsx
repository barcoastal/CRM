"use client";

/**
 * Email Center inbox: folder rail (inbox/sent/all) + thread list +
 * conversation pane with inline reply and new-message composer. Threads and
 * messages load from /api/email-center/threads and /api/emails.
 * Admins get a user switcher (any user or "All users").
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const FONT = '"Salesforce Sans", "Helvetica Neue", system-ui, -apple-system, sans-serif';

type Folder = "inbox" | "sent" | "all";

interface ThreadRow {
  threadId: string;
  subject: string;
  lastAt: string;
  lastFrom: string;
  lastDirection: string;
  snippet: string;
  messageCount: number;
  unreadCount: number;
  ownerName: string | null;
  leadId: string | null;
  leadName: string | null;
  accountId: string | null;
  accountName: string | null;
  contactId: string | null;
  contactName: string | null;
}

interface Message {
  id: string;
  direction: string;
  status: string;
  fromAddress: string;
  toAddresses: string;
  subject: string;
  bodyHtml: string | null;
  bodyText: string | null;
  createdAt: string;
  threadId?: string | null;
}

export function InboxClient({
  me,
  isAdmin,
  users,
}: {
  me: { id: string; name: string; mailboxAddress: string | null };
  isAdmin: boolean;
  users: { id: string; name: string; mailboxAddress: string | null }[];
}) {
  const [folder, setFolder] = useState<Folder>("inbox");
  const [viewUser, setViewUser] = useState<string>(me.id);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ThreadRow | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState({ to: "", subject: "", body: "", templateId: "" });
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/email-templates")
      .then((r) => r.json())
      .then((data) => {
        const items = Array.isArray(data) ? data : (data.items ?? data.templates ?? []);
        setTemplates(items.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
      })
      .catch(() => setTemplates([]));
  }, []);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ folder });
    if (isAdmin && viewUser !== me.id) qs.set("user", viewUser);
    const res = await fetch(`/api/email-center/threads?${qs}`);
    const data = await res.json();
    setThreads(data.threads ?? []);
    setLoading(false);
  }, [folder, viewUser, isAdmin, me.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadThreads flips the loading flag before fetching, same pattern the rest of the app uses
    void loadThreads();
  }, [loadThreads]);

  const openThread = useCallback(async (t: ThreadRow) => {
    setSelected(t);
    setReply("");
    // Fetch with threadId filter for server-side narrowing; keep client-side
    // filter as safety net for legacy rows with null threadId.
    const res = await fetch(`/api/emails?threadId=${encodeURIComponent(t.threadId)}&limit=200`);
    const data = await res.json();
    const items: Message[] = data.items ?? [];
    const inThread = items
      .filter((m) => (m.threadId ?? m.id) === t.threadId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    setMessages(inThread);
    if (t.unreadCount > 0) {
      await fetch("/api/email-center/threads/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: t.threadId }),
      });
      setThreads((prev) =>
        prev.map((x) => (x.threadId === t.threadId ? { ...x, unreadCount: 0 } : x)),
      );
    }
  }, []);

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setSending(true);
    setError(null);
    const last = messages[messages.length - 1];
    const res = await fetch("/api/emails/compose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        replyToMessageId: last?.id ?? selected.threadId,
        bodyHtml: `<p>${reply.replace(/\n/g, "<br/>")}</p>`,
        bodyText: reply,
      }),
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok || data.error) {
      setError(data.error ?? "Send failed");
      return;
    }
    setReply("");
    await openThread(selected);
    await loadThreads();
  }

  async function sendNew() {
    if (!compose.to.trim()) return;
    setSending(true);
    setError(null);
    const res = await fetch("/api/emails/compose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: compose.to,
        subject: compose.subject || undefined,
        bodyHtml: compose.body ? `<p>${compose.body.replace(/\n/g, "<br/>")}</p>` : undefined,
        bodyText: compose.body || undefined,
        templateId: compose.templateId || undefined,
      }),
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok || data.error) {
      setError(data.error ?? "Send failed");
      return;
    }
    setComposeOpen(false);
    setCompose({ to: "", subject: "", body: "", templateId: "" });
    setFolder("sent");
  }

  const totalUnread = threads.reduce((n, t) => n + t.unreadCount, 0);

  return (
    <div style={{ display: "flex", height: "100%", fontFamily: FONT, background: "#f3f3f3" }}>
      {/* Folder rail */}
      <div style={{ width: 150, flexShrink: 0, background: "#fff", borderRight: "1px solid #e5e5e5", padding: "12px 0" }}>
        <button
          onClick={() => { setComposeOpen(true); setSelected(null); }}
          style={{ display: "block", margin: "0 12px 12px", width: "calc(100% - 24px)", padding: "6px 0", background: "#0176d3", color: "#fff", border: 0, borderRadius: 4, fontSize: 13, cursor: "pointer" }}
        >
          New Email
        </button>
        {(["inbox", "sent", "all"] as Folder[]).map((f) => (
          <button
            key={f}
            onClick={() => { setFolder(f); setSelected(null); }}
            style={{
              display: "flex", justifyContent: "space-between", width: "100%", padding: "6px 16px",
              background: folder === f ? "#f0f6fb" : "transparent", border: 0, fontSize: 13,
              cursor: "pointer", textTransform: "capitalize", color: "#181818",
            }}
          >
            <span>{f === "all" ? "All Mail" : f}</span>
            {f === "inbox" && totalUnread > 0 ? (
              <span style={{ background: "#0176d3", color: "#fff", borderRadius: 10, fontSize: 11, padding: "0 6px" }}>{totalUnread}</span>
            ) : null}
          </button>
        ))}
        {isAdmin ? (
          <div style={{ padding: "14px 12px 0" }}>
            <div style={{ fontSize: 11, color: "#706e6b", marginBottom: 4 }}>Viewing</div>
            <select
              value={viewUser}
              onChange={(e) => { setViewUser(e.target.value); setSelected(null); }}
              style={{ width: "100%", fontSize: 12, padding: 4 }}
            >
              <option value={me.id}>My inbox</option>
              <option value="all">All users</option>
              {users.filter((u) => u.id !== me.id).map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        ) : null}
        {me.mailboxAddress ? (
          <div style={{ padding: "14px 16px 0", fontSize: 11, color: "#706e6b", wordBreak: "break-all" }}>
            {me.mailboxAddress}
          </div>
        ) : (
          <div style={{ padding: "14px 16px 0", fontSize: 11, color: "#c23934" }}>
            No mailbox address set. Ask an admin to provision one in Settings &gt; Users.
          </div>
        )}
      </div>

      {/* Thread list */}
      <div style={{ width: 340, flexShrink: 0, background: "#fff", borderRight: "1px solid #e5e5e5", overflowY: "auto" }}>
        {loading ? (
          <div style={{ padding: 16, fontSize: 13, color: "#706e6b" }}>Loading...</div>
        ) : threads.length === 0 ? (
          <div style={{ padding: 16, fontSize: 13, color: "#706e6b" }}>No conversations.</div>
        ) : (
          threads.map((t) => (
            <button
              key={t.threadId}
              onClick={() => { setComposeOpen(false); void openThread(t); }}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "10px 14px",
                borderBottom: "1px solid #f0f0f0", cursor: "pointer", border: 0,
                background: selected?.threadId === t.threadId ? "#f0f6fb" : "#fff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: t.unreadCount > 0 ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.subject}
                </span>
                <span style={{ fontSize: 11, color: "#706e6b", flexShrink: 0 }}>
                  {new Date(t.lastAt).toLocaleDateString()}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#706e6b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.lastFrom}
              </div>
              <div style={{ fontSize: 12, color: "#9a9a9a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.snippet}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 3 }}>
                {t.messageCount > 1 ? (
                  <span style={{ fontSize: 11, color: "#706e6b" }}>{t.messageCount} messages</span>
                ) : null}
                {t.unreadCount > 0 ? (
                  <span style={{ fontSize: 11, color: "#0176d3", fontWeight: 700 }}>{t.unreadCount} new</span>
                ) : null}
                {t.leadId ? (
                  <span style={{ fontSize: 11, color: "#0176d3" }}>Lead: {t.leadName ?? t.leadId}</span>
                ) : null}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Conversation / composer pane */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {composeOpen ? (
          <div style={{ padding: 20, maxWidth: 680 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>New Email</h2>
            {templates.length > 0 ? (
              <select
                value={compose.templateId}
                onChange={(e) => setCompose((c) => ({ ...c, templateId: e.target.value }))}
                style={{ display: "block", width: "100%", marginBottom: 8, padding: 8, fontSize: 13, border: "1px solid #ddd", borderRadius: 4 }}
              >
                <option value="">No template (write below)</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            ) : null}
            <input
              placeholder="To"
              value={compose.to}
              onChange={(e) => setCompose((c) => ({ ...c, to: e.target.value }))}
              style={{ display: "block", width: "100%", marginBottom: 8, padding: 8, fontSize: 13, border: "1px solid #ddd", borderRadius: 4 }}
            />
            <input
              placeholder="Subject"
              value={compose.subject}
              onChange={(e) => setCompose((c) => ({ ...c, subject: e.target.value }))}
              style={{ display: "block", width: "100%", marginBottom: 8, padding: 8, fontSize: 13, border: "1px solid #ddd", borderRadius: 4 }}
            />
            <textarea
              placeholder="Write your message..."
              value={compose.body}
              onChange={(e) => setCompose((c) => ({ ...c, body: e.target.value }))}
              rows={10}
              style={{ display: "block", width: "100%", marginBottom: 8, padding: 8, fontSize: 13, border: "1px solid #ddd", borderRadius: 4, resize: "vertical" }}
            />
            {error ? <div style={{ color: "#c23934", fontSize: 12, marginBottom: 8 }}>{error}</div> : null}
            <button
              onClick={() => void sendNew()}
              disabled={sending || !compose.to.trim()}
              style={{ padding: "7px 18px", background: "#0176d3", color: "#fff", border: 0, borderRadius: 4, fontSize: 13, cursor: "pointer", opacity: sending ? 0.6 : 1 }}
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        ) : !selected ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#706e6b", fontSize: 13 }}>
            Select a conversation
          </div>
        ) : (
          <>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid #e5e5e5", background: "#fff" }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{selected.subject}</div>
              <div style={{ fontSize: 12, color: "#706e6b", display: "flex", gap: 12, marginTop: 2 }}>
                {selected.leadId ? (
                  <Link href={`/leads/${selected.leadId}`} style={{ color: "#0176d3" }}>
                    Lead: {selected.leadName ?? "view"}
                  </Link>
                ) : null}
                {selected.accountId ? (
                  <Link href={`/accounts/${selected.accountId}`} style={{ color: "#0176d3" }}>
                    Account: {selected.accountName ?? "view"}
                  </Link>
                ) : null}
                {selected.contactId ? (
                  <Link href={`/contacts/${selected.contactId}`} style={{ color: "#0176d3" }}>
                    Contact: {selected.contactName ?? "view"}
                  </Link>
                ) : null}
                {isAdmin && selected.ownerName ? <span>Owner: {selected.ownerName}</span> : null}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              {messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    background: m.direction === "OUTBOUND" ? "#eef4fb" : "#fff",
                    border: "1px solid #e5e5e5",
                    borderRadius: 8,
                    padding: 14,
                    marginBottom: 12,
                    maxWidth: 720,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#706e6b", marginBottom: 8 }}>
                    <span>
                      <b style={{ color: "#181818" }}>{m.fromAddress}</b> to {m.toAddresses}
                    </span>
                    <span>
                      {new Date(m.createdAt).toLocaleString()}
                      {m.direction === "OUTBOUND" ? ` · ${m.status.toLowerCase()}` : ""}
                    </span>
                  </div>
                  {m.bodyHtml ? (
                    <div style={{ fontSize: 13 }} dangerouslySetInnerHTML={{ __html: m.bodyHtml }} />
                  ) : (
                    <pre style={{ fontSize: 13, whiteSpace: "pre-wrap", fontFamily: FONT, margin: 0 }}>{m.bodyText}</pre>
                  )}
                </div>
              ))}
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid #e5e5e5", background: "#fff" }}>
              <textarea
                placeholder="Reply..."
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={3}
                style={{ display: "block", width: "100%", padding: 8, fontSize: 13, border: "1px solid #ddd", borderRadius: 4, resize: "vertical", marginBottom: 8 }}
              />
              {error ? <div style={{ color: "#c23934", fontSize: 12, marginBottom: 8 }}>{error}</div> : null}
              <button
                onClick={() => void sendReply()}
                disabled={sending || !reply.trim()}
                style={{ padding: "6px 16px", background: "#0176d3", color: "#fff", border: 0, borderRadius: 4, fontSize: 13, cursor: "pointer", opacity: sending ? 0.6 : 1 }}
              >
                {sending ? "Sending..." : "Reply"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
