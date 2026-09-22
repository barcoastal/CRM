"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ACCOUNT_RECORD_TYPES } from "@/lib/record-types";

export function NewRecordForm({ entity }: { entity: "accounts" | "opportunities" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [leads, setLeads] = useState<{id:string;businessName:string;contactName:string}[]>([]);
  const [leadId, setLeadId] = useState("");
  const [searching, setSearching] = useState(false);
  async function findLeads() {
    setSearching(true); setError("");
    try {
      const response = await fetch(`/api/leads?search=${encodeURIComponent(search)}`);
      if (!response.ok) throw new Error("Could not search leads");
      const data = await response.json(); setLeads(data.leads ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : "Search failed"); }
    finally { setSearching(false); }
  }
  return <main className="max-w-2xl mx-auto my-6 bg-white border rounded p-6">
    <h1 className="text-xl font-semibold mb-5">New {entity === "accounts" ? "Account" : "Opportunity"}</h1>
    {error && <p role="alert" className="text-red-700 mb-4">{error}</p>}
    <form onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError("");
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const body = Object.fromEntries(Object.entries(data).filter(([,value]) => value !== ""));
      try {
        const response = await fetch(`/api/${entity}`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not create record");
        router.push(`/${entity}/${result.id}`); router.refresh();
      } catch (err) { setError(err instanceof Error ? err.message : "Could not create record"); }
      finally { setBusy(false); }
    }}>
      {entity === "accounts" ? <>
        <label className="block mb-4">Account Name<input required maxLength={255} name="name" className="block border rounded p-2 w-full" /></label>
        <label className="block mb-4">Record Type<select name="recordType" className="block border rounded p-2 w-full">{ACCOUNT_RECORD_TYPES.map(type => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select></label>
        <label className="block mb-4">Phone<input name="phone" type="tel" className="block border rounded p-2 w-full" /></label>
        <label className="block mb-4">Email<input name="email" type="email" className="block border rounded p-2 w-full" /></label>
      </> : <>
        <label className="block mb-2">Find a lead<input value={search} onChange={event => setSearch(event.target.value)} className="block border rounded p-2 w-full" /></label>
        <button type="button" disabled={searching || search.trim().length < 2} onClick={findLeads} className="border rounded p-2 mb-4">{searching ? "Searching…" : "Search Leads"}</button>
        <label className="block mb-4">Lead<select required name="leadId" value={leadId} onChange={event => setLeadId(event.target.value)} className="block border rounded p-2 w-full"><option value="">Select a lead</option>{leads.map(lead => <option key={lead.id} value={lead.id}>{lead.businessName} · {lead.contactName}</option>)}</select></label>
        <label className="block mb-4">Total Debt<input name="totalDebt" type="number" min="0.01" step="0.01" className="block border rounded p-2 w-full" /></label>
        <label className="block mb-4">Expected Close Date<input name="expectedCloseDate" type="date" className="block border rounded p-2 w-full" /></label>
      </>}
      <div className="flex justify-end gap-4"><Link href={`/${entity}`} className="p-2">Cancel</Link><button disabled={busy} className="bg-blue-700 text-white rounded px-4 py-2">{busy ? "Saving…" : "Create"}</button></div>
    </form>
  </main>;
}
