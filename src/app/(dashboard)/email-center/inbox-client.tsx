"use client";

/**
 * Email Center inbox: folder rail (inbox/sent/all) + thread list +
 * conversation pane with inline reply and new-message composer. Threads and
 * messages load from /api/email-center/threads and /api/emails.
 * Admins get a user switcher (any user or "All users").
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

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

/** "Jane Doe <jane@x.com>" -> "Jane Doe"; bare addresses -> local part. */
function displayName(raw: string): string {
  const m = raw.match(/^\s*"?([^"<]+?)"?\s*</);
  if (m) return m[1].trim();
  const at = raw.indexOf("@");
  return at > 0 ? raw.slice(0, at) : raw;
}

function initials(raw: string): string {
  const name = displayName(raw);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ["#171717", "#3c3c3c", "#5a5a5a", "#757570", "#2b2b2b", "#4a4a46"];

function avatarColor(raw: string): string {
  let h = 0;
  for (const ch of raw) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function relativeTime(iso: string): string {
  const then = new Date(iso);
  const mins = Math.floor((Date.now() - then.getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function EmptyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 6h16v12H4z M4 7l8 6 8-6" />
    </svg>
  );
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
    <div className="ec-inbox">
      {/* Folder rail */}
      <div className="ec-folders">
        <button
          className="ec-btn ec-btn-primary"
          style={{ width: "100%", marginBottom: 14 }}
          onClick={() => { setComposeOpen(true); setSelected(null); }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Compose
        </button>
        {(["inbox", "sent", "all"] as Folder[]).map((f) => (
          <button
            key={f}
            className={`ec-folder-btn${folder === f ? " ec-folder-active" : ""}`}
            onClick={() => { setFolder(f); setSelected(null); }}
          >
            <span>{f === "all" ? "All Mail" : f}</span>
            {f === "inbox" && totalUnread > 0 ? (
              <span className="ec-count-badge">{totalUnread}</span>
            ) : null}
          </button>
        ))}
        {isAdmin ? (
          <>
            <div className="ec-folder-label">Viewing</div>
            <select
              className="ec-select ec-select-sm"
              value={viewUser}
              onChange={(e) => { setViewUser(e.target.value); setSelected(null); }}
            >
              <option value={me.id}>My inbox</option>
              <option value="all">All users</option>
              {users.filter((u) => u.id !== me.id).map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </>
        ) : null}
        {me.mailboxAddress ? (
          <div className="ec-mailbox-chip">
            <b>Your address</b>
            {me.mailboxAddress}
          </div>
        ) : (
          <div className="ec-mailbox-warn">
            No mailbox address set. Ask an admin to provision one in Settings &gt; Users.
          </div>
        )}
      </div>

      {/* Thread list */}
      <div className="ec-threads">
        <div className="ec-threads-head">
          <span className="ec-threads-title">{folder === "all" ? "All Mail" : folder}</span>
          <span className="ec-threads-count">
            {loading ? "" : `${threads.length} conversation${threads.length === 1 ? "" : "s"}`}
          </span>
        </div>
        {loading ? (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="ec-skel" style={{ height: 58 }} />
            <div className="ec-skel" style={{ height: 58 }} />
            <div className="ec-skel" style={{ height: 58 }} />
          </div>
        ) : threads.length === 0 ? (
          <div className="ec-empty" style={{ paddingTop: 70 }}>
            <div className="ec-empty-icon"><EmptyIcon /></div>
            <div className="ec-empty-title">Nothing here yet</div>
            <div className="ec-empty-sub">
              {folder === "inbox"
                ? "Inbound mail to your address will show up here."
                : "Messages you send will show up here."}
            </div>
          </div>
        ) : (
          threads.map((t) => (
            <button
              key={t.threadId}
              className={[
                "ec-thread",
                t.unreadCount > 0 ? "ec-thread-unread" : "",
                selected?.threadId === t.threadId ? "ec-thread-selected" : "",
              ].join(" ")}
              onClick={() => { setComposeOpen(false); void openThread(t); }}
            >
              <span className="ec-avatar" style={{ background: avatarColor(t.lastFrom) }}>
                {initials(t.lastFrom)}
              </span>
              <span className="ec-thread-main">
                <span className="ec-thread-top">
                  <span className="ec-thread-from">{displayName(t.lastFrom)}</span>
                  <span className="ec-thread-time">{relativeTime(t.lastAt)}</span>
                </span>
                <span className="ec-thread-subject" style={{ display: "block" }}>{t.subject}</span>
                <span className="ec-thread-snippet" style={{ display: "block" }}>{t.snippet}</span>
                <span className="ec-thread-meta">
                  {t.messageCount > 1 ? (
                    <span className="ec-pill ec-pill-neutral">{t.messageCount} messages</span>
                  ) : null}
                  {t.leadId ? <span className="ec-pill ec-pill-green">Lead</span> : null}
                  {t.accountId ? <span className="ec-pill ec-pill-green">Account</span> : null}
                  {isAdmin && viewUser !== me.id && t.ownerName ? (
                    <span className="ec-pill ec-pill-neutral">{t.ownerName}</span>
                  ) : null}
                </span>
              </span>
              {t.unreadCount > 0 ? <span className="ec-unread-dot" /> : null}
            </button>
          ))
        )}
      </div>

      {/* Conversation / composer pane */}
      <div className="ec-convo">
        {composeOpen ? (
          <div className="ec-compose-wrap">
            <div className="ec-compose">
              <div className="ec-compose-head">
                <span className="ec-compose-title">New message</span>
                <button className="ec-btn ec-btn-ghost" style={{ color: "rgba(244,247,242,0.7)", padding: "4px 10px" }} onClick={() => setComposeOpen(false)}>
                  Close
                </button>
              </div>
              <div className="ec-compose-body">
                {templates.length > 0 ? (
                  <div>
                    <label className="ec-field-label">Template</label>
                    <select
                      className="ec-select"
                      value={compose.templateId}
                      onChange={(e) => setCompose((c) => ({ ...c, templateId: e.target.value }))}
                    >
                      <option value="">No template (write below)</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div>
                  <label className="ec-field-label">To</label>
                  <input
                    className="ec-input"
                    placeholder="client@example.com"
                    value={compose.to}
                    onChange={(e) => setCompose((c) => ({ ...c, to: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="ec-field-label">Subject</label>
                  <input
                    className="ec-input"
                    placeholder="Subject"
                    value={compose.subject}
                    onChange={(e) => setCompose((c) => ({ ...c, subject: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="ec-field-label">Message</label>
                  <textarea
                    className="ec-textarea"
                    placeholder="Write your message..."
                    value={compose.body}
                    onChange={(e) => setCompose((c) => ({ ...c, body: e.target.value }))}
                    rows={9}
                  />
                </div>
                {error ? <div className="ec-error">{error}</div> : null}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    className="ec-btn ec-btn-primary"
                    onClick={() => void sendNew()}
                    disabled={sending || !compose.to.trim()}
                  >
                    {sending ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : !selected ? (
          <div className="ec-empty">
            <div className="ec-empty-icon"><EmptyIcon /></div>
            <div className="ec-empty-title">Select a conversation</div>
            <div className="ec-empty-sub">Pick a thread on the left, or hit Compose to start one.</div>
          </div>
        ) : (
          <>
            <div className="ec-convo-head">
              <div className="ec-convo-subject">{selected.subject}</div>
              <div className="ec-convo-chips">
                {selected.leadId ? (
                  <Link className="ec-chip-link" href={`/leads/${selected.leadId}`}>
                    Lead · {selected.leadName ?? "view"}
                  </Link>
                ) : null}
                {selected.accountId ? (
                  <Link className="ec-chip-link" href={`/accounts/${selected.accountId}`}>
                    Account · {selected.accountName ?? "view"}
                  </Link>
                ) : null}
                {selected.contactId ? (
                  <Link className="ec-chip-link" href={`/contacts/${selected.contactId}`}>
                    Contact · {selected.contactName ?? "view"}
                  </Link>
                ) : null}
                {isAdmin && selected.ownerName ? (
                  <span className="ec-pill ec-pill-neutral">Owner: {selected.ownerName}</span>
                ) : null}
              </div>
            </div>
            <div className="ec-msgs">
              {messages.map((m) => (
                <div key={m.id} className={`ec-msg${m.direction === "OUTBOUND" ? " ec-msg-out" : ""}`}>
                  <span className="ec-avatar" style={{ background: avatarColor(m.fromAddress), width: 30, height: 30, fontSize: 11 }}>
                    {initials(m.fromAddress)}
                  </span>
                  <div className="ec-msg-card">
                    <div className="ec-msg-head">
                      <span className="ec-msg-who">
                        <b>{displayName(m.fromAddress)}</b> to {m.toAddresses}
                      </span>
                      <span className="ec-msg-when">
                        {m.direction === "OUTBOUND" ? (
                          <span className="ec-pill ec-pill-green">{m.status.toLowerCase()}</span>
                        ) : null}
                        {new Date(m.createdAt).toLocaleString(undefined, {
                          month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="ec-msg-body">
                      {m.bodyHtml ? (
                        <div dangerouslySetInnerHTML={{ __html: m.bodyHtml }} />
                      ) : (
                        <pre>{m.bodyText}</pre>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="ec-replybar">
              <div className="ec-replycard">
                <textarea
                  className="ec-textarea"
                  placeholder={`Reply to ${displayName(selected.lastFrom)}...`}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={3}
                />
                {error ? <div className="ec-error">{error}</div> : null}
                <div className="ec-replycard-foot">
                  <span className="ec-replycard-hint">
                    Sends from {me.mailboxAddress ?? "your account email"}
                  </span>
                  <button
                    className="ec-btn ec-btn-primary"
                    onClick={() => void sendReply()}
                    disabled={sending || !reply.trim()}
                  >
                    {sending ? "Sending..." : "Reply"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
