"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Modal, ModalButton } from "@/components/slds/modal";

type Company = {id:string;name:string;phone:string|null;billingCity:string|null;billingState:string|null};
export function CompanyFinder({children}:{children:ReactNode}) {
  const [open,setOpen] = useState(false);
  const [query,setQuery] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [results,setResults] = useState<Company[] | null>(null);
  const [total,setTotal] = useState(0);
  return <>
    <button type="button" style={{border:0,padding:0,background:"transparent"}} onClick={() => setOpen(true)}>{children}</button>
    <Modal open={open} onClose={() => setOpen(false)} title="Find Companies in Your CRM" size="medium" footer={<ModalButton onClick={() => setOpen(false)}>Close</ModalButton>}>
      <p className="mb-4 text-sm text-slate-600">Search accounts you can access by name, phone, email or EIN.</p>
      <form className="flex gap-2" onSubmit={async event => {
        event.preventDefault(); if (query.trim().length < 2) return;
        setBusy(true); setError(""); setResults(null);
        try {
          const response = await fetch(`/api/accounts?q=${encodeURIComponent(query.trim())}&limit=20`);
          const data = await response.json(); if (!response.ok) throw new Error(data.error || "Search failed");
          setResults(data.items ?? []); setTotal(data.total ?? 0);
        } catch (err) { setError(err instanceof Error ? err.message : "Search failed"); }
        finally { setBusy(false); }
      }}>
        <input aria-label="Company search" value={query} onChange={event => setQuery(event.target.value)} className="border rounded p-2 flex-1" />
        <button type="submit" disabled={busy || query.trim().length < 2} className="border rounded p-2">{busy ? "Searching…" : "Search"}</button>
      </form>
      {error && <p role="alert" className="text-red-700 mt-3">{error}</p>}
      {results && <div className="mt-4"><p className="text-sm mb-2">{total.toLocaleString()} matching accounts{total > results.length ? ` · showing first ${results.length}` : ""}</p>
        <ul className="max-h-80 overflow-auto">{results.map(company => <li key={company.id} className="border-t py-3"><Link className="text-blue-700 font-medium" href={`/accounts/${company.id}`} onClick={() => setOpen(false)}>{company.name}</Link><p className="text-sm text-slate-600">{[company.phone, company.billingCity, company.billingState].filter(Boolean).join(" · ")}</p></li>)}</ul>
        <Link className="text-blue-700 text-sm" href={`/accounts?view=all&search=${encodeURIComponent(query)}`} onClick={() => setOpen(false)}>Open matching accounts</Link>
      </div>}
    </Modal>
  </>;
}
