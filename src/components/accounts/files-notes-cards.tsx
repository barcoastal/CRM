import Link from "next/link";

/**
 * SF-parity "Files" and "Notes" related cards: two-across tiles like the
 * Salesforce Related tab - doc-type badge + name + date for files; title +
 * date + body snippet for notes.
 */

export interface FileTile {
  id: string;
  name: string;
  ext: string;
  href: string;
  date: string;
}

export interface NoteTile {
  id: string;
  title: string;
  href: string;
  date: string;
  snippet: string;
}

const EXT_COLOR: Record<string, string> = {
  pdf: "#ea001e",
  doc: "#107cad",
  docx: "#107cad",
  xls: "#2e844a",
  xlsx: "#2e844a",
  csv: "#2e844a",
  png: "#9050e9",
  jpg: "#9050e9",
  jpeg: "#9050e9",
  gif: "#9050e9",
  zip: "#747474",
  msg: "#ff5d2d",
  eml: "#ff5d2d",
};

function ExtBadge({ ext }: { ext: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: 6,
        background: EXT_COLOR[ext] ?? "#0176d3",
        color: "#fff",
        fontSize: 9,
        fontWeight: 700,
        textTransform: "uppercase",
        flexShrink: 0,
      }}
    >
      {ext.slice(0, 4) || "file"}
    </span>
  );
}

function CardShell({ icon, title, count, children, footer }: { icon: string; title: string; count: number; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <article className="slds-card slds-m-bottom_small">
      <div className="slds-card__header slds-grid">
        <header className="slds-media slds-media_center slds-has-flexi-truncate">
          <div className="slds-media__figure">
            <span className={`slds-icon_container slds-icon-standard-${icon}`} title={title}>
              <svg className="slds-icon slds-icon_small" aria-hidden="true">
                <use xlinkHref={`/slds/icons/standard-sprite/svg/symbols.svg#${icon}`} />
              </svg>
            </span>
          </div>
          <div className="slds-media__body">
            <h2 className="slds-card__header-title">
              <span className="slds-text-heading_small" style={{ fontWeight: 700 }}>
                {title} ({count})
              </span>
            </h2>
          </div>
        </header>
      </div>
      <div className="slds-card__body slds-card__body_inner">{children}</div>
      {footer}
    </article>
  );
}

export function FilesCard({ files, total, viewAllHref }: { files: FileTile[]; total: number; viewAllHref?: string }) {
  return (
    <CardShell
      icon="file"
      title="Files"
      count={total}
      footer={
        total > files.length && viewAllHref ? (
          <footer className="slds-card__footer">
            <Link href={viewAllHref} className="slds-text-link">View All</Link>
          </footer>
        ) : undefined
      }
    >
      {files.length === 0 ? (
        <div style={{ padding: 12, color: "#747474", fontSize: 13 }}>No files.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {files.map((f) => (
            <a
              key={f.id}
              href={f.href}
              target="_blank"
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                border: "1px solid #e5e5e5",
                borderRadius: 6,
                padding: "8px 10px",
                textDecoration: "none",
                background: "#fff",
              }}
            >
              <ExtBadge ext={f.ext} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", color: "#0176d3", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {f.name}
                </span>
                <span style={{ color: "#747474", fontSize: 11 }}>{f.date}</span>
              </span>
            </a>
          ))}
        </div>
      )}
    </CardShell>
  );
}

export function NotesCard({ notes, total }: { notes: NoteTile[]; total: number }) {
  return (
    <CardShell icon="note" title="Notes" count={total}>
      {notes.length === 0 ? (
        <div style={{ padding: 12, color: "#747474", fontSize: 13 }}>No notes.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {notes.map((n) => (
            <a
              key={n.id}
              href={n.href}
              target="_blank"
              style={{
                display: "block",
                border: "1px solid #e5e5e5",
                borderRadius: 6,
                padding: "8px 10px",
                textDecoration: "none",
                background: "#fff",
                minWidth: 0,
              }}
            >
              <span style={{ display: "block", color: "#0176d3", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {n.title}
              </span>
              <span style={{ display: "block", color: "#747474", fontSize: 11, margin: "2px 0" }}>{n.date}</span>
              {n.snippet && (
                <span style={{ display: "-webkit-box", color: "#444444", fontSize: 12, overflow: "hidden", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}>
                  {n.snippet}
                </span>
              )}
            </a>
          ))}
        </div>
      )}
    </CardShell>
  );
}
