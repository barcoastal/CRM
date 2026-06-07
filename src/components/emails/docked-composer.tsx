"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useDockedComposer } from "./docked-composer-context";

interface Template {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string | null;
  bodyText: string | null;
  category: string | null;
}

interface SearchResult {
  id: string;
  entity: "Lead" | "Contact" | "Account" | "Opportunity";
  title: string;
  subtitle: string;
}

const FONT = '"Salesforce Sans", "Helvetica Neue", system-ui, -apple-system, sans-serif';

export function DockedComposer() {
  const { state, closeComposer, toggleMinimize, toggleExpand, patch } = useDockedComposer();
  const { data: session } = useSession();
  const editorRef = useRef<HTMLDivElement>(null);
  const lastSeededBodyRef = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [relatedQ, setRelatedQ] = useState("");
  const [relatedOpen, setRelatedOpen] = useState(false);
  const [relatedResults, setRelatedResults] = useState<SearchResult[]>([]);

  const fromAddress = session?.user?.email ?? "no-reply@coastaldebt.com";

  // Seed editor HTML when bodyHtml changes from outside (e.g., reply pre-fill)
  useEffect(() => {
    if (!editorRef.current) return;
    if (state.bodyHtml !== lastSeededBodyRef.current && state.bodyHtml !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = state.bodyHtml ?? "";
      lastSeededBodyRef.current = state.bodyHtml ?? "";
    }
  }, [state.bodyHtml, state.open, state.minimized]);

  // Lazy-load templates the first time the menu opens
  useEffect(() => {
    if (!showTemplates || templates.length > 0) return;
    void (async () => {
      try {
        const res = await fetch("/api/email-templates");
        if (res.ok) {
          const data = (await res.json()) as { templates?: Template[] } | Template[];
          const list = Array.isArray(data) ? data : data.templates ?? [];
          setTemplates(list);
        }
      } catch {
        // ignore
      }
    })();
  }, [showTemplates, templates.length]);

  // Warn before closing the tab with unsent content
  useEffect(() => {
    if (!state.open) return;
    const hasContent = !!(state.to || state.subject || (state.bodyHtml && state.bodyHtml.replace(/<[^>]*>/g, "").trim()));
    if (!hasContent) return;
    function beforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [state.open, state.to, state.subject, state.bodyHtml]);

  // Related-to search
  useEffect(() => {
    if (!relatedOpen || !relatedQ || relatedQ.trim().length < 2) {
      setRelatedResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(relatedQ.trim())}`, { signal: ctrl.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { results: SearchResult[] };
        setRelatedResults(data.results ?? []);
      } catch {
        // ignore
      }
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [relatedOpen, relatedQ]);

  const exec = useCallback((cmd: string, value?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(cmd, false, value);
    patch({ bodyHtml: editorRef.current.innerHTML });
  }, [patch]);

  const onEditorInput = useCallback(() => {
    if (!editorRef.current) return;
    patch({ bodyHtml: editorRef.current.innerHTML });
  }, [patch]);

  const insertLink = useCallback(() => {
    const url = window.prompt("Link URL");
    if (!url) return;
    exec("createLink", url);
  }, [exec]);

  const pickTemplate = useCallback((t: Template) => {
    patch({ subject: t.subject ?? "", bodyHtml: t.bodyHtml ?? t.bodyText ?? "" });
    if (editorRef.current) {
      editorRef.current.innerHTML = t.bodyHtml ?? t.bodyText ?? "";
      lastSeededBodyRef.current = editorRef.current.innerHTML;
    }
    setShowTemplates(false);
  }, [patch]);

  const pickRelated = useCallback((r: SearchResult) => {
    const update: Partial<typeof state> = {
      leadId: undefined,
      contactId: undefined,
      accountId: undefined,
      opportunityId: undefined,
      relatedLabel: `${r.entity}: ${r.title}`,
    };
    if (r.entity === "Lead") update.leadId = r.id;
    if (r.entity === "Contact") update.contactId = r.id;
    if (r.entity === "Account") update.accountId = r.id;
    if (r.entity === "Opportunity") update.opportunityId = r.id;
    patch(update);
    setRelatedOpen(false);
    setRelatedQ("");
  }, [patch, state]);

  async function send() {
    if (!state.to) {
      toast.error("Recipient required");
      return;
    }
    if (!state.subject) {
      toast.error("Subject required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/emails/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: state.to,
          cc: state.cc || undefined,
          bcc: state.bcc || undefined,
          subject: state.subject,
          bodyHtml: state.bodyHtml,
          leadId: state.leadId,
          opportunityId: state.opportunityId,
          accountId: state.accountId,
          contactId: state.contactId,
          creditorId: state.creditorId,
          caseId: state.caseId,
          sendNow: true,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        toast.success("Email sent");
        closeComposer();
      } else {
        toast.error(data.error ?? "Send failed", { duration: 7000 });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  if (!state.open) return null;

  // Minimized state: only header bar
  if (state.minimized) {
    return (
      <div style={dockedMinimized}>
        <div style={{ ...headerBar, cursor: "pointer" }} onClick={toggleMinimize}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, overflow: "hidden" }}>
            <EnvelopeIcon />
            <span style={headerTitle}>{state.subject || "New Email"}</span>
          </div>
          <div style={iconRow}>
            <button onClick={(e) => { e.stopPropagation(); toggleMinimize(); }} style={iconBtn} title="Expand">
              <CaretUp />
            </button>
            <button onClick={(e) => { e.stopPropagation(); closeComposer(); }} style={iconBtn} title="Close">
              <CloseIcon />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const wrapStyle: React.CSSProperties = state.expanded
    ? expandedShell
    : dockedShell;

  return (
    <div style={wrapStyle}>
      {/* Header */}
      <div style={headerBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <EnvelopeIcon />
          <span style={headerTitle}>Email</span>
        </div>
        <div style={iconRow}>
          <button onClick={toggleMinimize} style={iconBtn} title="Minimize">
            <MinusIcon />
          </button>
          <button onClick={toggleExpand} style={iconBtn} title={state.expanded ? "Collapse" : "Expand"}>
            {state.expanded ? <CollapseIcon /> : <ExpandIcon />}
          </button>
          <button onClick={closeComposer} style={iconBtn} title="Close">
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={bodyArea}>
        {/* From */}
        <FieldRow label="From">
          <div style={fromValue}>{fromAddress}</div>
        </FieldRow>

        {/* To with chips */}
        <FieldRow label="To" actions={
          <div style={{ display: "flex", gap: 12 }}>
            {!state.showCc && (
              <button type="button" onClick={() => patch({ showCc: true })} style={linkBtn}>Cc</button>
            )}
            {!state.showBcc && (
              <button type="button" onClick={() => patch({ showBcc: true })} style={linkBtn}>Bcc</button>
            )}
          </div>
        }>
          <ChipInput
            value={state.to ?? ""}
            onChange={(v) => patch({ to: v })}
            placeholder="Add recipients"
          />
        </FieldRow>

        {/* Cc */}
        {state.showCc && (
          <FieldRow label="Cc">
            <ChipInput
              value={state.cc ?? ""}
              onChange={(v) => patch({ cc: v })}
              placeholder=""
            />
          </FieldRow>
        )}

        {/* Bcc */}
        {state.showBcc && (
          <FieldRow label="Bcc">
            <ChipInput
              value={state.bcc ?? ""}
              onChange={(v) => patch({ bcc: v })}
              placeholder=""
            />
          </FieldRow>
        )}

        {/* Subject */}
        <FieldRow label="Subject">
          <input
            value={state.subject ?? ""}
            onChange={(e) => patch({ subject: e.target.value })}
            placeholder=""
            style={plainInput}
          />
        </FieldRow>

        {/* Related To */}
        <FieldRow label="Related To">
          <div style={{ position: "relative" }}>
            {state.relatedLabel ? (
              <div style={relatedChip}>
                <span>{state.relatedLabel}</span>
                <button
                  type="button"
                  onClick={() => patch({ relatedLabel: undefined, leadId: undefined, contactId: undefined, accountId: undefined, opportunityId: undefined })}
                  style={chipX}
                >×</button>
              </div>
            ) : (
              <input
                value={relatedQ}
                onChange={(e) => { setRelatedQ(e.target.value); setRelatedOpen(true); }}
                onFocus={() => setRelatedOpen(true)}
                placeholder="Search leads, contacts, accounts, opportunities"
                style={plainInput}
              />
            )}
            {relatedOpen && relatedResults.length > 0 && (
              <div style={relatedDropdown}>
                {relatedResults.map((r) => (
                  <button key={`${r.entity}-${r.id}`} type="button" onClick={() => pickRelated(r)} style={relatedItem}>
                    <span style={{ ...entityBadge, background: entityColor(r.entity) }}>{r.entity[0]}</span>
                    <div style={{ display: "flex", flexDirection: "column", textAlign: "left", flex: 1, overflow: "hidden" }}>
                      <span style={{ fontSize: 13, color: "#080707", textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden" }}>{r.title}</span>
                      <span style={{ fontSize: 11, color: "#706e6b" }}>{r.subtitle}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </FieldRow>

        {/* Toolbar */}
        <div style={toolbar}>
          <ToolbarBtn onClick={() => exec("bold")} label="B" style={{ fontWeight: 700 }} title="Bold" />
          <ToolbarBtn onClick={() => exec("italic")} label="I" style={{ fontStyle: "italic" }} title="Italic" />
          <ToolbarBtn onClick={() => exec("underline")} label="U" style={{ textDecoration: "underline" }} title="Underline" />
          <div style={toolbarSep} />
          <ToolbarBtn onClick={insertLink} label="Link" title="Insert link" />
          <ToolbarBtn onClick={() => exec("insertUnorderedList")} label="• List" title="Bulleted list" />
          <ToolbarBtn onClick={() => exec("insertOrderedList")} label="1. List" title="Numbered list" />
        </div>

        {/* Editor */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={onEditorInput}
          style={editor(state.expanded)}
        />
      </div>

      {/* Footer */}
      <div style={footer}>
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontSize: 11, color: "#706e6b" }}>
          Draft saved
        </div>
        <div style={{ display: "flex", gap: 8, position: "relative" }}>
          <button type="button" style={footerIcon} title="Attach" onClick={() => toast.message("Attachments coming soon")}>
            <AttachIcon />
          </button>
          <button type="button" style={footerIcon} title="Insert template" onClick={() => setShowTemplates((v) => !v)}>
            <TemplateIcon />
          </button>
          {showTemplates && (
            <div style={templateDropdown}>
              <div style={templateHeader}>Insert Template</div>
              {templates.length === 0 ? (
                <div style={{ padding: 12, color: "#706e6b", fontSize: 12 }}>No templates</div>
              ) : (
                templates.map((t) => (
                  <button key={t.id} type="button" onClick={() => pickTemplate(t)} style={templateItem}>
                    <span style={{ fontSize: 13, color: "#080707" }}>{t.name}</span>
                    {t.category && <span style={{ fontSize: 11, color: "#706e6b" }}>{t.category}</span>}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <button onClick={send} disabled={busy || !state.to || !state.subject} style={sendBtn}>
          {busy ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}

/* --------------------- small subcomponents --------------------- */

function FieldRow({ label, actions, children }: { label: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={fieldRow}>
      <div style={fieldLabel}>{label}</div>
      <div style={fieldValue}>{children}</div>
      {actions && <div style={fieldActions}>{actions}</div>}
    </div>
  );
}

function ChipInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [pending, setPending] = useState("");
  const chips = value
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  function commit(v: string) {
    const next = v.trim();
    if (!next) return;
    const merged = [...chips, next].join(", ");
    onChange(merged);
    setPending("");
  }
  function removeAt(i: number) {
    const next = chips.filter((_, idx) => idx !== i).join(", ");
    onChange(next);
  }

  return (
    <div style={chipWrap}>
      {chips.map((c, i) => (
        <span key={`${c}-${i}`} style={chip}>
          {c}
          <button type="button" onClick={() => removeAt(i)} style={chipX}>×</button>
        </span>
      ))}
      <input
        value={pending}
        onChange={(e) => setPending(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "," || e.key === ";" || e.key === "Tab") {
            if (pending.trim()) {
              e.preventDefault();
              commit(pending);
            }
          } else if (e.key === "Backspace" && !pending && chips.length > 0) {
            removeAt(chips.length - 1);
          }
        }}
        onBlur={() => pending.trim() && commit(pending)}
        placeholder={chips.length === 0 ? placeholder : ""}
        style={chipInput}
      />
    </div>
  );
}

function ToolbarBtn({ onClick, label, style, title }: { onClick: () => void; label: string; style?: React.CSSProperties; title?: string }) {
  return (
    <button type="button" onClick={onClick} title={title} style={{ ...toolbarBtn, ...style }}>{label}</button>
  );
}

/* --------------------- inline icons (no extra deps) --------------------- */

function EnvelopeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
    </svg>
  );
}
function MinusIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="11" width="16" height="2" /></svg>;
}
function ExpandIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 14v6h6M20 10V4h-6" />
    </svg>
  );
}
function CollapseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 4v6H4M14 20v-6h6" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M6 6l12 12M18 6l-12 12" />
    </svg>
  );
}
function CaretUp() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5z" /></svg>
  );
}
function AttachIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}
function TemplateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  );
}

function entityColor(e: SearchResult["entity"]) {
  switch (e) {
    case "Lead": return "#1589ee";
    case "Contact": return "#04844b";
    case "Account": return "#df9f00";
    case "Opportunity": return "#cf3476";
  }
}

/* --------------------- styles --------------------- */

const dockedShell: React.CSSProperties = {
  position: "fixed",
  right: 24,
  bottom: 0,
  width: 480,
  height: 520,
  background: "#fff",
  border: "1px solid #d8dde6",
  borderBottom: "none",
  borderTopLeftRadius: 6,
  borderTopRightRadius: 6,
  boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
  display: "flex",
  flexDirection: "column",
  zIndex: 8500,
  fontFamily: FONT,
  overflow: "hidden",
};

const dockedMinimized: React.CSSProperties = {
  position: "fixed",
  right: 24,
  bottom: 0,
  width: 320,
  background: "#fff",
  border: "1px solid #d8dde6",
  borderBottom: "none",
  borderTopLeftRadius: 6,
  borderTopRightRadius: 6,
  boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
  zIndex: 8500,
  fontFamily: FONT,
  overflow: "hidden",
};

const expandedShell: React.CSSProperties = {
  position: "fixed",
  right: 24,
  bottom: 0,
  width: "min(960px, calc(100vw - 48px))",
  height: "calc(100vh - 56px)",
  background: "#fff",
  border: "1px solid #d8dde6",
  borderBottom: "none",
  borderTopLeftRadius: 6,
  borderTopRightRadius: 6,
  boxShadow: "0 10px 30px rgba(0,0,0,0.22)",
  display: "flex",
  flexDirection: "column",
  zIndex: 8500,
  fontFamily: FONT,
  overflow: "hidden",
};

const headerBar: React.CSSProperties = {
  background: "#16325c",
  color: "#fff",
  padding: "8px 12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  flexShrink: 0,
};

const headerTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const iconRow: React.CSSProperties = { display: "flex", gap: 4 };

const iconBtn: React.CSSProperties = {
  background: "transparent",
  border: 0,
  color: "#fff",
  width: 24,
  height: 24,
  borderRadius: 3,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const bodyArea: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "8px 12px",
  display: "flex",
  flexDirection: "column",
  gap: 0,
};

const fieldRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "70px 1fr auto",
  alignItems: "center",
  gap: 8,
  padding: "6px 0",
  borderBottom: "1px solid #ecebea",
};

const fieldLabel: React.CSSProperties = { fontSize: 12, color: "#706e6b" };
const fieldValue: React.CSSProperties = { minWidth: 0 };
const fieldActions: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8 };

const fromValue: React.CSSProperties = {
  fontSize: 13,
  color: "#080707",
  padding: "4px 0",
};

const plainInput: React.CSSProperties = {
  width: "100%",
  border: 0,
  outline: "none",
  fontSize: 13,
  background: "transparent",
  fontFamily: FONT,
  padding: "4px 0",
  color: "#080707",
};

const linkBtn: React.CSSProperties = {
  background: "transparent",
  border: 0,
  color: "#1589ee",
  fontSize: 12,
  cursor: "pointer",
  padding: 0,
};

const chipWrap: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 4,
  alignItems: "center",
  padding: "2px 0",
};

const chip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  background: "#ecebea",
  border: "1px solid #d8dde6",
  color: "#080707",
  fontSize: 12,
  padding: "2px 4px 2px 8px",
  borderRadius: 12,
};

const chipX: React.CSSProperties = {
  background: "transparent",
  border: 0,
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
  color: "#706e6b",
  padding: "0 2px",
};

const chipInput: React.CSSProperties = {
  flex: 1,
  minWidth: 100,
  border: 0,
  outline: "none",
  fontSize: 13,
  background: "transparent",
  fontFamily: FONT,
  padding: "4px 0",
};

const relatedChip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "#ecf6ff",
  border: "1px solid #c8e1ff",
  color: "#0070d2",
  fontSize: 12,
  padding: "3px 4px 3px 10px",
  borderRadius: 12,
};

const relatedDropdown: React.CSSProperties = {
  position: "absolute",
  top: "100%",
  left: 0,
  right: 0,
  background: "#fff",
  border: "1px solid #d8dde6",
  borderRadius: 4,
  boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
  zIndex: 10,
  maxHeight: 260,
  overflowY: "auto",
};

const relatedItem: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  width: "100%",
  background: "transparent",
  border: 0,
  borderBottom: "1px solid #f4f4f4",
  cursor: "pointer",
  textAlign: "left",
};

const entityBadge: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: 3,
  color: "#fff",
  fontSize: 11,
  fontWeight: 700,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const toolbar: React.CSSProperties = {
  display: "flex",
  gap: 4,
  padding: "8px 0 6px",
  alignItems: "center",
  borderBottom: "1px solid #ecebea",
};

const toolbarBtn: React.CSSProperties = {
  background: "transparent",
  border: 0,
  color: "#080707",
  fontSize: 13,
  cursor: "pointer",
  width: 28,
  height: 24,
  borderRadius: 3,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 6px",
  minWidth: 28,
};

const toolbarSep: React.CSSProperties = {
  width: 1,
  height: 16,
  background: "#d8dde6",
  margin: "0 4px",
};

function editor(expanded: boolean): React.CSSProperties {
  return {
    flex: 1,
    minHeight: expanded ? 240 : 140,
    padding: "10px 4px",
    fontSize: 13,
    lineHeight: 1.5,
    color: "#080707",
    outline: "none",
    fontFamily: FONT,
    overflowY: "auto",
  };
}

const footer: React.CSSProperties = {
  borderTop: "1px solid #ecebea",
  padding: "8px 12px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexShrink: 0,
  background: "#fafaf9",
  position: "relative",
};

const footerIcon: React.CSSProperties = {
  background: "transparent",
  border: 0,
  width: 30,
  height: 30,
  borderRadius: 3,
  cursor: "pointer",
  color: "#706e6b",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const sendBtn: React.CSSProperties = {
  background: "#0070d2",
  color: "#fff",
  padding: "6px 24px",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  border: 0,
  cursor: "pointer",
};

const templateDropdown: React.CSSProperties = {
  position: "absolute",
  bottom: "100%",
  left: 0,
  marginBottom: 6,
  background: "#fff",
  border: "1px solid #d8dde6",
  borderRadius: 4,
  boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
  width: 260,
  maxHeight: 260,
  overflowY: "auto",
  zIndex: 12,
};

const templateHeader: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 11,
  color: "#706e6b",
  textTransform: "uppercase",
  borderBottom: "1px solid #ecebea",
  fontWeight: 600,
};

const templateItem: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  padding: "8px 10px",
  width: "100%",
  background: "transparent",
  border: 0,
  borderBottom: "1px solid #f4f4f4",
  cursor: "pointer",
  textAlign: "left",
  gap: 2,
};
