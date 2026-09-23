"use client";
import { useEffect, useState } from "react";
export function ReportSubscription({ reportId }: { reportId: string }) {
  const [open, setOpen] = useState(false);
  const [frequency, setFrequency] = useState("weekly");
  const [hourUtc, setHour] = useState(9);
  const [weekday, setWeekday] = useState(1);
  const [nextRun, setNextRun] = useState<string | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoaded(false);
    fetch(`/api/reports/${reportId}/subscription`).then(async response => {
      if (!response.ok) throw new Error("Could not load schedule");
      const { subscription } = await response.json();
      if (cancelled) return;
      if (subscription) { setFrequency(subscription.frequency); setHour(subscription.hourUtc); setWeekday(subscription.weekday); }
      const delivery = subscription?.deliveries?.[0];
      setDeliveryStatus(delivery ? `Last delivery: ${delivery.status}${delivery.lastError ? ` — ${delivery.lastError}` : ""}` : "");
      setNextRun(subscription?.nextRunAt ?? null); setLoaded(true); setError("");
    }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [open, reportId]);
  async function save(remove = false) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/reports/${reportId}/subscription`, { method: remove ? "DELETE" : "PUT", headers: { "Content-Type": "application/json" }, body: remove ? undefined : JSON.stringify({ frequency, hourUtc, weekday }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not save schedule");
      setNextRun(body.subscription?.nextRunAt ?? null);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save schedule"); }
    finally { setBusy(false); }
  }
  return <div className="relative">
    <button className="slds-button slds-button_neutral" onClick={() => setOpen(v => !v)}>Schedule</button>
    {open && <div className="fixed right-8 top-24 z-50 w-80 bg-white border rounded p-4 shadow-lg text-sm space-y-3">
      <div className="flex justify-between gap-2"><h2 className="font-semibold">Schedule report email</h2><button aria-label="Close schedule" onClick={() => setOpen(false)}>×</button></div>
      <p>Receive an email at your CRM user email address with a report link. Results load when you open it.</p>
      <label className="block">Frequency <select className="border rounded p-1" value={frequency} onChange={e => setFrequency(e.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label>
      {frequency === "weekly" && <label className="block">Day <select className="border rounded p-1" value={weekday} onChange={e => setWeekday(Number(e.target.value))}>{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, i) => <option key={day} value={i}>{day}</option>)}</select></label>}
      <label className="block">Time (UTC) <select className="border rounded p-1" value={hourUtc} onChange={e => setHour(Number(e.target.value))}>{Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>)}</select></label>
      <p role="status">{nextRun ? `Next email: ${new Date(nextRun).toLocaleString()}` : "No active schedule"}</p>
      {deliveryStatus && <p role="status">{deliveryStatus}</p>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <button disabled={busy || !loaded} className="slds-button slds-button_brand" onClick={() => void save()}>Save schedule</button>
      {nextRun && <button disabled={busy || !loaded} className="slds-button slds-button_neutral" onClick={() => void save(true)}>Unsubscribe</button>}
    </div>}
  </div>;
}
