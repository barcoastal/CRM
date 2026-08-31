"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AiDialerOverview } from "@/lib/ai-dialer/overview";
import { Calendar, CheckCircle2, PhoneOutgoing, Plus, RefreshCw, ShieldAlert, Sparkles, Users } from "@/components/icons/lucide";

function StatCard({ label, value, note }: { label: string; value: number | string; note: string }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,0.06)]">
      <div className="text-[11px] font-bold uppercase tracking-[0.5px] text-[#6b7280]">{label}</div>
      <div className="mt-2 text-[27px] font-extrabold text-[#111827]">{value}</div>
      <div className="mt-1 text-[12px] text-[#6b7280]">{note}</div>
    </div>
  );
}

function badge(value: string | null) {
  const tone = value === "MEETING_BOOKED" || value === "TRANSFERRED" || value === "ANALYZED"
    ? "bg-emerald-50 text-emerald-700"
    : value === "DNC" || value === "FAILED" ? "bg-red-50 text-red-700"
      : value === "IN_PROGRESS" || value === "REGISTERED" ? "bg-blue-50 text-blue-700"
        : "bg-slate-100 text-slate-600";
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${tone}`}>{(value ?? "PENDING").replaceAll("_", " ")}</span>;
}

export function AiDialerDashboard({ initialOverview }: { initialOverview: AiDialerOverview }) {
  const [overview, setOverview] = useState(initialOverview);
  const [selectedCampaignId, setSelectedCampaignId] = useState(initialOverview.campaigns.find((c) => c.status === "ACTIVE")?.id ?? initialOverview.campaigns[0]?.id ?? "");
  const [launching, setLaunching] = useState(false);
  const [message, setMessage] = useState("");
  const [numberForm, setNumberForm] = useState({ phoneNumber: "", state: "", label: "" });
  const [savingNumber, setSavingNumber] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/ai-dialer/overview", { cache: "no-store" });
    if (response.ok) setOverview(await response.json());
  }, []);

  useEffect(() => {
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const totals = useMemo(() => ({
    active: overview.campaigns.reduce((sum, campaign) => sum + campaign.activeCalls, 0),
    ready: overview.campaigns.reduce((sum, campaign) => sum + campaign.consentReady, 0),
    meetings: overview.campaigns.reduce((sum, campaign) => sum + campaign.meetings, 0),
    transfers: overview.campaigns.reduce((sum, campaign) => sum + campaign.transfers, 0),
  }), [overview]);
  const selected = overview.campaigns.find((campaign) => campaign.id === selectedCampaignId);

  async function launch() {
    if (!selected) return;
    setLaunching(true);
    setMessage("");
    try {
      const response = await fetch(`/api/ai-dialer/campaigns/${selected.id}/launch`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: selected.aiMaxConcurrency }),
      });
      const data = await response.json();
      setMessage(response.ok
        ? `Started ${data.launched} AI call(s). ${data.skipped?.length ?? 0} lead(s) were safely blocked or skipped.`
        : data.error ?? "The AI campaign could not start.");
      await refresh();
    } catch { setMessage("The AI campaign could not start."); }
    finally { setLaunching(false); }
  }

  async function addNumber(event: React.FormEvent) {
    event.preventDefault();
    setSavingNumber(true);
    setMessage("");
    const response = await fetch("/api/ai-dialer/numbers", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phoneNumber: numberForm.phoneNumber,
        state: numberForm.state.trim() ? numberForm.state.trim().toUpperCase() : null,
        label: numberForm.label || undefined,
        priority: 0,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setNumberForm({ phoneNumber: "", state: "", label: "" });
      setMessage("Caller ID added. Confirm that this number is imported into Retell before launching.");
      await refresh();
    } else setMessage(data.error ?? "Caller ID could not be added.");
    setSavingNumber(false);
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="overflow-hidden rounded-2xl bg-[#0d1b2a] text-white shadow-[0_18px_50px_rgba(13,27,42,0.18)]">
        <div className="flex flex-wrap items-center justify-between gap-5 px-7 py-7">
          <div className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-[#3052ff]"><Sparkles className="size-6" /></div>
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-[1.5px] text-[#91a7ff]">Second dialer</div>
              <h1 className="text-[26px] font-extrabold">AI Voice Dialer</h1>
              <p className="mt-1 text-[13px] text-slate-300">Retell qualification, local caller IDs, live transfers, and Google Calendar booking.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link href="/dialer" className="rounded-lg border border-white/20 px-4 py-2.5 text-[13px] font-semibold hover:bg-white/10">Open Human Dialer</Link>
            <Link href="/campaigns/new" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-[13px] font-bold text-[#0d1b2a]"><Plus className="size-4" /> New AI Campaign</Link>
          </div>
        </div>
      </div>

      {(!overview.googleCalendar.connected || overview.numbers.length === 0) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-[13px] text-amber-900">
          <ShieldAlert className="size-5" />
          <strong>Setup required:</strong>
          {!overview.googleCalendar.connected && <Link className="font-semibold text-[#3052ff] underline" href="/api/integrations/google-calendar/connect" prefetch={false}>Connect Google Calendar</Link>}
          {overview.numbers.length === 0 && <span>Add at least one owned caller ID below.</span>}
        </div>
      )}
      {message && <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-3.5 text-[13px] font-medium text-blue-800">{message}</div>}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Live AI calls" value={totals.active} note="Current Retell sessions" />
        <StatCard label="Consent ready" value={totals.ready} note="Leads eligible before DNC check" />
        <StatCard label="Meetings booked" value={totals.meetings} note="Across AI campaigns" />
        <StatCard label="Warm transfers" value={totals.transfers} note="Connected to real agents" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-xl bg-white shadow-[0_10px_35px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div><h2 className="text-[16px] font-bold text-[#111827]">AI campaigns</h2><p className="mt-0.5 text-[12px] text-slate-500">Separate from Five9 and the human power dialer</p></div>
            <button onClick={refresh} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Refresh"><RefreshCw className="size-4" /></button>
          </div>
          {overview.campaigns.length === 0 ? (
            <div className="px-6 py-14 text-center"><Sparkles className="mx-auto mb-3 size-8 text-slate-300" /><p className="text-[14px] font-semibold text-slate-700">No AI campaigns yet</p><p className="mt-1 text-[12px] text-slate-500">Create a campaign and choose AI Voice Qualifier.</p></div>
          ) : (
            <div className="divide-y divide-slate-100">
              {overview.campaigns.map((campaign) => (
                <label key={campaign.id} className={`grid cursor-pointer gap-3 px-5 py-4 transition-colors md:grid-cols-[28px_minmax(170px,1fr)_90px_90px_90px] ${selectedCampaignId === campaign.id ? "bg-blue-50/60" : "hover:bg-slate-50"}`}>
                  <input type="radio" name="ai-campaign" checked={selectedCampaignId === campaign.id} onChange={() => setSelectedCampaignId(campaign.id)} />
                  <div><Link href={`/campaigns/${campaign.id}`} className="text-[13px] font-bold text-[#111827] hover:text-[#3052ff]">{campaign.name}</Link><div className="mt-1 flex gap-2">{badge(campaign.status)}{!campaign.aiEnabled && badge("DISABLED")}</div></div>
                  <div><div className="text-[11px] text-slate-500">Ready</div><div className="mt-1 text-[14px] font-bold">{campaign.consentReady}/{campaign.totalLeads}</div></div>
                  <div><div className="text-[11px] text-slate-500">Live</div><div className="mt-1 text-[14px] font-bold">{campaign.activeCalls}/{campaign.aiMaxConcurrency}</div></div>
                  <div><div className="text-[11px] text-slate-500">Meetings</div><div className="mt-1 text-[14px] font-bold">{campaign.meetings}</div></div>
                </label>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
            <p className="text-[12px] text-slate-500">Launch fills only free concurrency slots. Every lead is checked again immediately before dialing.</p>
            <button onClick={launch} disabled={!selected || selected.status !== "ACTIVE" || !selected.aiEnabled || launching} className="inline-flex items-center gap-2 rounded-lg bg-[#3052ff] px-5 py-2.5 text-[13px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
              <PhoneOutgoing className="size-4" />{launching ? "Starting calls..." : `Launch ${selected?.aiMaxConcurrency ?? 0} AI Calls`}
            </button>
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-xl bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,0.06)]">
            <div className="mb-4 flex items-center gap-2"><Calendar className="size-5 text-[#3052ff]" /><h2 className="text-[15px] font-bold">Google Calendar</h2></div>
            <div className={`rounded-lg px-3 py-3 text-[12px] ${overview.googleCalendar.connected ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
              {overview.googleCalendar.connected ? <span className="flex items-center gap-2"><CheckCircle2 className="size-4" /> Connected for live booking</span> : "Not connected — AI cannot book meetings yet."}
            </div>
            {!overview.googleCalendar.connected && <Link href="/api/integrations/google-calendar/connect" prefetch={false} className="mt-3 block text-[12px] font-bold text-[#3052ff]">Connect calendar →</Link>}
          </div>

          <div className="rounded-xl bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,0.06)]">
            <div className="mb-4 flex items-center gap-2"><PhoneOutgoing className="size-5 text-[#3052ff]" /><h2 className="text-[15px] font-bold">Owned caller IDs</h2></div>
            <div className="mb-4 max-h-40 space-y-2 overflow-y-auto">
              {overview.numbers.map((number) => <div key={number.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[12px]"><span className="font-semibold">{number.phoneNumber}</span><span className="rounded bg-white px-2 py-1 text-slate-500">{number.state ?? "Default"}</span></div>)}
              {overview.numbers.length === 0 && <p className="text-[12px] text-slate-500">No caller IDs configured.</p>}
            </div>
            <form onSubmit={addNumber} className="space-y-2.5">
              <input required value={numberForm.phoneNumber} onChange={(e) => setNumberForm({ ...numberForm, phoneNumber: e.target.value })} placeholder="+12125551234" className="w-full rounded-lg bg-slate-100 px-3 py-2.5 text-[12px] outline-none focus:ring-1 focus:ring-[#3052ff]" />
              <div className="grid grid-cols-2 gap-2"><input maxLength={2} value={numberForm.state} onChange={(e) => setNumberForm({ ...numberForm, state: e.target.value })} placeholder="State or blank" className="rounded-lg bg-slate-100 px-3 py-2.5 text-[12px] uppercase outline-none" /><input value={numberForm.label} onChange={(e) => setNumberForm({ ...numberForm, label: e.target.value })} placeholder="Label" className="rounded-lg bg-slate-100 px-3 py-2.5 text-[12px] outline-none" /></div>
              <button disabled={savingNumber} className="w-full rounded-lg border border-[#3052ff] px-3 py-2 text-[12px] font-bold text-[#3052ff] disabled:opacity-50">{savingNumber ? "Adding..." : "Add verified number"}</button>
            </form>
          </div>
        </aside>
      </div>

      <section className="overflow-hidden rounded-xl bg-white shadow-[0_10px_35px_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"><Users className="size-5 text-[#3052ff]" /><h2 className="text-[15px] font-bold">Recent AI calls</h2><span className="ml-auto text-[11px] text-slate-400">Refreshes every 5 seconds</span></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-[12px]">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.4px] text-slate-500"><tr><th className="px-5 py-3">Lead</th><th className="px-4 py-3">Campaign</th><th className="px-4 py-3">State</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Outcome</th><th className="px-4 py-3">Duration</th><th className="px-4 py-3">Started</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {overview.recentCalls.map((call) => <tr key={call.id} className="hover:bg-slate-50"><td className="px-5 py-3.5"><div className="font-bold text-[#111827]">{call.businessName}</div><div className="mt-0.5 text-slate-500">{call.contactName}</div></td><td className="px-4 py-3.5">{call.campaignName}</td><td className="px-4 py-3.5">{call.state ?? "—"}</td><td className="px-4 py-3.5">{badge(call.status)}</td><td className="px-4 py-3.5">{badge(call.outcome)}</td><td className="px-4 py-3.5">{call.durationMs ? `${Math.round(call.durationMs / 1000)}s` : "—"}</td><td className="px-4 py-3.5 text-slate-500">{new Date(call.createdAt).toLocaleString()}</td></tr>)}
              {overview.recentCalls.length === 0 && <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-500">No AI calls have been placed.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
