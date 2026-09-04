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
  cc?: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  createdAt: string;
  threadId?: string | null;
  attachments?: { id: string; filename: string; byteSize: number }[];
}

type PendingAttachment = { storagePath: string; filename: string; contentType: string; byteSize: number };

/** "Name <a@b.com>" -> "a@b.com"; bare address -> itself. */
function extractEmail(token: string): string {
  const m = token.match(/<([^>]+)>/);
  return (m ? m[1] : token).trim();
}
/** Split a comma list and reduce each entry to a bare email. */
function splitAddrs(s: string): string[] {
  return s.split(",").map((x) => extractEmail(x)).filter(Boolean);
}
/** Plaintext of a message, for quoting when forwarding. */
function messageToText(m: { bodyText: string | null; bodyHtml: string | null }): string {
  if (m.bodyText) return m.bodyText;
  if (m.bodyHtml) return m.bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return "";
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
  const [compose, setCompose] = useState({ to: "", subject: "", body: "" });
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [composeCc, setComposeCc] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [forwardId, setForwardId] = useState<string | null>(null);
  // Inline conversation composer (reply / reply-all / forward, no pane switch).
  const [replyMode, setReplyMode] = useState<"reply" | "replyall" | "forward">("reply");
  const [replyTo, setReplyTo] = useState("");
  const [replyCc, setReplyCc] = useState("");
  const [showReplyCc, setShowReplyCc] = useState(false);
  const [activeMsgId, setActiveMsgId] = useState<string | null>(null);

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
    // Prime the inline composer as a plain reply to the latest message.
    const last = inThread[inThread.length - 1];
    const counterparty = last
      ? last.direction === "INBOUND"
        ? extractEmail(last.fromAddress)
        : extractEmail(last.toAddresses.split(",")[0] ?? "")
      : extractEmail(t.lastFrom);
    setReplyMode("reply");
    setActiveMsgId(last?.id ?? null);
    setReplyTo(counterparty);
    setReplyCc("");
    setShowReplyCc(false);
    setAttachments([]);
    setError(null);
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

  async function onPickFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/emails/attachments", { method: "POST", body: fd });
        if (res.ok) { const att = (await res.json()) as PendingAttachment; setAttachments((prev) => [...prev, att]); }
        else setError("Upload failed. Please try again.");
      }
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }
  function removeAttachment(storagePath: string) {
    setAttachments((prev) => prev.filter((a) => a.storagePath !== storagePath));
  }

  function openComposer(prefill: { to?: string; cc?: string; subject?: string; replyToId?: string | null; forwardId?: string | null }) {
    setCompose({ to: prefill.to ?? "", subject: prefill.subject ?? "", body: "" });
    setComposeCc(prefill.cc ?? "");
    setReplyToId(prefill.replyToId ?? null);
    setForwardId(prefill.forwardId ?? null);
    setAttachments([]);
    setError(null);
    setComposeOpen(true);
    setSelected(null);
  }

  /** Switch the inline composer between reply / reply-all / forward, prefilling
   *  recipients + (for forward) a quoted copy of the latest message. */
  function startReply(mode: "reply" | "replyall" | "forward") {
    if (!selected) return;
    const last = messages[messages.length - 1];
    const counterparty = last
      ? last.direction === "INBOUND"
        ? extractEmail(last.fromAddress)
        : extractEmail(last.toAddresses.split(",")[0] ?? "")
      : extractEmail(selected.lastFrom);
    setReplyMode(mode);
    setActiveMsgId(last?.id ?? null);
    setError(null);
    setAttachments([]);
    if (mode === "forward") {
      setReplyTo("");
      setReplyCc("");
      setShowReplyCc(false);
      const orig = last ? messageToText(last) : "";
      setReply(`\n\n---------- Forwarded message ----------\nFrom: ${last?.fromAddress ?? ""}\nSubject: ${last?.subject ?? selected.subject}\n\n${orig}`);
    } else {
      setReplyTo(counterparty);
      setReply("");
      if (mode === "replyall") {
        const mine = (me.mailboxAddress ?? "").toLowerCase();
        const cc = Array.from(new Set([...splitAddrs(last?.toAddresses ?? ""), ...splitAddrs(last?.cc ?? "")]))
          .filter((a) => a.toLowerCase() !== mine && a.toLowerCase() !== counterparty.toLowerCase());
        setReplyCc(cc.join(", "));
        setShowReplyCc(cc.length > 0);
      } else {
        setReplyCc("");
        setShowReplyCc(false);
      }
    }
  }

  async function sendInline() {
    if (!selected) return;
    const toList = splitAddrs(replyTo);
    if (toList.length === 0) { setError("Enter at least one recipient"); return; }
    if (!reply.trim() && attachments.length === 0) return;
    setSending(true);
    setError(null);
    const subject = replyMode === "forward"
      ? (/^fwd:/i.test(selected.subject) ? selected.subject : `Fwd: ${selected.subject}`)
      : (/^re:/i.test(selected.subject) ? selected.subject : `Re: ${selected.subject}`);
    const res = await fetch("/api/emails/gmail/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: toList,
        cc: showReplyCc && replyCc ? splitAddrs(replyCc) : undefined,
        subject,
        bodyHtml: reply ? `<p>${reply.replace(/\n/g, "<br/>")}</p>` : undefined,
        bodyText: reply || undefined,
        attachments,
        replyToMessageId: replyMode !== "forward" ? (activeMsgId ?? undefined) : undefined,
        forwardMessageId: replyMode === "forward" ? (activeMsgId ?? undefined) : undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok || data.error || data.ok === false) {
      setError(data.error ?? "Send failed");
      return;
    }
    setReply("");
    setAttachments([]);
    setReplyCc("");
    setShowReplyCc(false);
    setReplyMode("reply");
    await openThread(selected);
    await loadThreads();
  }

  async function sendNew() {
    const toList = splitAddrs(compose.to);
    if (toList.length === 0) { setError("Enter at least one recipient"); return; }
    setSending(true);
    setError(null);
    const res = await fetch("/api/emails/gmail/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: toList,
        cc: composeCc ? splitAddrs(composeCc) : undefined,
        subject: compose.subject || "",
        bodyHtml: compose.body ? `<p>${compose.body.replace(/\n/g, "<br/>")}</p>` : undefined,
        bodyText: compose.body || undefined,
        attachments,
        replyToMessageId: replyToId ?? undefined,
        forwardMessageId: forwardId ?? undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok || data.error || data.ok === false) {
      setError(data.error ?? "Send failed");
      return;
    }
    setComposeOpen(false);
    setCompose({ to: "", subject: "", body: "" });
    setComposeCc(""); setReplyToId(null); setForwardId(null); setAttachments([]);
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
          onClick={() => { openComposer({}); }}
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
                <span className="ec-compose-title">{forwardId ? "Forward" : replyToId ? "Reply" : "New message"}</span>
                <button className="ec-btn ec-btn-ghost" style={{ color: "rgba(244,247,242,0.7)", padding: "4px 10px" }} onClick={() => setComposeOpen(false)}>
                  Close
                </button>
              </div>
              <div className="ec-compose-body">
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
                  <label className="ec-field-label">Cc</label>
                  <input className="ec-input" placeholder="cc@example.com, ..." value={composeCc} onChange={(e) => setComposeCc(e.target.value)} />
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
                <div className="ec-attach-row">
                  <label className="ec-btn ec-btn-ghost">
                    Attach files
                    <input type="file" multiple hidden onChange={(e) => void onPickFiles(e.target.files)} />
                  </label>
                  {uploading ? <span className="ec-attach-status">Uploading...</span> : null}
                  {attachments.map((a) => (
                    <span key={a.storagePath} className="ec-attach-chip">
                      {a.filename} ({Math.ceil(a.byteSize / 1024)} KB)
                      <button type="button" aria-label="Remove" onClick={() => removeAttachment(a.storagePath)}>×</button>
                    </span>
                  ))}
                </div>
                {error ? <div className="ec-error">{error}</div> : null}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    className="ec-btn ec-btn-primary"
                    onClick={() => void sendNew()}
                    disabled={sending || splitAddrs(compose.to).length === 0}
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
                        // Sandboxed iframe: renders the email's own HTML/CSS faithfully while
                        // containing it (no scripts, and its styles can't leak onto the CRM page).
                        <iframe className="ec-msg-iframe" sandbox="allow-popups" srcDoc={m.bodyHtml} title="Email content" />
                      ) : (
                        <pre>{m.bodyText}</pre>
                      )}
                    </div>
                    {/* Inbound Gmail attachments are captured in Phase 2; outbound sent files show here now. */}
                    {m.attachments?.length ? (
                      <div className="ec-msg-attachments">
                        {m.attachments.map((a) => (
                          <a key={a.id} className="ec-attach-chip" href={`/api/emails/${m.id}/attachments/${a.id}`}>
                            {a.filename} ({Math.ceil(a.byteSize / 1024)} KB)
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <div className="ec-replybar">
              <div className="ec-replycard">
                <div className="ec-reply-modes">
                  {(["reply", "replyall", "forward"] as const).map((mode) => (
                    <button
                      key={mode}
                      className={`ec-btn${replyMode === mode ? " ec-btn-primary" : ""}`}
                      onClick={() => startReply(mode)}
                    >
                      {mode === "reply" ? "Reply" : mode === "replyall" ? "Reply all" : "Forward"}
                    </button>
                  ))}
                </div>
                <div className="ec-reply-fields">
                  <div className="ec-reply-field">
                    <label className="ec-field-label">To</label>
                    <input
                      className="ec-input"
                      placeholder="recipient@example.com"
                      value={replyTo}
                      onChange={(e) => setReplyTo(e.target.value)}
                    />
                  </div>
                  {showReplyCc ? (
                    <div className="ec-reply-field">
                      <label className="ec-field-label">Cc</label>
                      <input
                        className="ec-input"
                        placeholder="cc@example.com, ..."
                        value={replyCc}
                        onChange={(e) => setReplyCc(e.target.value)}
                      />
                    </div>
                  ) : (
                    <button type="button" className="ec-linkbtn" onClick={() => setShowReplyCc(true)}>Add Cc</button>
                  )}
                </div>
                <textarea
                  className="ec-textarea"
                  placeholder={replyMode === "forward" ? "Add a note (optional)..." : `Reply to ${displayName(selected.lastFrom)}...`}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={4}
                />
                <div className="ec-attach-row">
                  <label className="ec-btn ec-btn-ghost">
                    Attach files
                    <input type="file" multiple hidden onChange={(e) => void onPickFiles(e.target.files)} />
                  </label>
                  {uploading ? <span className="ec-attach-status">Uploading...</span> : null}
                  {attachments.map((a) => (
                    <span key={a.storagePath} className="ec-attach-chip">
                      {a.filename} ({Math.ceil(a.byteSize / 1024)} KB)
                      <button type="button" aria-label="Remove" onClick={() => removeAttachment(a.storagePath)}>×</button>
                    </span>
                  ))}
                </div>
                {error ? <div className="ec-error">{error}</div> : null}
                <div className="ec-replycard-foot">
                  <span className="ec-replycard-hint">Sends from your Gmail</span>
                  <button
                    className="ec-btn ec-btn-primary"
                    onClick={() => void sendInline()}
                    disabled={sending || (!reply.trim() && attachments.length === 0)}
                  >
                    {sending ? "Sending..." : replyMode === "forward" ? "Forward" : replyMode === "replyall" ? "Reply all" : "Reply"}
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
