"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDockedComposer } from "@/components/emails/docked-composer-context";

type Folder = "all" | "inbox" | "sent" | "drafts" | "trash";

export interface InboxRow {
  id: string;
  direction: string;
  status: string;
  fromAddress: string;
  toAddresses: string;
  subject: string;
  sentAt: string;
  accountName: string | null;
  leadName: string | null;
  contactName: string | null;
}

export interface InboxDetail {
  id: string;
  direction: string;
  status: string;
  fromAddress: string;
  toAddresses: string;
  cc: string | null;
  bcc: string | null;
  subject: string;
  bodyHtml: string | null;
  bodyText: string | null;
  sentAt: string;
  ownerName: string | null;
  accountId: string | null;
  accountName: string | null;
  leadId: string | null;
  leadName: string | null;
  contactId: string | null;
  contactName: string | null;
  opportunityId: string | null;
  caseId: string | null;
}

const FONT = '"Salesforce Sans", "Helvetica Neue", system-ui, -apple-system, sans-serif';

const FOLDERS: { key: Folder; label: string; icon: React.ReactNode }[] = [
  { key: "all", label: "All Emails", icon: <FolderIcon /> },
  { key: "inbox", label: "Inbox", icon: <InboxIcon /> },
  { key: "sent", label: "Sent", icon: <SentIcon /> },
  { key: "drafts", label: "Drafts", icon: <DraftIcon /> },
  { key: "trash", label: "Trash", icon: <TrashIcon /> },
];

