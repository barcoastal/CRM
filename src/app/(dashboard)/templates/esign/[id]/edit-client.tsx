"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Save } from "@/components/icons/lucide";
import { MERGE_PATHS, RECORD_TYPES } from "@/lib/esign/merge-paths";
import { COLLECT_TARGETS } from "@/lib/esign/collect-targets";
import { PdfBoxPlacer } from "@/components/esign/pdf-box-placer";

interface Box {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  mergeValue?: string;
  collectTo?: string;
}

export interface EditInitial {
  id: string;
  name: string;
  recordType: string;
  description: string | null;
  isActive: boolean;
  pageCount: number;
  pdfFilename: string;
  mergeMapping: Record<string, string>;
  signatureBoxes: unknown[];
  initialBoxes: unknown[];
  dateBoxes: unknown[];
  textBoxes: unknown[];
  dataBoxes: unknown[];
  checkboxBoxes: unknown[];
  createdByName: string | null;
  createdAt: string;
}

function normalizeBoxes(input: unknown[]): Box[] {
  return input
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const r = raw as Record<string, unknown>;
      const page = Number(r.page);
      const x = Number(r.x);
      const y = Number(r.y);
      const width = Number(r.width);
      const height = Number(r.height);
      if (!Number.isFinite(page) || page < 1) return null;
      if (![x, y, width, height].every((n) => Number.isFinite(n))) return null;
      return {
        page: Math.round(page),
        x,
        y,
        width,
        height,
        label: typeof r.label === "string" ? r.label : undefined,
        mergeValue: typeof r.mergeValue === "string" ? r.mergeValue : undefined,
        collectTo: typeof r.collectTo === "string" ? r.collectTo : undefined,
      } as Box;
    })
    .filter((b): b is Box => b !== null);
}

