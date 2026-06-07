"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";

export interface ComposerSeed {
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  bodyHtml?: string;
  leadId?: string;
  opportunityId?: string;
  accountId?: string;
  contactId?: string;
  creditorId?: string;
  caseId?: string;
  relatedLabel?: string;
}

export interface ComposerState extends ComposerSeed {
  open: boolean;
  minimized: boolean;
  expanded: boolean;
  showCc: boolean;
  showBcc: boolean;
}

const DEFAULT_STATE: ComposerState = {
  open: false,
  minimized: false,
  expanded: false,
  showCc: false,
  showBcc: false,
  to: "",
  cc: "",
  bcc: "",
  subject: "",
  bodyHtml: "",
};

const STORAGE_KEY = "cd_email_composer_v1";

interface ComposerContextValue {
  state: ComposerState;
  openComposer: (seed?: ComposerSeed) => void;
  closeComposer: () => void;
  toggleMinimize: () => void;
  toggleExpand: () => void;
  patch: (partial: Partial<ComposerState>) => void;
}

const Ctx = createContext<ComposerContextValue | null>(null);

export function DockedComposerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ComposerState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from sessionStorage once
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ComposerState;
        setState({ ...DEFAULT_STATE, ...parsed });
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  // Persist
  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state, hydrated]);

  const openComposer = useCallback((seed?: ComposerSeed) => {
    setState((prev) => ({
      ...DEFAULT_STATE,
      ...prev,
      ...seed,
      open: true,
      minimized: false,
      showCc: seed?.cc ? true : prev.showCc,
      showBcc: seed?.bcc ? true : prev.showBcc,
    }));
  }, []);

  const closeComposer = useCallback(() => {
    setState({ ...DEFAULT_STATE });
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const toggleMinimize = useCallback(() => {
    setState((prev) => ({ ...prev, minimized: !prev.minimized, expanded: prev.minimized ? prev.expanded : false }));
  }, []);

  const toggleExpand = useCallback(() => {
    setState((prev) => ({ ...prev, expanded: !prev.expanded, minimized: false }));
  }, []);

  const patch = useCallback((partial: Partial<ComposerState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  return (
    <Ctx.Provider value={{ state, openComposer, closeComposer, toggleMinimize, toggleExpand, patch }}>
      {children}
    </Ctx.Provider>
  );
}

export function useDockedComposer() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDockedComposer must be used inside DockedComposerProvider");
  return v;
}
