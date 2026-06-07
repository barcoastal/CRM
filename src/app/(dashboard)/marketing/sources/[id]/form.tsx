"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, Eye, EyeOff, RefreshCw, Send, Plus, Trash2 } from "lucide-react";
import { CRM_LEAD_FIELDS } from "../../lead-fields";

type Source = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  apiKey: string;
  fieldMapping: Record<string, string>;
  defaultOwnerId: string | null;
  defaultQueueId: string | null;
  leadSource: string | null;
  dedupeBy: string | null;
  requiredFields: string[];
};

type Props = {
  source: Source;
  webhookUrl: string;
  users: { id: string; name: string | null; email?: string }[];
  queues: { id: string; name: string }[];
};

type MapRow = { src: string; dst: string };

export function EditSourceForm({ source, webhookUrl, users, queues }: Props) {
  const router = useRouter();
  const [name, setName] = useState(source.name);
  const [slug, setSlug] = useState(source.slug);
  const [isActive, setIsActive] = useState(source.isActive);
  const [apiKey, setApiKey] = useState(source.apiKey);
  const [showKey, setShowKey] = useState(false);
  const [defaultOwnerId, setDefaultOwnerId] = useState(source.defaultOwnerId ?? "");
  const [defaultQueueId, setDefaultQueueId] = useState(source.defaultQueueId ?? "");
  const [leadSource, setLeadSource] = useState(source.leadSource ?? "");
  const [dedupeBy, setDedupeBy] = useState<string>(source.dedupeBy ?? "none");
  const [requiredFields, setRequiredFields] = useState<string[]>(source.requiredFields);
  const [mapping, setMapping] = useState<MapRow[]>(
    Object.entries(source.fieldMapping || {}).map(([src, dst]) => ({ src, dst: String(dst) })),
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [testOpen, setTestOpen] = useState(false);
  const [testPayload, setTestPayload] = useState(
    JSON.stringify(
      {
        first_name: "Test",
        last_name: "Lead",
        email: "test+postback@example.com",
        phone: "+15551234567",
        gclid: "EAIa-test-gclid",
      },
      null,
      2,
    ),
  );
  const [testResult, setTestResult] = useState<{ status: number; body: unknown } | null>(null);
  const [testRunning, setTestRunning] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    const fieldMapping: Record<string, string> = {};
    for (const r of mapping) {
      if (r.src.trim() && r.dst.trim()) fieldMapping[r.src.trim()] = r.dst.trim();
    }
    const res = await fetch(`/api/marketing/sources/${source.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        slug: slug.trim(),
        isActive,
        defaultOwnerId: defaultOwnerId || null,
        defaultQueueId: defaultQueueId || null,
        leadSource: leadSource.trim() || null,
        dedupeBy: dedupeBy === "none" ? null : dedupeBy,
        requiredFields,
        fieldMapping,
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

  async function regenerateKey() {
    if (!confirm("Regenerate API key? The old key will stop working immediately.")) return;
    const res = await fetch(`/api/marketing/sources/${source.id}/regenerate-key`, {
      method: "POST",
    });
    if (!res.ok) {
      alert("Failed to regenerate key");
      return;
    }
    const data = await res.json();
    setApiKey(data.apiKey);
    router.refresh();
  }

  async function deleteSource() {
    if (!confirm(`Delete "${source.name}"? Inbound logs will be lost.`)) return;
    const res = await fetch(`/api/marketing/sources/${source.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Failed to delete");
      return;
    }
    router.push("/marketing/sources");
    router.refresh();
  }

  async function sendTest() {
    setTestRunning(true);
    setTestResult(null);
    let body: unknown;
    try {
      body = JSON.parse(testPayload);
    } catch {
      setTestResult({ status: 0, body: "Invalid JSON in test payload" });
      setTestRunning(false);
      return;
    }
    const res = await fetch(`/api/marketing/sources/${source.id}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: body }),
    });
    const data = await res.json().catch(() => ({}));
    setTestResult({ status: res.status, body: data });
    setTestRunning(false);
    router.refresh();
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <>
      <section className="bg-white rounded-xl p-6 space-y-4" style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}>
        <div className="grid grid-cols-[180px_1fr] gap-4 items-start">
          <div className="pt-2 text-[12px] font-semibold text-[#131b2e]">Webhook URL</div>
          <div>
            <div className="flex gap-2 items-center">
              <code className="flex-1 px-3 py-2 bg-[#f8f8fb] rounded font-mono text-[12px] text-[#131b2e] truncate">
                {webhookUrl}
              </code>
              <button
                type="button"
                onClick={() => copy(webhookUrl)}
                className="p-2 rounded text-[#3052ff] hover:bg-[#f2f3ff]"
                title="Copy URL"
              >
                <Copy className="size-4" />
              </button>
            </div>
            <p className="text-[11px] text-[#706e6b] mt-1">POST JSON or form data with header X-API-Key.</p>
          </div>
        </div>

        <div className="grid grid-cols-[180px_1fr] gap-4 items-start">
          <div className="pt-2 text-[12px] font-semibold text-[#131b2e]">API Key</div>
          <div>
            <div className="flex gap-2 items-center">
              <code className="flex-1 px-3 py-2 bg-[#f8f8fb] rounded font-mono text-[12px] text-[#131b2e] truncate">
                {showKey ? apiKey : "•".repeat(48)}
              </code>
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="p-2 rounded text-[#3052ff] hover:bg-[#f2f3ff]"
                title={showKey ? "Hide" : "Show"}
              >
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
              <button
                type="button"
                onClick={() => copy(apiKey)}
                className="p-2 rounded text-[#3052ff] hover:bg-[#f2f3ff]"
                title="Copy key"
              >
                <Copy className="size-4" />
              </button>
              <button
                type="button"
                onClick={regenerateKey}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-[12px] font-semibold text-[#942b00] border border-[#942b00] hover:bg-[rgba(148,43,0,0.06)]"
                title="Regenerate"
              >
                <RefreshCw className="size-3.5" />
                Regenerate
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[180px_1fr] gap-4 items-start">
          <div className="pt-2 text-[12px] font-semibold text-[#131b2e]">Test</div>
          <div>
            <button
              type="button"
              onClick={() => setTestOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-[12px] font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
            >
              <Send className="size-3.5" />
              Send Test Payload
            </button>
            {testOpen && (
              <div className="mt-3 space-y-2">
                <textarea
                  className="w-full p-3 rounded font-mono text-[12px] border border-[#d8dde6] min-h-[180px]"
                  value={testPayload}
                  onChange={(e) => setTestPayload(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={sendTest}
                    disabled={testRunning}
                    className="px-4 py-1.5 rounded text-[12px] font-semibold text-white disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
                  >
                    {testRunning ? "Sending..." : "Run Test"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestOpen(false)}
                    className="px-3 py-1.5 rounded text-[12px] font-semibold text-[#444656] border border-[#d8dde6] bg-white"
                  >
                    Close
                  </button>
                </div>
                {testResult && (
                  <pre
                    className={`p-3 rounded text-[11px] font-mono overflow-auto max-h-[200px] ${
                      testResult.status >= 200 && testResult.status < 300
                        ? "bg-[rgba(26,125,55,0.08)] text-[#1a7d37]"
                        : "bg-[rgba(148,43,0,0.08)] text-[#942b00]"
                    }`}
                  >
                    HTTP {testResult.status}
                    {"\n"}
                    {JSON.stringify(testResult.body, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl p-6 space-y-5" style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}>
        <h2 className="text-[14px] font-bold text-[#131b2e]">Configuration</h2>
        {error && <div className="p-3 rounded text-[13px] bg-[rgba(148,43,0,0.08)] text-[#942b00]">{error}</div>}

        <Row label="Name">
          <input className="ms-input" value={name} onChange={(e) => setName(e.target.value)} />
        </Row>
        <Row label="Slug">
          <input className="ms-input font-mono text-[12px]" value={slug} onChange={(e) => setSlug(e.target.value)} />
        </Row>
        <Row label="Status">
          <label className="inline-flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
        </Row>
        <Row label="Default Owner">
          <select className="ms-input" value={defaultOwnerId} onChange={(e) => setDefaultOwnerId(e.target.value)}>
            <option value="">No default owner</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ?? u.email}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Default Queue">
          <select className="ms-input" value={defaultQueueId} onChange={(e) => setDefaultQueueId(e.target.value)}>
            <option value="">No queue</option>
            {queues.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Lead Source">
          <input className="ms-input" value={leadSource} onChange={(e) => setLeadSource(e.target.value)} />
        </Row>
        <Row label="Deduplicate By">
          <div className="flex gap-4 text-[13px]">
            {(["none", "email", "phone"] as const).map((v) => (
              <label key={v} className="inline-flex items-center gap-1.5">
                <input type="radio" name="dedupeBy" value={v} checked={dedupeBy === v} onChange={() => setDedupeBy(v)} />
                {v === "none" ? "Allow duplicates" : `By ${v}`}
              </label>
            ))}
          </div>
        </Row>
        <Row label="Required Fields">
          <div className="flex flex-wrap gap-2">
            {CRM_LEAD_FIELDS.map((f) => {
              const on = requiredFields.includes(f);
              return (
                <button
                  type="button"
                  key={f}
                  onClick={() =>
                    setRequiredFields((r) => (on ? r.filter((x) => x !== f) : [...r, f]))
                  }
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                    on ? "bg-[#3052ff] text-white border-[#3052ff]" : "bg-white text-[#444656] border-[#d8dde6]"
                  }`}
                >
                  {f}
                </button>
              );
            })}
          </div>
        </Row>
        <Row label="Field Mapping">
          <div className="space-y-2">
            {mapping.map((r, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  className="ms-input flex-1 font-mono text-[12px]"
                  placeholder="source_field"
                  value={r.src}
                  onChange={(e) =>
                    setMapping((m) => m.map((row, idx) => (idx === i ? { ...row, src: e.target.value } : row)))
                  }
                />
                <span className="text-[#706e6b] text-[11px]">→</span>
                <select
                  className="ms-input flex-1"
                  value={r.dst}
                  onChange={(e) =>
                    setMapping((m) => m.map((row, idx) => (idx === i ? { ...row, dst: e.target.value } : row)))
                  }
                >
                  <option value="">Choose field...</option>
                  {CRM_LEAD_FIELDS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setMapping((m) => m.filter((_, idx) => idx !== i))}
                  className="p-1.5 text-[#942b00] hover:bg-[rgba(148,43,0,0.08)] rounded"
                  aria-label="Remove row"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setMapping((m) => [...m, { src: "", dst: "" }])}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold text-[#3052ff] border border-[#3052ff]"
            >
              <Plus className="size-3.5" />
              Add Field
            </button>
          </div>
        </Row>

        <div className="flex justify-between items-center pt-3 border-t border-[#f2f3ff]">
          <button
            type="button"
            onClick={deleteSource}
            className="px-4 py-2 rounded text-[13px] font-semibold text-[#942b00] border border-[#942b00] hover:bg-[rgba(148,43,0,0.06)]"
          >
            Delete Source
          </button>
          <div className="flex items-center gap-2">
            {savedAt && (
              <span className="text-[11px] text-[#1a7d37]">Saved {savedAt.toLocaleTimeString()}</span>
            )}
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="px-5 py-2 rounded text-[13px] font-semibold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        <style jsx>{`
          :global(.ms-input) {
            width: 100%;
            padding: 8px 10px;
            border: 1px solid #d8dde6;
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
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-4 items-start">
      <div className="pt-2 text-[12px] font-semibold text-[#131b2e]">{label}</div>
      <div>{children}</div>
    </div>
  );
}
