"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, ChatSpace } from "@/lib/google-chat/client";
import styles from "./chat-inbox.module.css";
type Person = { id: string; name: string; email: string };
type Draft = { text: string; thread?: string; quote?: string; requestId: string };
async function api<T>(query: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/google-chat${query}`, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Google Chat request failed.");
  return data;
}
function merge<T extends { name: string }>(old: T[], fresh: T[]) { return [...new Map([...old, ...fresh].map(item => [item.name, item])).values()]; }
const errorText = (error: unknown) => error instanceof Error ? error.message : "Please try again.";
export function ChatInbox({ account }: { account: Person }) {
  const [spaces, setSpaces] = useState<ChatSpace[]>([]), [spacesToken, setSpacesToken] = useState<string>();
  const [selected, setSelected] = useState<ChatSpace | null>(null), [messages, setMessages] = useState<ChatMessage[]>([]), [olderToken, setOlderToken] = useState<string>();
  const [error, setError] = useState(""), [loading, setLoading] = useState(true), [messageLoading, setMessageLoading] = useState(false), [sending, setSending] = useState(false), [loadingOlder, setLoadingOlder] = useState(false);
  const [search, setSearch] = useState(""), [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [newChat, setNewChat] = useState(false), [people, setPeople] = useState<Person[]>([]), [personSearch, setPersonSearch] = useState(""), [recipients, setRecipients] = useState<string[]>([]), [starting, setStarting] = useState(false), [startError, setStartError] = useState("");
  const currentSpace = useRef<string | null>(null), end = useRef<HTMLDivElement>(null), startId = useRef("");
  const draft = selected ? drafts[selected.name] : undefined;
  const loadSpaces = useCallback(async (token?: string) => {
    setLoading(true);
    try { const data = await api<{ spaces?: ChatSpace[]; nextPageToken?: string }>(`?resource=spaces${token ? `&pageToken=${encodeURIComponent(token)}` : ""}`); setSpaces(old => token ? merge(old, data.spaces ?? []) : merge(selected ? [selected] : [], data.spaces ?? [])); setSpacesToken(data.nextPageToken); setError(""); }
    catch (e) { setError(errorText(e)); } finally { setLoading(false); }
  }, [selected]);
  useEffect(() => { void loadSpaces(); /* Initial list; refresh is explicit. */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const loadMessages = useCallback(async (space: string, token?: string, initial = false) => {
    const data = await api<{ messages?: ChatMessage[]; nextPageToken?: string }>(`?resource=messages&space=${encodeURIComponent(space)}${token ? `&pageToken=${encodeURIComponent(token)}` : ""}`);
    if (currentSpace.current !== space) return;
    setMessages(old => initial ? data.messages ?? [] : merge(old, data.messages ?? []));
    if (initial || token) setOlderToken(data.nextPageToken);
  }, []);
  useEffect(() => {
    if (!selected) return;
    let stopped = false, busy = false;
    const tick = async () => {
      if (stopped || busy || document.hidden) return;
      busy = true;
      try { await loadMessages(selected.name); if (!stopped) setError(""); }
      catch (e) { if (!stopped) { setError(errorText(e)); if (/denied|no longer|Sign in|own account/.test(errorText(e))) setMessages([]); } }
      finally { busy = false; }
    };
    const timer = setInterval(tick, 15000);
    return () => { stopped = true; clearInterval(timer); };
  }, [selected, loadMessages]);
  async function choose(space: ChatSpace) {
    currentSpace.current = space.name; setSelected(space); setMessages([]); setOlderToken(undefined); setMessageLoading(true); setError("");
    try { await loadMessages(space.name, undefined, true); }
    catch (e) { if (currentSpace.current === space.name) setError(errorText(e)); }
    finally { if (currentSpace.current === space.name) { setMessageLoading(false); setTimeout(() => end.current?.scrollIntoView({ block: "nearest" }), 0); } }
  }
  function changeDraft(patch: Partial<Draft>) {
    if (!selected) return;
    setDrafts(old => ({ ...old, [selected.name]: { ...(old[selected.name] ?? { text: "" }), ...patch, requestId: crypto.randomUUID() } }));
  }
  async function send() {
    if (!selected || !draft?.text.trim() || sending) return;
    const target = selected.name, snapshot = draft;
    setSending(true); setError("");
    try {
      const result = await api<{ message: ChatMessage }>("", { action: "send", space: target, text: snapshot.text, thread: snapshot.thread, requestId: snapshot.requestId });
      setDrafts(old => old[target]?.requestId === snapshot.requestId ? { ...old, [target]: { text: "", requestId: crypto.randomUUID() } } : old);
      if (currentSpace.current === target) { setMessages(old => merge(old, [result.message])); setTimeout(() => end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 0); }
    } catch (e) { setError(errorText(e)); } finally { setSending(false); }
  }
  async function openNew() {
    setNewChat(true); setRecipients([]); setPersonSearch(""); setStartError(""); startId.current = crypto.randomUUID();
    try { const data = await api<{ people: Person[] }>("?resource=people"); setPeople(data.people); } catch (e) { setStartError(errorText(e)); }
  }
  async function start() {
    if (!recipients.length || starting) return;
    setStarting(true); setStartError("");
    try {
      const data = await api<{ space: ChatSpace }>("", { action: "start", userIds: recipients, requestId: startId.current });
      const space = { ...data.space, displayName: data.space.displayName || people.filter(p => recipients.includes(p.id)).map(p => p.name).join(", ") };
      setSpaces(old => merge([space], old)); setNewChat(false); await choose(space);
    } catch (e) { setStartError(errorText(e)); } finally { setStarting(false); }
  }
  const googleHref = selected?.spaceUri?.startsWith("https://chat.google.com/") ? selected.spaceUri : "https://chat.google.com/";
  return <section className={styles.inbox} aria-label="Google Chat inbox">
    <header className={styles.top}><div><h1>Google Chat</h1><div className={styles.sub}>{account.email} · Your conversations</div></div><div style={{ display: "flex", gap: 8 }}><button className={styles.secondary} onClick={() => { void loadSpaces(); if (selected) void loadMessages(selected.name).catch(e => setError(errorText(e))); }} disabled={loading}>Refresh</button><button className={styles.primary} onClick={openNew}>New chat</button></div></header>
    {error && <div role="alert" className={styles.error}>{error}</div>}
    <div className={styles.body}>
      <aside className={styles.sidebar} aria-label="Conversations"><div className={styles.search}><input aria-label="Search conversations" placeholder="Search conversations…" value={search} onChange={e => setSearch(e.target.value)} /></div><div className={styles.spaces}>
        {spaces.filter(s => (s.displayName || "Conversation").toLowerCase().includes(search.toLowerCase())).map(s => <button key={s.name} className={styles.space} aria-current={selected?.name === s.name} onClick={() => choose(s)}><strong>{s.displayName || "Conversation"}</strong><span>{s.spaceType === "DIRECT_MESSAGE" ? "Direct message" : s.spaceType === "GROUP_CHAT" ? "Group chat" : "Space"}</span></button>)}
        {loading && <p className={styles.empty} role="status">Loading conversations…</p>}
        {!loading && !spaces.length && !error && <p className={styles.empty}>No conversations yet. Start a chat with a coworker.</p>}
        {spacesToken && <button className={styles.secondary} disabled={loading} onClick={() => loadSpaces(spacesToken)}>Load more conversations</button>}
      </div></aside>
      <div className={styles.conversation}>{!selected ? <div className={styles.center}><h2>Your team, one conversation away</h2><p>Choose a conversation or start a new chat.</p></div> : <>
        <header className={styles.heading}><div><h2>{selected.displayName || "Conversation"}</h2><div className={styles.sub}>Updates every 15 seconds while this tab is active</div></div><a href={googleHref} target="_blank" rel="noreferrer">Open in Google Chat ↗</a></header>
        <div className={styles.messages} aria-label="Messages" aria-busy={messageLoading}>
          {olderToken && <button className={styles.secondary} disabled={loadingOlder} onClick={async () => { setLoadingOlder(true); try { await loadMessages(selected.name, olderToken); } catch (e) { setError(errorText(e)); } finally { setLoadingOlder(false); } }}>Load older messages</button>}
          {messageLoading ? <p className={styles.empty}>Loading messages…</p> : !messages.length && !error ? <p className={styles.empty}>Send the first message.</p> : null}
          {[...messages].sort((a, b) => (a.createTime || "").localeCompare(b.createTime || "")).map(m => <article className={styles.message} key={m.name}><header><strong>{m.sender?.displayName || m.sender?.email || (m.sender?.type === "BOT" ? "Chat app" : "Participant")}</strong><time>{m.createTime ? new Date(m.createTime).toLocaleString() : ""}</time></header><p>{m.deleteTime ? "Message deleted" : m.text || (m.attachment?.length ? "Attachment" : "Open in Google Chat to view this message.")}</p>{!m.deleteTime && m.attachment?.map((a, i) => <div className={styles.sub} key={a.name || i}>📎 {a.contentName || "Attachment"} · View in Google Chat</div>)}{!m.deleteTime && m.thread?.name && <button className={styles.reply} onClick={() => changeDraft({ thread: m.thread!.name, quote: m.text?.slice(0, 100) || "Message" })}>Reply in thread</button>}</article>)}<div ref={end} />
        </div>
        <form className={styles.composer} onSubmit={e => { e.preventDefault(); void send(); }}>
          {draft?.thread && <div className={styles.sub}>Replying to: {draft.quote} <button type="button" className={styles.reply} onClick={() => changeDraft({ thread: undefined, quote: undefined })}>Cancel reply</button></div>}
          <textarea aria-label="Message" placeholder="Write a message…" maxLength={4000} value={draft?.text || ""} onChange={e => changeDraft({ text: e.target.value })} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); void send(); } }} />
          <footer><span className={styles.sub}>Sending as {account.name} · Ctrl / ⌘ + Enter to send</span><button className={styles.primary} disabled={sending || !draft?.text.trim()}>{sending ? "Sending…" : "Send"}</button></footer>
        </form>
      </>}</div>
    </div>
    {newChat && <div className={styles.overlay}><section role="dialog" aria-modal="true" aria-labelledby="new-chat-title" className={styles.dialog} onKeyDown={e => { if (e.key === "Escape" && !starting) setNewChat(false); }}><h2 id="new-chat-title">New conversation</h2><p className={styles.sub}>Choose one coworker for a direct message, or several for a group chat.</p><input autoFocus aria-label="Find coworkers" placeholder="Search name or email…" value={personSearch} onChange={e => setPersonSearch(e.target.value)} /><div className={styles.people}>{people.filter(p => `${p.name} ${p.email}`.toLowerCase().includes(personSearch.toLowerCase())).map(p => <label className={styles.person} key={p.id}><input type="checkbox" checked={recipients.includes(p.id)} disabled={starting || (!recipients.includes(p.id) && recipients.length >= 49)} onChange={e => { setRecipients(old => e.target.checked ? [...old, p.id] : old.filter(id => id !== p.id)); startId.current = crypto.randomUUID(); }} /><div><strong>{p.name}</strong><span>{p.email}</span></div></label>)}</div>{startError && <p role="alert" className={styles.error}>{startError}</p>}<footer><button className={styles.secondary} disabled={starting} onClick={() => setNewChat(false)}>Cancel</button><button className={styles.primary} disabled={starting || !recipients.length} onClick={start}>{starting ? "Opening…" : `Start chat${recipients.length ? ` (${recipients.length})` : ""}`}</button></footer></section></div>}
  </section>;
}