export function EditClient({ initial }: { initial: EditInitial }) {
  const router = useRouter();

  // -------- Section 1: Details --------
  const [name, setName] = useState(initial.name);
  const [recordType, setRecordType] = useState(initial.recordType);
  const [description, setDescription] = useState(initial.description ?? "");
  const [isActive, setIsActive] = useState(initial.isActive);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsMsg, setDetailsMsg] = useState<string | null>(null);

  async function saveDetails() {
    setSavingDetails(true);
    setDetailsMsg(null);
    try {
      const res = await fetch(`/api/esign/templates/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, recordType, description, isActive }),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      setDetailsMsg("Saved.");
      router.refresh();
    } catch (err) {
      setDetailsMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingDetails(false);
    }
  }

  async function deleteTemplate() {
    if (!confirm("Delete this template? This cannot be undone.")) return;
    const res = await fetch(`/api/esign/templates/${initial.id}`, { method: "DELETE" });
    if (res.ok) router.push("/templates/esign");
    else alert(`Delete failed (${res.status})`);
  }

  // -------- Section 2: Merge mapping --------
  const [fields, setFields] = useState<string[] | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>(initial.mergeMapping ?? {});
  const [savingMapping, setSavingMapping] = useState(false);
  const [mappingMsg, setMappingMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/esign/templates/${initial.id}/fields`);
        if (!res.ok) throw new Error(`Fields fetch failed (${res.status})`);
        const j = (await res.json()) as { fields: string[]; pageCount: number };
        if (cancelled) return;
        setFields(j.fields);
        // Merge any new fields from the PDF into the stored mapping with blanks.
        setMapping((prev) => {
          const next = { ...prev };
          for (const f of j.fields) if (!(f in next)) next[f] = "";
          return next;
        });
      } catch {
        if (!cancelled) setFields([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initial.id]);

  async function saveMapping() {
    setSavingMapping(true);
    setMappingMsg(null);
    try {
      const res = await fetch(`/api/esign/templates/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mergeMapping: mapping }),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      setMappingMsg("Saved.");
      router.refresh();
    } catch (err) {
      setMappingMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingMapping(false);
    }
  }

  // -------- Section 3: Signature / Initial / Date boxes --------
  const [sigBoxes, setSigBoxes] = useState<Box[]>(() => normalizeBoxes(initial.signatureBoxes));
  const [initBoxes, setInitBoxes] = useState<Box[]>(() => normalizeBoxes(initial.initialBoxes));
  const [dateBoxes, setDateBoxes] = useState<Box[]>(() => normalizeBoxes(initial.dateBoxes));
  const [textBoxes, setTextBoxes] = useState<Box[]>(() => normalizeBoxes(initial.textBoxes));
  const [dataBoxes, setDataBoxes] = useState<Box[]>(() => normalizeBoxes(initial.dataBoxes));
  const [checkboxBoxes, setCheckboxBoxes] = useState<Box[]>(() =>
    normalizeBoxes(initial.checkboxBoxes),
  );
  const [savingBoxes, setSavingBoxes] = useState(false);
  const [boxesMsg, setBoxesMsg] = useState<string | null>(null);

  function addBoxToList(setter: React.Dispatch<React.SetStateAction<Box[]>>, defaults: Partial<Box>) {
    setter((prev) => [
      ...prev,
      {
        page: defaults.page ?? initial.pageCount,
        x: defaults.x ?? 72,
        y: defaults.y ?? 72,
        width: defaults.width ?? 200,
        height: defaults.height ?? 40,
        label: defaults.label ?? "",
      },
    ]);
  }

  async function saveBoxes() {
    setSavingBoxes(true);
    setBoxesMsg(null);
    try {
      const res = await fetch(`/api/esign/templates/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatureBoxes: sigBoxes,
          initialBoxes: initBoxes,
          dateBoxes: dateBoxes,
          textBoxes: textBoxes,
          dataBoxes: dataBoxes,
          checkboxBoxes: checkboxBoxes,
        }),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      setBoxesMsg("Saved.");
      router.refresh();
    } catch (err) {
      setBoxesMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingBoxes(false);
    }
  }

  function applyDefaults() {
    setSigBoxes((prev) =>
      prev.length === 0
        ? [
            {
              page: initial.pageCount,
              x: 72,
              y: 72,
              width: 200,
              height: 40,
              label: "Signature",
            },
          ]
        : prev,
    );
  }

  const grouped = useMemo(() => {
    const out = new Map<string, typeof MERGE_PATHS>();
    for (const p of MERGE_PATHS) {
      const arr = out.get(p.group) ?? [];
      arr.push(p);
      out.set(p.group, arr);
    }
    return Array.from(out.entries());
  }, []);

  const pdfUrl = `/api/esign/templates/${initial.id}/pdf`;

  return (
    <div className="space-y-6">
      {/* Section 1: Details */}
      <Card title="Details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded border border-[#d8dde6] text-[13px] outline-none focus:border-[#3052ff]"
            />
          </Field>
          <Field label="Record Type">
            <select
              value={recordType}
              onChange={(e) => setRecordType(e.target.value)}
              className="w-full px-3 py-2 rounded border border-[#d8dde6] text-[13px] bg-white outline-none focus:border-[#3052ff]"
            >
              {RECORD_TYPES.map((rt) => (
                <option key={rt} value={rt}>
                  {rt}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description" full>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded border border-[#d8dde6] text-[13px] outline-none focus:border-[#3052ff]"
            />
          </Field>
          <Field label="Active">
            <label className="inline-flex items-center gap-2 text-[13px] text-[#131b2e]">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Available for sending
            </label>
          </Field>
          <Field label="Created">
            <div className="text-[13px] text-[#444656]">
              {new Date(initial.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {initial.createdByName ? ` by ${initial.createdByName}` : ""}
            </div>
          </Field>
        </div>
        <Footer
          msg={detailsMsg}
          onSave={saveDetails}
          saving={savingDetails}
          extraLeft={
            <button
              type="button"
              onClick={deleteTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-[12px] font-semibold text-[#c23934] border border-[#f5c6c0] hover:bg-[#fdecea]"
            >
              <Trash2 className="size-3.5" />
              Delete template
            </button>
          }
        />
      </Card>

      {/* Section 2: Merge Mapping */}
      <Card
        title="Merge Field Mapping"
        subtitle="Map each AcroForm field in the PDF to a value from the merge context."
      >
        {fields === null ? (
          <div className="text-[12px] text-[#706e6b]">Loading fields...</div>
        ) : fields.length === 0 ? (
          <div className="text-[12px] text-[#706e6b]">
            No AcroForm fields detected in this PDF. Add form fields with a PDF editor (e.g. Acrobat)
            to enable merges.
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left text-[11px] font-semibold text-[#444656] uppercase tracking-[0.4px] px-3 py-2 bg-[#f2f3ff]">
                  PDF Field
                </th>
                <th className="text-left text-[11px] font-semibold text-[#444656] uppercase tracking-[0.4px] px-3 py-2 bg-[#f2f3ff]">
                  Merge Value
                </th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f) => (
                <tr key={f}>
                  <td className="px-3 py-2 text-[12px] font-mono text-[#131b2e] border-b border-[#ecebea]">
                    {f}
                  </td>
                  <td className="px-3 py-2 border-b border-[#ecebea]">
                    <select
                      value={mapping[f] ?? ""}
                      onChange={(e) =>
                        setMapping((prev) => ({ ...prev, [f]: e.target.value }))
                      }
                      className="w-full px-2 py-1.5 rounded border border-[#d8dde6] text-[12px] bg-white outline-none focus:border-[#3052ff]"
                    >
                      <option value="">— Unmapped —</option>
                      {grouped.map(([group, paths]) => (
                        <optgroup key={group} label={group}>
                          {paths.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Footer msg={mappingMsg} onSave={saveMapping} saving={savingMapping} />
      </Card>

      {/* Section 3: Signature boxes */}
      <Card
        title="Signature Boxes"
        subtitle="Pick a tool, then click the document to drop a box where the signer should sign, initial, or date. Drag a box to move it, click × to remove. Save when done."
      >
        <PdfBoxPlacer
          pdfUrl={pdfUrl}
          signatureBoxes={sigBoxes}
          setSignatureBoxes={setSigBoxes}
          initialBoxes={initBoxes}
          setInitialBoxes={setInitBoxes}
          dateBoxes={dateBoxes}
          setDateBoxes={setDateBoxes}
          textBoxes={textBoxes}
          setTextBoxes={setTextBoxes}
          dataBoxes={dataBoxes}
          setDataBoxes={setDataBoxes}
          checkboxBoxes={checkboxBoxes}
          setCheckboxBoxes={setCheckboxBoxes}
        />

        <details className="mt-5">
          <summary className="text-[12px] font-semibold text-[#3052ff] cursor-pointer">
            Fine-tune coordinates (advanced)
          </summary>
          <div className="mt-3 space-y-5">
          <BoxList
            title="Signature"
            boxes={sigBoxes}
            setBoxes={setSigBoxes}
            pageCount={initial.pageCount}
            onAdd={() => addBoxToList(setSigBoxes, { label: "Signature" })}
            onDefaults={applyDefaults}
          />
          <BoxList
            title="Initial"
            boxes={initBoxes}
            setBoxes={setInitBoxes}
            pageCount={initial.pageCount}
            onAdd={() => addBoxToList(setInitBoxes, { label: "Initial", width: 80, height: 32 })}
          />
          <BoxList
            title="Date"
            boxes={dateBoxes}
            setBoxes={setDateBoxes}
            pageCount={initial.pageCount}
            onAdd={() => addBoxToList(setDateBoxes, { label: "Date", width: 120, height: 24 })}
          />
          <BoxList
            title="Text field"
            boxes={textBoxes}
            setBoxes={setTextBoxes}
            pageCount={initial.pageCount}
            collectTargets
            onAdd={() => addBoxToList(setTextBoxes, { label: "Field", width: 200, height: 28 })}
          />
          <BoxList
            title="CRM data field"
            boxes={dataBoxes}
            setBoxes={setDataBoxes}
            pageCount={initial.pageCount}
            onAdd={() => addBoxToList(setDataBoxes, { label: "CRM field", width: 180, height: 24 })}
          />
          <BoxList
            title="Checkbox"
            boxes={checkboxBoxes}
            setBoxes={setCheckboxBoxes}
            pageCount={initial.pageCount}
            collectTargets
            onAdd={() => addBoxToList(setCheckboxBoxes, { label: "Checkbox", width: 18, height: 18 })}
          />
          </div>
        </details>

        <Footer msg={boxesMsg} onSave={saveBoxes} saving={savingBoxes} />
      </Card>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="bg-white rounded-xl p-6"
      style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
    >
      <header className="mb-4">
        <h2
          className="text-[16px] font-bold text-[#131b2e]"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          {title}
        </h2>
        {subtitle ? <p className="text-[12px] text-[#706e6b] mt-1">{subtitle}</p> : null}
      </header>
      {children}
    </section>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="block text-[11px] font-semibold text-[#444656] uppercase tracking-[0.4px] mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function Footer({
  msg,
  onSave,
  saving,
  extraLeft,
}: {
  msg: string | null;
  onSave: () => void;
  saving: boolean;
  extraLeft?: React.ReactNode;
}) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <div>{extraLeft}</div>
      <div className="flex items-center gap-3">
        {msg ? <span className="text-[12px] text-[#444656]">{msg}</span> : null}
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-white text-[12px] font-semibold disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
        >
          <Save className="size-3.5" />
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

function BoxList({
  title,
  boxes,
  setBoxes,
  pageCount,
  onAdd,
  onDefaults,
  collectTargets,
}: {
  title: string;
  boxes: Box[];
  setBoxes: React.Dispatch<React.SetStateAction<Box[]>>;
  pageCount: number;
  onAdd: () => void;
  onDefaults?: () => void;
  collectTargets?: boolean;
}) {
  function updateBox(idx: number, patch: Partial<Box>) {
    setBoxes((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  }
  function removeBox(idx: number) {
    setBoxes((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[13px] font-bold text-[#131b2e]">{title} Boxes</h3>
        <div className="flex items-center gap-2">
          {onDefaults ? (
            <button
              type="button"
              onClick={onDefaults}
              className="text-[11px] font-semibold text-[#3052ff] hover:underline"
            >
              Sensible defaults
            </button>
          ) : null}
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#d8dde6] text-[11px] font-semibold text-[#131b2e] hover:bg-[#f2f3ff]"
          >
            <Plus className="size-3" />
            Add
          </button>
        </div>
      </div>
      {boxes.length === 0 ? (
        <div className="text-[12px] text-[#706e6b] italic">No {title.toLowerCase()} boxes.</div>
      ) : (
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr>
              {["Page", "X", "Y", "Width", "Height", "Label", ...(collectTargets ? ["Collect to"] : []), ""].map((h) => (
                <th
                  key={h}
                  className="text-left text-[10px] font-semibold text-[#444656] uppercase tracking-[0.4px] px-2 py-1.5 bg-[#f2f3ff]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {boxes.map((b, idx) => (
              <tr key={idx}>
                <td className="px-2 py-1.5 border-b border-[#ecebea]">
                  <input
                    type="number"
                    min={1}
                    max={pageCount}
                    value={b.page}
                    onChange={(e) => updateBox(idx, { page: Number(e.target.value) || 1 })}
                    className="w-16 px-2 py-1 rounded border border-[#d8dde6] text-[12px] outline-none"
                  />
                </td>
                <td className="px-2 py-1.5 border-b border-[#ecebea]">
                  <input
                    type="number"
                    value={b.x}
                    onChange={(e) => updateBox(idx, { x: Number(e.target.value) || 0 })}
                    className="w-20 px-2 py-1 rounded border border-[#d8dde6] text-[12px] outline-none"
                  />
                </td>
                <td className="px-2 py-1.5 border-b border-[#ecebea]">
                  <input
                    type="number"
                    value={b.y}
                    onChange={(e) => updateBox(idx, { y: Number(e.target.value) || 0 })}
                    className="w-20 px-2 py-1 rounded border border-[#d8dde6] text-[12px] outline-none"
                  />
                </td>
                <td className="px-2 py-1.5 border-b border-[#ecebea]">
                  <input
                    type="number"
                    value={b.width}
                    onChange={(e) => updateBox(idx, { width: Number(e.target.value) || 0 })}
                    className="w-20 px-2 py-1 rounded border border-[#d8dde6] text-[12px] outline-none"
                  />
                </td>
                <td className="px-2 py-1.5 border-b border-[#ecebea]">
                  <input
                    type="number"
                    value={b.height}
                    onChange={(e) => updateBox(idx, { height: Number(e.target.value) || 0 })}
                    className="w-20 px-2 py-1 rounded border border-[#d8dde6] text-[12px] outline-none"
                  />
                </td>
                <td className="px-2 py-1.5 border-b border-[#ecebea]">
                  <input
                    type="text"
                    value={b.label ?? ""}
                    onChange={(e) => updateBox(idx, { label: e.target.value })}
                    className="w-full px-2 py-1 rounded border border-[#d8dde6] text-[12px] outline-none"
                  />
                </td>
                {collectTargets ? (
                  <td className="px-2 py-1.5 border-b border-[#ecebea]">
                    <select
                      value={b.collectTo ?? ""}
                      onChange={(e) => updateBox(idx, { collectTo: e.target.value || undefined })}
                      className="w-full px-2 py-1 rounded border border-[#d8dde6] text-[12px] bg-white outline-none"
                    >
                      <option value="">— Don&apos;t save —</option>
                      {COLLECT_TARGETS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </td>
                ) : null}
                <td className="px-2 py-1.5 border-b border-[#ecebea] text-right">
                  <button
                    type="button"
                    onClick={() => removeBox(idx)}
                    className="text-[#c23934] hover:bg-[#fdecea] rounded p-1"
                    aria-label="Remove"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
