"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Selection context for the generic ListView lists (tasks/cases/events/etc).
 *
 * Distinct from the SfListPage's SfSelectionProvider — keeping them
 * separate so the two list table flavours don't import each other.
 */

interface SelectionState {
  ids: string[];
  selected: Set<string>;
  toggle: (id: string) => void;
  toggleAll: () => void;
  clear: () => void;
}

const Ctx = createContext<SelectionState | null>(null);

export function ListSelectionProvider({
  ids,
  children,
}: {
  ids: string[];
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const idsKey = ids.join("|");
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set<string>();
      for (const id of prev) if (ids.includes(id)) next.add(id);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === ids.length) return new Set();
      return new Set(ids);
    });
  }, [ids]);

  const clear = useCallback(() => setSelected(new Set()), []);

  const value = useMemo(
    () => ({ ids, selected, toggle, toggleAll, clear }),
    [ids, selected, toggle, toggleAll, clear],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useListSelection(): SelectionState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useListSelection must be inside <ListSelectionProvider>");
  return ctx;
}
