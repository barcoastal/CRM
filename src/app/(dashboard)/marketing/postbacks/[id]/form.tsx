"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Endpoint = {
  id: string;
  name: string;
  url: string;
  method: string;
  authHeaderKey: string | null;
  authHeaderValue: string | null;
  payloadTemplate: string | null;
  events: string[];
  isActive: boolean;
  retryOnFail: boolean;
  maxAttempts: number;
};

type Props = {
  endpoint: Endpoint;
  availableEvents: string[];
};

export function EditPostbackForm({ endpoint, availableEvents }: Props) {
  const router = useRouter();
  const [name, setName] = useState(endpoint.name);
  const [url, setUrl] = useState(endpoint.url);
  const [method, setMethod] = useState(endpoint.method);
  const [authKey, setAuthKey] = useState(endpoint.authHeaderKey ?? "");
  const [authVal, setAuthVal] = useState(endpoint.authHeaderValue ?? "");
  const [events, setEvents] = useState<string[]>(endpoint.events);
  const [payload, setPayload] = useState(endpoint.payloadTemplate ?? "");
  const [retryOnFail, setRetryOnFail] = useState(endpoint.retryOnFail);
  const [maxAttempts, setMaxAttempts] = useState(endpoint.maxAttempts);
  const [isActive, setIsActive] = useState(endpoint.isActive);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleEvent(e: string) {
    setEvents((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/marketing/postbacks/${endpoint.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        url: url.trim(),
        method,
        authHeaderKey: authKey.trim() || null,
        authHeaderValue: authVal.trim() || null,
        payloadTemplate: payload.trim() || null,
        events,
        retryOnFail,
        maxAttempts,
        isActive,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Save failed");
      return;
    }
    setSavedAt(new Date());
    router.refresh();
  }

  async function del() {
    if (!confirm(`Delete endpoint "${endpoint.name}"? Send logs will be lost.`)) return;
    const res = await fetch(`/api/marketing/postbacks/${endpoint.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Delete failed");
      return;
    }
    router.push("/marketing/postbacks");
    router.refresh();
  }

  return (
    <section className="bg-white rounded-xl p-6 space-y-5" style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}>
      <h2 className="text-[14px] font-bold text-[#131b2e]">Configuration</h2>
      {error && <div className="p-3 rounded text-[13px] bg-[rgba(148,43,0,0.08)] text-[#942b00]">{error}</div>}

      <Row label="Name">
        <input className="ms-input" value={name} onChange={(e) => setName(e.target.value)} />
      </Row>
      <Row label="URL">
        <input
          className="ms-input font-mono text-[12px]"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </Row>
      <Row label="Method">
        <div className="flex gap-3 text-[13px]">
          {["POST", "GET", "PUT"].map((m) => (
            <label key={m} className="inline-flex items-center gap-1.5">
              <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} />
              {m}
            </label>
          ))}
        </div>
      </Row>
      <Row label="Auth Header">
        <div className="flex gap-2">
          <input className="ms-input flex-1" placeholder="Authorization" value={authKey} onChange={(e) => setAuthKey(e.target.value)} />
          <input
            className="ms-input flex-1 font-mono text-[12px]"
            placeholder="Bearer ..."
            value={authVal}
            onChange={(e) => setAuthVal(e.target.value)}
          />
        </div>
      </Row>
      <Row label="Events">
        <div className="flex flex-wrap gap-2">
          {availableEvents.map((ev) => {
            const on = events.includes(ev);
            return (
              <button
                type="button"
                key={ev}
                onClick={() => toggleEvent(ev)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border font-mono ${
                  on ? "bg-[#3052ff] text-white border-[#3052ff]" : "bg-white text-[#444656] border-[#c9c9c9]"
                }`}
              >
                {ev}
              </button>
            );
          })}
        </div>
      </Row>
      <Row label="Payload Template" hint="Mustache merge: {{lead.email}}, {{opportunity.amount}}, {{event}}.">
        <textarea
          className="ms-input font-mono text-[12px] min-h-[180px]"
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
        />
      </Row>
      <Row label="Retry">
        <div className="flex items-center gap-4 text-[13px]">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={retryOnFail} onChange={(e) => setRetryOnFail(e.target.checked)} />
            Retry on failure
          </label>
          <label className="inline-flex items-center gap-2">
            Max attempts
            <input
              type="number"
              min={1}
              max={10}
              className="ms-input w-20"
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Number(e.target.value) || 1)}
            />
          </label>
        </div>
      </Row>
      <Row label="Status">
        <label className="inline-flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active
        </label>
      </Row>

      <div className="flex justify-between items-center pt-3 border-t border-[#f2f3ff]">
        <button
          type="button"
          onClick={del}
          className="px-4 py-2 rounded text-[13px] font-semibold text-[#942b00] border border-[#942b00]"
        >
          Delete Endpoint
        </button>
        <div className="flex items-center gap-2">
          {savedAt && <span className="text-[11px] text-[#1a7d37]">Saved {savedAt.toLocaleTimeString()}</span>}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-5 py-2 rounded text-[13px] font-semibold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #1a7d37, #2db84d)" }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <style jsx>{`
        :global(.ms-input) {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid #c9c9c9;
          border-radius: 4px;
          font-size: 13px;
          color: #131b2e;
          background: white;
        }
        :global(.ms-input:focus) {
          outline: none;
          border-color: #3052ff;
          box-shadow: 0 0 0 3px rgba(48, 82, 255, 0.12);
        }
      `}</style>
    </section>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-4 items-start">
      <div className="pt-2">
        <div className="text-[12px] font-semibold text-[#131b2e]">{label}</div>
        {hint && <div className="text-[11px] text-[#747474] mt-0.5">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}
