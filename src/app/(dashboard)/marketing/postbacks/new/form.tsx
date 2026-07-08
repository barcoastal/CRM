"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const SAMPLE_PAYLOAD = `{
  "event": "{{event}}",
  "lead_id": "{{lead.id}}",
  "email": "{{lead.email}}",
  "gclid": "{{lead.gclid}}",
  "fbclid": "{{lead.fbclid}}",
  "value": {{opportunity.amount}}
}`;

type Props = { events: string[] };

export function PostbackForm({ events: available }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState<"POST" | "GET" | "PUT">("POST");
  const [authKey, setAuthKey] = useState("");
  const [authVal, setAuthVal] = useState("");
  const [events, setEvents] = useState<string[]>(["lead.created"]);
  const [payload, setPayload] = useState(SAMPLE_PAYLOAD);
  const [retryOnFail, setRetryOnFail] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleEvent(e: string) {
    setEvents((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));
  }

  async function submit() {
    if (!name.trim() || !url.trim()) {
      setError("Name and URL are required");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/marketing/postbacks", {
      method: "POST",
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
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to create");
      return;
    }
    const created = await res.json();
    router.push(`/marketing/postbacks/${created.id}`);
    router.refresh();
  }

  return (
    <div className="bg-white rounded-xl p-6 space-y-5" style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}>
      {error && <div className="p-3 rounded text-[13px] bg-[rgba(148,43,0,0.08)] text-[#942b00]">{error}</div>}

      <Row label="Name" required>
        <input className="ms-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Facebook Conversion API" />
      </Row>
      <Row label="URL" required>
        <input
          className="ms-input font-mono text-[12px]"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://api.example.com/conversions"
        />
      </Row>
      <Row label="Method">
        <div className="flex gap-3 text-[13px]">
          {(["POST", "GET", "PUT"] as const).map((m) => (
            <label key={m} className="inline-flex items-center gap-1.5">
              <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} />
              {m}
            </label>
          ))}
        </div>
      </Row>
      <Row label="Auth Header" hint="Optional. Key like 'Authorization', value like 'Bearer xyz'.">
        <div className="flex gap-2">
          <input
            className="ms-input flex-1"
            placeholder="Authorization"
            value={authKey}
            onChange={(e) => setAuthKey(e.target.value)}
          />
          <input
            className="ms-input flex-1 font-mono text-[12px]"
            placeholder="Bearer ..."
            value={authVal}
            onChange={(e) => setAuthVal(e.target.value)}
          />
        </div>
      </Row>
      <Row label="Events" hint="Fire this endpoint when any of these events occur.">
        <div className="flex flex-wrap gap-2">
          {available.map((ev) => {
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
      <Row label="Payload Template" hint="Mustache merge: {{lead.email}}, {{opportunity.amount}}, {{event}}. Plain text body if empty.">
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

      <div className="flex justify-end gap-2 pt-3 border-t border-[#f2f3ff]">
        <button
          type="button"
          onClick={() => router.push("/marketing/postbacks")}
          className="px-4 py-2 rounded text-[13px] font-semibold text-[#444656] bg-white border border-[#c9c9c9]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="px-5 py-2 rounded text-[13px] font-semibold text-white disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #1a7d37, #2db84d)" }}
        >
          {submitting ? "Creating..." : "Create Endpoint"}
        </button>
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
    </div>
  );
}

function Row({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-4 items-start">
      <div className="pt-2">
        <div className="text-[12px] font-semibold text-[#131b2e]">
          {label}
          {required && <span className="text-[#942b00] ml-1">*</span>}
        </div>
        {hint && <div className="text-[11px] text-[#747474] mt-0.5">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}
