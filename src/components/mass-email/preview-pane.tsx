"use client";

/**
 * Sandboxed preview pane. Wraps the rendered HTML in an <iframe srcdoc>
 * so styles in the email body can't leak out into the dashboard chrome,
 * and so the pixel/click URLs render with the production hostnames.
 */

import { useMemo } from "react";

export function PreviewPane({
  subject,
  html,
  text,
  recipientEmail,
}: {
  subject: string;
  html: string;
  text: string;
  recipientEmail?: string;
}) {
  const wrapped = useMemo(() => {
    if (html) return html;
    const safe = (text ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
    return `<pre style="font-family:Manrope,sans-serif;white-space:pre-wrap;color:#131b2e;font-size:13px">${safe}</pre>`;
  }, [html, text]);

  return (
    <div className="space-y-3" style={{ fontFamily: "Manrope, sans-serif" }}>
      <div className="rounded border border-[#d8dde6] bg-white px-3 py-2 text-[12px] text-[#131b2e]">
        <div>
          <span className="text-[#706e6b]">To:</span>{" "}
          <span className="font-semibold">{recipientEmail ?? "first matching recipient"}</span>
        </div>
        <div>
          <span className="text-[#706e6b]">Subject:</span>{" "}
          <span className="font-semibold">{subject || "(no subject)"}</span>
        </div>
      </div>
      <iframe
        title="Email preview"
        sandbox=""
        srcDoc={wrapped}
        style={{
          width: "100%",
          height: 480,
          border: "1px solid #d8dde6",
          borderRadius: 6,
          background: "white",
        }}
      />
    </div>
  );
}