export function InboxClient({
  folder,
  counts,
  rows,
  selected,
}: {
  folder: Folder;
  counts: Record<Folder, number>;
  rows: InboxRow[];
  selected: InboxDetail | null;
}) {
  const router = useRouter();
  const { openComposer } = useDockedComposer();

  function selectRow(id: string) {
    const params = new URLSearchParams();
    params.set("folder", folder);
    params.set("id", id);
    router.push(`/emails?${params.toString()}`);
  }

  function newEmail() {
    openComposer({ to: "", subject: "", bodyHtml: "" });
  }

  function reply(mode: "reply" | "reply-all" | "forward") {
    if (!selected) return;
    const subjectClean = selected.subject?.replace(/^(Re:|Fwd:)\s*/i, "") ?? "";
    const prefix = mode === "forward" ? "Fwd:" : "Re:";
    const newSubject = `${prefix} ${subjectClean}`.trim();

    const original = selected.bodyHtml ?? (selected.bodyText ? `<pre>${escapeHtml(selected.bodyText)}</pre>` : "");
    const quoted = `
<br/><br/>
<div style="border-left:2px solid #d8dde6;padding-left:10px;color:#54698d;font-size:12px;">
  <div><strong>From:</strong> ${escapeHtml(selected.fromAddress)}</div>
  <div><strong>Date:</strong> ${escapeHtml(new Date(selected.sentAt).toLocaleString())}</div>
  <div><strong>Subject:</strong> ${escapeHtml(selected.subject)}</div>
  <div><strong>To:</strong> ${escapeHtml(selected.toAddresses)}</div>
  <br/>
  ${original}
</div>`;

    let to = "";
    let cc = "";
    if (mode === "reply" || mode === "reply-all") {
      to = selected.direction === "INBOUND" ? selected.fromAddress : selected.toAddresses;
    }
    if (mode === "reply-all") {
      const others = selected.toAddresses
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s && s.toLowerCase() !== to.toLowerCase());
      const ccParts = [...others];
      if (selected.cc) ccParts.push(selected.cc);
      cc = ccParts.filter(Boolean).join(", ");
    }
    if (mode === "forward") {
      to = "";
    }

    const relatedLabel = selected.accountName
      ? `Account: ${selected.accountName}`
      : selected.leadName
      ? `Lead: ${selected.leadName}`
      : selected.contactName
      ? `Contact: ${selected.contactName}`
      : undefined;

    openComposer({
      to,
      cc: cc || undefined,
      subject: newSubject,
      bodyHtml: quoted,
      accountId: selected.accountId ?? undefined,
      leadId: selected.leadId ?? undefined,
      contactId: selected.contactId ?? undefined,
      opportunityId: selected.opportunityId ?? undefined,
      caseId: selected.caseId ?? undefined,
      relatedLabel,
    });
  }

  return (
    <div style={shell}>
      {/* Sidebar */}
      <aside style={sidebar}>
        <button onClick={newEmail} style={composeBtn}>
          <span style={{ fontSize: 16, lineHeight: 0 }}>+</span>
          <span>Compose</span>
        </button>
        <div style={sidebarSection}>
          {FOLDERS.map((f) => {
            const active = f.key === folder;
            return (
              <Link
                key={f.key}
                href={`/emails?folder=${f.key}`}
                style={{ ...folderRow, ...(active ? folderRowActive : {}) }}
              >
                <span style={{ color: active ? "#1589ee" : "#54698d", display: "inline-flex" }}>{f.icon}</span>
                <span style={{ flex: 1 }}>{f.label}</span>
                <span style={{ color: active ? "#1589ee" : "#706e6b", fontSize: 12 }}>{counts[f.key]}</span>
              </Link>
            );
          })}
        </div>
      </aside>

      {/* Message list */}
      <section style={listPane}>
        <div style={listHeader}>
          <div style={listHeaderCol("From")}>From</div>
          <div style={listHeaderCol("Subject")}>Subject</div>
          <div style={listHeaderColRight}>Date</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {rows.length === 0 ? (
            <div style={emptyState}>No emails in this folder</div>
          ) : (
            rows.map((r) => {
              const isSelected = selected?.id === r.id;
              const from = r.direction === "INBOUND" ? r.fromAddress : r.toAddresses;
              return (
                <button
                  key={r.id}
                  onClick={() => selectRow(r.id)}
                  style={{ ...rowBtn, ...(isSelected ? rowSelected : {}) }}
                >
                  <div style={rowFrom}>
                    <div style={rowFromName}>{from || "(no recipient)"}</div>
                    {(r.accountName || r.leadName || r.contactName) && (
                      <div style={rowMeta}>
                        {r.accountName ?? r.leadName ?? r.contactName}
                      </div>
                    )}
                  </div>
                  <div style={rowSubject}>
                    <div style={rowSubjectLine}>{r.subject || "(no subject)"}</div>
                    <div style={rowStatus}>{r.status}</div>
                  </div>
                  <div style={rowDate}>{formatRowDate(r.sentAt)}</div>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* Reading pane */}
      <section style={readingPane}>
        {selected ? (
          <ReadingPaneContent detail={selected} onReply={reply} />
        ) : (
          <div style={emptyState}>Select an email to read</div>
        )}
      </section>
    </div>
  );
}

function ReadingPaneContent({
  detail,
  onReply,
}: {
  detail: InboxDetail;
  onReply: (mode: "reply" | "reply-all" | "forward") => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={readHeader}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={readSubject}>{detail.subject || "(no subject)"}</div>
            <div style={readMeta}>
              <span style={{ color: "#706e6b" }}>From:</span> <span style={{ color: "#080707" }}>{detail.fromAddress}</span>
            </div>
            <div style={readMeta}>
              <span style={{ color: "#706e6b" }}>To:</span> <span style={{ color: "#080707" }}>{detail.toAddresses}</span>
            </div>
            {detail.cc && (
              <div style={readMeta}>
                <span style={{ color: "#706e6b" }}>Cc:</span> <span style={{ color: "#080707" }}>{detail.cc}</span>
              </div>
            )}
            <div style={{ ...readMeta, color: "#706e6b" }}>{new Date(detail.sentAt).toLocaleString()}</div>
            {(detail.accountName || detail.leadName || detail.contactName) && (
              <div style={{ marginTop: 8, fontSize: 12 }}>
                <span style={{ color: "#706e6b" }}>Related: </span>
                {detail.accountName && detail.accountId && (
                  <Link href={`/accounts/${detail.accountId}`} style={readLink}>{detail.accountName}</Link>
                )}
                {detail.leadName && detail.leadId && (
                  <Link href={`/leads/${detail.leadId}`} style={readLink}>{detail.leadName}</Link>
                )}
                {detail.contactName && detail.contactId && (
                  <Link href={`/contacts/${detail.contactId}`} style={readLink}>{detail.contactName}</Link>
                )}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button onClick={() => onReply("reply")} style={readAction}>Reply</button>
            <button onClick={() => onReply("reply-all")} style={readAction}>Reply All</button>
            <button onClick={() => onReply("forward")} style={readAction}>Forward</button>
          </div>
        </div>
      </div>
      <div style={readBody}>
        {detail.bodyHtml ? (
          <div dangerouslySetInnerHTML={{ __html: detail.bodyHtml }} />
        ) : detail.bodyText ? (
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: FONT, fontSize: 13, color: "#080707", margin: 0 }}>{detail.bodyText}</pre>
        ) : (
          <div style={{ color: "#706e6b", fontSize: 13 }}>(empty)</div>
        )}
      </div>
    </div>
  );
}

/* --------------------- helpers --------------------- */

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatRowDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  const sameYear = d.getFullYear() === now.getFullYear();
  return sameYear
    ? d.toLocaleDateString([], { month: "short", day: "numeric" })
    : d.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

/* --------------------- icons --------------------- */

function FolderIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" /></svg>;
}
function InboxIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}
function SentIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
function DraftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

/* --------------------- styles --------------------- */

const shell: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "220px 380px 1fr",
  gap: 0,
  height: "calc(100vh - 100px)",
  background: "#fff",
  border: "1px solid #d8dde6",
  borderRadius: 4,
  fontFamily: FONT,
  overflow: "hidden",
};

