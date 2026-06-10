import { Fragment, type ReactNode } from "react";

/**
 * Tiny safe markdown renderer for Path Guidance text. Intentionally
 * minimal — no deps, no HTML pass-through. Supports:
 *   - `# h1` / `## h2`
 *   - `> blockquote`
 *   - `- bullet` lists
 *   - `**bold**` and `*italic*` inline
 *   - blank line paragraph breaks + single line breaks
 *
 * Anything else falls through as plain text.
 */
export function MiniMarkdown({ source }: { source: string }) {
  return <>{renderBlocks(source)}</>;
}

function renderBlocks(src: string): ReactNode[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      out.push(<h2 key={key++} style={hStyle}>{renderInline(line.slice(2))}</h2>);
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      out.push(<h3 key={key++} style={h3Style}>{renderInline(line.slice(3))}</h3>);
      i++;
      continue;
    }
    if (line.startsWith("> ")) {
      out.push(
        <blockquote key={key++} style={bqStyle}>
          {renderInline(line.slice(2))}
        </blockquote>,
      );
      i++;
      continue;
    }
    if (/^[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(lines[i].slice(2));
        i++;
      }
      out.push(
        <ul key={key++} style={ulStyle}>
          {items.map((it, idx) => (
            <li key={idx} style={liStyle}>{renderInline(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    // Paragraph: gather until blank line
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^[#>-]/.test(lines[i]) && !/^\* /.test(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    out.push(
      <p key={key++} style={pStyle}>
        {paraLines.map((pl, idx) => (
          <Fragment key={idx}>
            {idx > 0 && <br />}
            {renderInline(pl)}
          </Fragment>
        ))}
      </p>,
    );
  }
  return out;
}

function renderInline(text: string): ReactNode {
  // Process **bold** then *italic*. Greedy non-empty content.
  const parts: ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (rest.length > 0) {
    const bold = rest.match(/\*\*([^*]+)\*\*/);
    const ital = rest.match(/\*([^*]+)\*/);
    let next: { type: "b" | "i"; m: RegExpMatchArray } | null = null;
    if (bold && (!ital || (bold.index ?? 0) <= (ital.index ?? 0))) {
      next = { type: "b", m: bold };
    } else if (ital) {
      next = { type: "i", m: ital };
    }
    if (!next) {
      parts.push(rest);
      break;
    }
    const idx = next.m.index ?? 0;
    if (idx > 0) parts.push(rest.slice(0, idx));
    parts.push(
      next.type === "b"
        ? <strong key={key++}>{next.m[1]}</strong>
        : <em key={key++}>{next.m[1]}</em>,
    );
    rest = rest.slice(idx + next.m[0].length);
  }
  return <>{parts}</>;
}

const hStyle: React.CSSProperties = { fontSize: 14, fontWeight: 700, margin: "10px 0 6px", color: "#080707" };
const h3Style: React.CSSProperties = { fontSize: 13, fontWeight: 700, margin: "8px 0 4px", color: "#3e3e3c" };
const pStyle: React.CSSProperties = { fontSize: 13, lineHeight: 1.5, margin: "6px 0", color: "#3e3e3c" };
const ulStyle: React.CSSProperties = { margin: "6px 0", paddingLeft: 18 };
const liStyle: React.CSSProperties = { fontSize: 13, lineHeight: 1.5, color: "#3e3e3c" };
const bqStyle: React.CSSProperties = {
  margin: "8px 0",
  padding: "6px 10px",
  borderLeft: "3px solid #c9c7c5",
  color: "#54595e",
  fontSize: 13,
  fontStyle: "italic",
};
