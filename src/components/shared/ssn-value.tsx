"use client";

import { useEffect, useRef, useState } from "react";

export function SsnValue({ entity, id, masked, canReveal }: {
  entity: string; id: string; masked: string | null; canReveal: boolean;
}) {
  const [value, setValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const hide = () => { request.current?.abort(); setValue(null); setBusy(false); };
    const hidden = () => { if (document.hidden) hide(); };
    window.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", hidden);
    return () => { request.current?.abort(); window.removeEventListener("blur", hide); document.removeEventListener("visibilitychange", hidden); };
  }, [entity, id]);
  useEffect(() => { if (value) { const timer = setTimeout(() => setValue(null), 30_000); return () => clearTimeout(timer); } }, [value]);
  async function reveal() {
    if (value) { setValue(null); return; }
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/ssn/${entity}/${id}`, { method: "POST", cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Unable to reveal SSN");
      const data = await response.json();
      if (!controller.signal.aborted) setValue(data.ssn);
    } catch { if (!controller.signal.aborted) setError("Unable to reveal SSN"); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <span className="inline-flex items-center gap-2">
    <span>{value ?? masked ?? "-"}</span>
    {canReveal && masked && <button type="button" onClick={reveal} disabled={busy} className="text-xs text-[#0176d3] hover:underline disabled:opacity-50" aria-label={value ? "Hide SSN" : "Reveal SSN"}>{busy ? "Loading…" : value ? "Hide" : "Reveal"}</button>}
    {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
  </span>;
}
