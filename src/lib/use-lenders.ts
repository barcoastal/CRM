"use client";

import { useEffect, useState } from "react";

/**
 * Client-side lender directory cache. One fetch of /api/lenders per page
 * load, shared by every component (intel cards, row markers, directory,
 * creditor typeahead).
 */

export interface DbLender {
  id: string;
  name: string;
  nameNorm: string;
  aka: string | null;
  plaidFinicity: boolean;
  lienRiskLevel: number | null;
  coj: boolean;
  tro: boolean;
  venue: string | null;
  notes: string | null;
  legal: string | null;
  source: string;
}

interface LenderState {
  lenders: DbLender[];
  canEdit: boolean;
  loaded: boolean;
}

let cache: LenderState = { lenders: [], canEdit: false, loaded: false };
let inflight: Promise<LenderState> | null = null;
const listeners = new Set<() => void>();

async function load(force = false): Promise<LenderState> {
  if (cache.loaded && !force) return cache;
  if (inflight && !force) return inflight;
  inflight = fetch("/api/lenders")
    .then((r) => (r.ok ? r.json() : { lenders: [], canEdit: false }))
    .then((d: { lenders?: DbLender[]; canEdit?: boolean }) => {
      cache = { lenders: d.lenders ?? [], canEdit: !!d.canEdit, loaded: true };
      listeners.forEach((fn) => fn());
      return cache;
    })
    .catch(() => cache);
  return inflight;
}

export function useLenders(): LenderState & { refresh: () => Promise<void> } {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    void load();
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return {
    ...cache,
    refresh: async () => {
      await load(true);
    },
  };
}

const norm = (s: string): string => s.trim().toLowerCase().replace(/[^a-z0-9 ]/g, "");

/** Match a creditor name against the loaded directory (name, alias, partial). */
export function matchLender(lenders: DbLender[], name: string | null | undefined): DbLender | null {
  if (!name) return null;
  const n = norm(name);
  if (!n) return null;
  for (const l of lenders) if (l.nameNorm === n) return l;
  for (const l of lenders) {
    const akas = (l.aka ?? "").split("/").map((a) => norm(a)).filter(Boolean);
    if (akas.includes(n)) return l;
  }
  for (const l of lenders) {
    if (l.nameNorm.length >= 5 && (n.includes(l.nameNorm) || l.nameNorm.includes(n))) return l;
  }
  return null;
}