const sidebar: React.CSSProperties = {
  background: "#fafaf9",
  borderRight: "1px solid #d8dde6",
  padding: 12,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const composeBtn: React.CSSProperties = {
  background: "#0070d2",
  color: "#fff",
  border: 0,
  borderRadius: 4,
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
};

const sidebarSection: React.CSSProperties = { display: "flex", flexDirection: "column" };

const folderRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  fontSize: 13,
  color: "#080707",
  textDecoration: "none",
  borderRadius: 4,
  cursor: "pointer",
};

const folderRowActive: React.CSSProperties = {
  background: "#ecf6ff",
  color: "#0070d2",
  fontWeight: 600,
};

const listPane: React.CSSProperties = {
  borderRight: "1px solid #d8dde6",
  display: "flex",
  flexDirection: "column",
  background: "#fff",
  minWidth: 0,
};

const listHeader: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "120px 1fr 70px",
  padding: "8px 12px",
  fontSize: 11,
  textTransform: "uppercase",
  color: "#706e6b",
  borderBottom: "1px solid #d8dde6",
  background: "#fafaf9",
  fontWeight: 600,
  letterSpacing: 0.4,
};

function listHeaderCol(_label: string): React.CSSProperties {
  return { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
}

const listHeaderColRight: React.CSSProperties = {
  textAlign: "right",
  overflow: "hidden",
};

const rowBtn: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "120px 1fr 70px",
  gap: 8,
  width: "100%",
  padding: "10px 12px",
  border: 0,
  borderBottom: "1px solid #f4f4f4",
  background: "transparent",
  cursor: "pointer",
  textAlign: "left",
  alignItems: "flex-start",
};

const rowSelected: React.CSSProperties = {
  background: "#ecf6ff",
  borderLeft: "3px solid #1589ee",
  paddingLeft: 9,
};

const rowFrom: React.CSSProperties = { minWidth: 0, overflow: "hidden" };
const rowFromName: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#080707",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
const rowMeta: React.CSSProperties = {
  fontSize: 11,
  color: "#706e6b",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const rowSubject: React.CSSProperties = { minWidth: 0, overflow: "hidden" };
const rowSubjectLine: React.CSSProperties = {
  fontSize: 13,
  color: "#080707",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
const rowStatus: React.CSSProperties = {
  fontSize: 10,
  color: "#706e6b",
  textTransform: "uppercase",
  letterSpacing: 0.3,
  marginTop: 2,
};

const rowDate: React.CSSProperties = {
  fontSize: 12,
  color: "#706e6b",
  textAlign: "right",
  whiteSpace: "nowrap",
};

const readingPane: React.CSSProperties = {
  background: "#fff",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
};

const readHeader: React.CSSProperties = {
  padding: "16px 20px",
  borderBottom: "1px solid #d8dde6",
};

const readSubject: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: "#080707",
  marginBottom: 8,
};

const readMeta: React.CSSProperties = {
  fontSize: 12,
  color: "#080707",
  marginBottom: 2,
};

const readLink: React.CSSProperties = {
  color: "#1589ee",
  textDecoration: "none",
  marginRight: 8,
};

const readAction: React.CSSProperties = {
  background: "#fff",
  color: "#0070d2",
  border: "1px solid #d8dde6",
  borderRadius: 4,
  padding: "4px 10px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const readBody: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "16px 20px",
  fontSize: 13,
  color: "#080707",
};

const emptyState: React.CSSProperties = {
  padding: 40,
  textAlign: "center",
  color: "#706e6b",
  fontSize: 13,
};
