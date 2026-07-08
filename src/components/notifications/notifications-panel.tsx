"use client";

/**
 * Bell-dropdown panel. Fetches the latest 10 unread notifications, lets the
 * user click through (marks read + navigates) or hit "Mark all as read".
 *
 * Polls every 30s while the page is open. Refetches when opened so an already-
 * mounted dropdown shows fresh counts immediately.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { avatarFor } from "@/lib/avatars";

interface Actor {
  id: string;
  name: string | null;
  email: string | null;
}

export interface NotificationDTO {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  url: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  actor: Actor | null;
}

const POLL_MS = 30_000;

function relativeTime(iso: string): string {
  const dt = new Date(iso);
  const diff = Date.now() - dt.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function initialsFor(name: string | null | undefined, email: string | null | undefined): string {
  const src = (name ?? email ?? "?").trim();
  if (!src) return "?";
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0]! + parts[1][0]!).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function kindIcon(kind: string): string {
  switch (kind) {
    case "OWNER_ASSIGNED":
      return "/slds/icons/utility-sprite/svg/symbols.svg#user";
    case "MENTION":
      return "/slds/icons/utility-sprite/svg/symbols.svg#chat";
    case "APPROVAL_REQUEST":
    case "APPROVAL_DECIDED":
      return "/slds/icons/utility-sprite/svg/symbols.svg#approval";
    case "ENVELOPE_SIGNED":
      return "/slds/icons/utility-sprite/svg/symbols.svg#contract";
    case "MASS_EMAIL_DONE":
      return "/slds/icons/utility-sprite/svg/symbols.svg#email";
    case "TASK_DUE":
      return "/slds/icons/utility-sprite/svg/symbols.svg#task";
    case "LEAD_INBOUND":
      return "/slds/icons/utility-sprite/svg/symbols.svg#lead";
    default:
      return "/slds/icons/utility-sprite/svg/symbols.svg#notification";
  }
}

export function useNotificationsCount(): { unreadCount: number; refetch: () => void } {
  const [unreadCount, setUnreadCount] = useState(0);
  const fetchedRef = useRef(false);
  const refetch = useCallback(() => {
    fetch("/api/notifications?unreadOnly=1&take=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.unreadCount === "number") {
          setUnreadCount(data.unreadCount);
        }
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    refetch();
    const t = window.setInterval(refetch, POLL_MS);
    return () => window.clearInterval(t);
  }, [refetch]);
  return { unreadCount, refetch };
}

interface NotificationsPanelProps {
  onClose: () => void;
  onCountChange?: (count: number) => void;
}

export function NotificationsPanel({ onClose, onCountChange }: NotificationsPanelProps) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?unreadOnly=1&take=10", { cache: "no-store" });
      if (!res.ok) {
        setItems([]);
        return;
      }
      const data = (await res.json()) as { notifications: NotificationDTO[]; unreadCount: number };
      setItems(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
      onCountChange?.(data.unreadCount ?? 0);
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    void load();
    const t = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(t);
  }, [load]);

  async function markRead(id: string) {
    setItems((arr) => arr.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    onCountChange?.(Math.max(0, unreadCount - 1));
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    } catch {
      // ignore
    }
  }

  async function markAllRead() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
      setItems([]);
      setUnreadCount(0);
      onCountChange?.(0);
    } finally {
      setBusy(false);
    }
  }

  function handleClick(n: NotificationDTO) {
    void markRead(n.id);
    onClose();
    if (n.url) router.push(n.url);
  }

  return (
    <div
      role="menu"
      className="sf-profile-menu"
      style={{
        position: "absolute",
        top: 36,
        right: 0,
        width: 360,
        padding: 0,
        maxHeight: 520,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid #c9c9c9",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 13 }}>
          Notifications
          {unreadCount > 0 && (
            <span
              style={{
                marginLeft: 6,
                background: "#c23934",
                color: "#fff",
                borderRadius: 10,
                padding: "1px 7px",
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {unreadCount}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={markAllRead}
          disabled={busy || unreadCount === 0}
          style={{
            background: "transparent",
            border: 0,
            color: unreadCount === 0 ? "#a8a8a8" : "#0176d3",
            cursor: unreadCount === 0 ? "default" : "pointer",
            fontSize: 11,
            fontWeight: 600,
            padding: 0,
          }}
        >
          Mark all as read
        </button>
      </div>

      <div style={{ overflowY: "auto", flex: 1 }}>
        {loading && items.length === 0 ? (
          <div style={{ padding: 18, fontSize: 12, color: "#747474" }}>Loading…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 22, fontSize: 12, color: "#747474", textAlign: "center" }}>
            You&apos;re all caught up.
          </div>
        ) : (
          items.map((n) => {
            const seed = n.actor?.id ?? n.actor?.email ?? n.actor?.name ?? n.kind;
            const initials = initialsFor(n.actor?.name, n.actor?.email);
            const unread = !n.readAt;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => handleClick(n)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  width: "100%",
                  padding: "10px 14px",
                  border: 0,
                  borderBottom: "1px solid #f3f2f2",
                  background: unread ? "#f4f6fe" : "#fff",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <span style={{ position: "relative", flex: "0 0 auto" }}>
                  <span
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "#e0e5ee",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#3a3b4d",
                      overflow: "hidden",
                      position: "relative",
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
                  <svg
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      bottom: -2,
                      right: -2,
                      width: 14,
                      height: 14,
                      background: "#fff",
                      borderRadius: 4,
                      padding: 1,
                      fill: "#3052ff",
                    }}
                  >
                    <use xlinkHref={kindIcon(n.kind)} />
                  </svg>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: unread ? 600 : 500,
                      color: "#131b2e",
                      fontSize: 12.5,
                      lineHeight: 1.35,
                      wordBreak: "break-word",
                    }}
                  >
                    {n.title}
                  </div>
                  {n.body && (
                    <div
                      style={{
                        fontSize: 11.5,
                        color: "#5e6072",
                        marginTop: 2,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {n.body}
                    </div>
                  )}
                  <div style={{ fontSize: 10.5, color: "#8e909d", marginTop: 4 }}>
                    {relativeTime(n.createdAt)}
                  </div>
                </div>
                {unread && (
                  <span
                    aria-label="Unread"
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "#3052ff",
                      marginTop: 6,
                      flex: "0 0 auto",
                    }}
                  />
                )}
              </button>
            );
          })
        )}
      </div>

      <div
        style={{
          padding: "8px 14px",
          borderTop: "1px solid #c9c9c9",
          fontSize: 12,
          textAlign: "center",
        }}
      >
        <Link
          href="/notifications"
          onClick={onClose}
          style={{ color: "#0176d3", fontWeight: 600, textDecoration: "none" }}
        >
          See all notifications
        </Link>
      </div>
    </div>
  );
}
