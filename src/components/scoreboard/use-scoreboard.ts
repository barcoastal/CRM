"use client";

import { useEffect, useRef, useState } from "react";
import { SCOREBOARD_POLL_MS, unseenWins, type ScoreboardPayload, type WinCursor, type WinEvent, type WinPayload } from "@/lib/scoreboard-shared";

const STORAGE_KEY = "coastal-scoreboard-events-v1";
export function useScoreboard(period: string, live: boolean, revision: number, onWins: (events: WinEvent[]) => void) {
  const [data, setData] = useState<ScoreboardPayload | null>(null);
  const [error, setError] = useState("");
  const [feedError, setFeedError] = useState("");
  const seen = useRef(new Set<string>());
  const cursor = useRef<WinCursor | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const response = await fetch(`/api/scoreboard/monthly?period=${period}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 401 ? "Your session expired. Sign in again to reconnect." : "Scoreboard refresh delayed. Retrying automatically.");
        const result: ScoreboardPayload = await response.json();
        if (!controller.signal.aborted) { setData(result); setError(""); }
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Connection interrupted. Retrying automatically."); }
      finally { if (!controller.signal.aborted) timer = setTimeout(refresh, SCOREBOARD_POLL_MS); }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [period, revision]);

  useEffect(() => {
    if (!live) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
      if (saved?.cursor && Number.isFinite(Date.parse(saved.cursor.at)) && typeof saved.cursor.id === "string") cursor.current = saved.cursor;
      if (Array.isArray(saved?.seen)) seen.current = new Set(saved.seen.filter((id: unknown) => typeof id === "string").slice(-2000));
    } catch { /* Storage is optional, including in private browsing. */ }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      let more = false;
      try {
        const query = cursor.current ? `?${new URLSearchParams({ since: cursor.current.at, after: cursor.current.id })}` : "";
        const response = await fetch(`/api/scoreboard/wins${query}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Live celebrations are reconnecting.");
        const payload: WinPayload = await response.json();
        if (controller.signal.aborted) return;
        const incoming = unseenWins(payload.events, seen.current);
        incoming.forEach((event) => seen.current.add(event.id));
        seen.current = new Set([...seen.current].slice(-2000));
        cursor.current = payload.cursor;
        try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ cursor: cursor.current, seen: [...seen.current] })); } catch { /* Keep the in-memory cursor. */ }
        if (incoming.length) onWins(incoming);
        more = payload.hasMore;
        setFeedError("");
      } catch { if (!controller.signal.aborted) setFeedError("Live celebrations are reconnecting."); }
      finally { if (!controller.signal.aborted) timer = setTimeout(poll, more ? 200 : SCOREBOARD_POLL_MS); }
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [live, onWins]);
  return { data: data?.period === period ? data : null, error, feedError: live ? feedError : "" };
}
