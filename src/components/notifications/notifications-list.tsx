"use client";

/**
 * Notifications full-history list. Renders the server-loaded first page, then
 * lets the user filter by kind / status and paginate further on demand.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { avatarFor } from "@/lib/avatars";
import type { NotificationDTO } from "./notifications-panel";

const KIND_OPTIONS: { value: string; label: string }[] = [
  { value: "ALL", label: "All kinds" },
  { value: "OWNER_ASSIGNED", label: "Assignments" },
  { value: "MENTION", label: "Mentions" },
  { value: "APPROVAL_REQUEST", label: "Approval requests" },
  { value: "APPROVAL_DECIDED", label: "Approval decisions" },
  { value: "ENVELOPE_SIGNED", label: "Envelope signed" },
  { value: "MASS_EMAIL_DONE", label: "Mass-email results" },
  { value: "LEAD_INBOUND", label: "Inbound leads" },
  { value: "GENERIC", label: "Other" },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "UNREAD", label: "Unread" },
  { value: "READ", label: "Read" },
];

function relativeTime(iso: string): string {
  const dt = new Date(iso);
  const diff = Date.now() - dt.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function initialsFor(name: string | null | undefined, email: string | null | undefined): string {
  const src = (name ?? email ?? "?").trim();
  if (!src) return "?";
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0]! + parts[1][0]!).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

interface Props {
  initial: NotificationDTO[];
  initialUnreadCount: number;
  initialKind: string;
  initialStatus: string;
}

export function NotificationsList({ initial, initialUnreadCount, initialKind, initialStatus }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationDTO[]>(initial);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [kind, setKind] = useState(initialKind);
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (kind !== "ALL") params.set("kind", kind);
    if (status === "UNREAD") params.set("unreadOnly", "1");
    return params.toString();
  }, [kind, status]);

  // When filter changes, refetch via the API (the server-rendered set is for
  // the initial render only).
  useEffect(() => {
    if (kind === initialKind && status === initialStatus) return;
    let cancelled = false;
    const params = new URLSearchParams();
    if (kind !== "ALL") params.set("kind", kind);
    if (status === "UNREAD") params.set("unreadOnly", "1");
    params.set("take", "50");
    setBusy(true);
    fetch(`/api/notifications?${params.toString()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const list = data.notifications as NotificationDTO[];
        // The status filter in the API only knows unreadOnly; apply READ-only client-side.
        const filtered = status === "READ" ? list.filter((n) => !!n.readAt) : list;
        setItems(filtered);
        setUnreadCount(typeof data.unreadCount === "number" ? data.unreadCount : 0);
        setNextCursor(data.nextCursor ?? null);
        // Update URL so refresh keeps the filter.
        const urlParams = new URLSearchParams();
        if (kind !== "ALL") urlParams.set("kind", kind);
        if (status !== "ALL") urlParams.set("status", status);
        const qs = urlParams.toString();
        router.replace(`/notifications${qs ? `?${qs}` : ""}`, { scroll: false });
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, status, initialKind, initialStatus, router]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams(queryString);
      params.set("take", "50");
      params.set("cursor", nextCursor);
      const res = await fetch(`/api/notifications?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { notifications: NotificationDTO[]; nextCursor: string | null };
      setItems((arr) => [...arr, ...data.notifications]);
      setNextCursor(data.nextCursor ?? null);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleClick(n: NotificationDTO) {
    if (!n.readAt) {
      setItems((arr) =>
        arr.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await fetch(`/api/notifications/${n.id}/read`, { method: "POST" });
      } catch {
        // ignore
      }
    }
    if (n.url) router.push(n.url);
  }

  async function archiveOne(id: string) {
    setItems((arr) => arr.filter((n) => n.id !== id));
    try {
      await fetch(`/api/notifications/${id}/archive`, { method: "POST" });
    } catch {
      // ignore
    }
  }

  async function markAllRead() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
      setItems((arr) =>
        arr.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })),
      );
      setUnreadCount(0);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="bg-white rounded-xl overflow-hidden"
      style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
    >
      <div className="px-5 py-4 border-b border-[#f2f3ff] flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <div className="text-[14px] font-bold text-[#131b2e]">
            All notifications
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#fde2e2] text-[#9d1414]">
                {unreadCount} unread
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.4px] text-[#444656]">
            Kind
          </label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="px-2 py-1 text-[12px] rounded border border-[#c9c9c9]"
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <label className="text-[11px] font-semibold uppercase tracking-[0.4px] text-[#444656]">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-2 py-1 text-[12px] rounded border border-[#c9c9c9]"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={markAllRead}
            disabled={busy || unreadCount === 0}
            className="ml-2 text-[12px] font-semibold text-[#3052ff] disabled:text-[#a8a8a8]"
          >
            Mark all as read
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="px-5 py-12 text-center text-[13px] text-[#747474]">
          You&apos;re all caught up.
        </div>
      ) : (
        <ul>
          {items.map((n) => {
            const seed = n.actor?.id ?? n.actor?.email ?? n.actor?.name ?? n.kind;
            const initials = initialsFor(n.actor?.name, n.actor?.email);
            const unread = !n.readAt;
            return (
              <li
                key={n.id}
                className="flex items-start gap-3 px-5 py-3 border-b border-[#f2f3ff] last:border-b-0 hover:bg-[#faf8ff]"
                style={{ background: unread ? "#f4f6fe" : "#fff" }}
              >
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "#e0e5ee",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#3a3b4d",
                    overflow: "hidden",
                    position: "relative",
                    flex: "0 0 auto",
                  }}
                >
                  {initials}
                  {n.actor && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarFor(seed)}
                      alt=""
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => handleClick(n)}
                  className="flex-1 text-left"
                  style={{ background: "transparent", border: 0, padding: 0, cursor: n.url ? "pointer" : "default" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase"
                      style={{ background: "#eef0ff", color: "#3052ff" }}
                    >
                      {n.kind.replace(/_/g, " ").toLowerCase()}
                    </span>
                    <span className="text-[12.5px] font-semibold text-[#131b2e]">{n.title}</span>
                  </div>
                  {n.body && (
                    <div className="mt-1 text-[12px] text-[#5e6072]" style={{ wordBreak: "break-word" }}>
                      {n.body}
                    </div>
                  )}
                  <div className="mt-1 text-[11px] text-[#8e909d]">
                    {relativeTime(n.createdAt)}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => archiveOne(n.id)}
                  className="text-[11px] text-[#747474] hover:text-[#131b2e]"
                  title="Archive"
                >
                  Archive
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {nextCursor && (
        <div className="px-5 py-3 text-center border-t border-[#f2f3ff]">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="text-[12px] font-semibold text-[#3052ff]"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
