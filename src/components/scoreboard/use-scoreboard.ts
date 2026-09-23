"use client";

import { useEffect, useRef, useState } from "react";
import { SCOREBOARD_POLL_MS, unseenWins, type ScoreboardPayload, type ScoreboardEvent, type WinCursor, type WinPayload, type PassPayload } from "@/lib/scoreboard-shared";

const STORAGE_KEY = "coastal-scoreboard-events-v2";
const FEEDS = ["wins", "passes"] as const;
type Feed = typeof FEEDS[number];
function validCursor(value: WinCursor | null | undefined): value is WinCursor {
  return Boolean(value && Number.isFinite(Date.parse(value.at)) && Date.parse(value.at) <= Date.now() + 60_000 && typeof value.id === "string" && value.id.length <= 100);
}
export function useScoreboard(period: string, live: boolean, revision: number, onEvents: (events: ScoreboardEvent[]) => void) {
  const [data, setData] = useState<ScoreboardPayload | null>(null);
  const [error, setError] = useState("");
  const [feedError, setFeedError] = useState("");
  const seen = useRef(new Set<string>());
  const cursors = useRef<Record<Feed, WinCursor | null>>({ wins: null, passes: null });

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
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || sessionStorage.getItem("coastal-scoreboard-events-v1") || "null");
      for (const feed of FEEDS) {
        const candidate = saved?.cursors?.[feed] ?? (feed === "wins" ? saved?.cursor : null);
        if (validCursor(candidate)) cursors.current[feed] = candidate;
      }
      if (Array.isArray(saved?.seen)) seen.current = new Set(saved.seen.filter((id: unknown) => typeof id === "string").slice(-2000));
    } catch { /* Storage is optional, including in private browsing. */ }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      let more = false;
      try {
        // Each stream owns its cursor, so an endpoint error cannot discard
        // successful observations from the other stream.
        const results = await Promise.allSettled(FEEDS.map(async (feed) => {
          const cursor = cursors.current[feed];
          const query = cursor ? `?${new URLSearchParams({ since: cursor.at, after: cursor.id })}` : "";
          const response = await fetch(`/api/scoreboard/${feed}${query}`, { cache: "no-store", signal: controller.signal });
          if (!response.ok) throw new Error(feed);
          return { feed, payload: await response.json() as WinPayload | PassPayload };
        }));
        if (controller.signal.aborted) return;
        const observed: ScoreboardEvent[] = [];
        let failures = 0;
        for (const result of results) {
          if (result.status === "rejected") { failures++; continue; }
          const { feed, payload } = result.value;
          observed.push(...payload.events);
          cursors.current[feed] = payload.cursor;
          more ||= payload.hasMore;
        }
        const incoming = unseenWins(observed, seen.current);
        incoming.forEach((event) => seen.current.add(event.id));
        seen.current = new Set([...seen.current].slice(-2000));
        try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ cursors: cursors.current, seen: [...seen.current] })); } catch { /* Keep the in-memory cursors. */ }
        if (incoming.length) onEvents(incoming);
        setFeedError(failures ? "Some live celebrations are reconnecting." : "");
      } catch { if (!controller.signal.aborted) setFeedError("Live celebrations are reconnecting."); }
      finally { if (!controller.signal.aborted) timer = setTimeout(poll, more ? 200 : SCOREBOARD_POLL_MS); }
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [live, onEvents]);
  return { data: data?.period === period ? data : null, error, feedError: live ? feedError : "" };
}
