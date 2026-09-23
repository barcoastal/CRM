"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CASE_APPROVAL_TYPES } from "@/lib/automation/case-policy";
import { CASE_RECORD_TYPES } from "@/lib/record-types";

export function NewCaseForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <main className="max-w-2xl mx-auto my-6 border rounded bg-white p-6">
    <h1 className="text-xl font-semibold mb-5">New Case</h1>
    {error && <p role="alert" className="text-red-700 mb-4">{error}</p>}
    <form onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError("");
      const body = Object.fromEntries(new FormData(event.currentTarget));
      try {
        const response = await fetch("/api/cases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not create case");
        router.push(`/cases/${result.id}`); router.refresh();
      } catch (error) { setError(error instanceof Error ? error.message : "Could not create case"); }
      finally { setBusy(false); }
    }}>
      <label className="block mb-4">Subject<input name="subject" required maxLength={255} className="block border rounded p-2 w-full" /></label>
      <label className="block mb-4">Record type<select name="recordType" defaultValue="SUPPORT" className="block border rounded p-2 w-full">{CASE_RECORD_TYPES.map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
      <label className="block mb-4">Type<select name="type" className="block border rounded p-2 w-full"><option value="">None</option>{CASE_APPROVAL_TYPES.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="block mb-4">Description<textarea name="description" rows={4} className="block border rounded p-2 w-full" /></label>
      <p className="text-sm text-gray-600 mb-4">Payment changes, refunds and cancellation requests are automatically submitted to the case approval queue.</p>
      <button disabled={busy} className="rounded bg-blue-700 text-white px-4 py-2">{busy ? "Saving…" : "Save"}</button>
      <Link href="/cases" className="ml-4 text-blue-700">Cancel</Link>
    </form>
  </main>;
}
