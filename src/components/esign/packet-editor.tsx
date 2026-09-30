"use client";
import { useState } from "react";
import { DocumentViewer } from "./document-viewer";
import type { PacketConfig, PacketField } from "@/lib/esign/packet-config";
import type { SigningField } from "@/lib/esign/fields";
import styles from "./packet-wizard.module.css";
const palette: [PacketField["kind"], string, number, number][] = [
  ["signature", "Signature", 130, 32],
  ["initial", "Initial", 60, 25],
  ["date", "Date Signed", 110, 18],
  ["name", "Name", 150, 18],
  ["text", "Email", 190, 22],
  ["text", "Company", 170, 22],
  ["text", "Title", 140, 22],
  ["text", "Text", 140, 22],
  ["text", "Number", 100, 22],
  ["text", "Dropdown", 160, 24],
  ["text", "Radio", 170, 70],
  ["checkbox", "Checkbox", 18, 18],
];
const colors = ["#42afc8", "#eeb842", "#ae70cc", "#76af52", "#e97676"];
export function PacketEditor({
  url,
  config,
  onChange,
}: {
  url: string;
  config: PacketConfig;
  onChange: (c: PacketConfig) => void;
}) {
  const signers = config.recipients.filter((r) => r.action === "SIGN");
  const [recipient, setRecipient] = useState(signers[0]?.id ?? "");
  const [tool, setTool] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const chosen = config.fields.find((f) => f.id === selected);
  const update = (id: string, change: Partial<PacketField>) =>
    onChange({
      ...config,
      fields: config.fields.map((f) => (f.id === id ? { ...f, ...change } : f)),
    });
  return (
    <div className={styles.editor}>
      <aside className={styles.palette}>
        <label>
          Assign fields to
          <select
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          >
            {signers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <h3>Standard fields</h3>
        {palette.map(([, label]) => (
          <button
            key={label}
            className={tool === label ? styles.selected : ""}
            onClick={() => setTool(tool === label ? null : label)}
          >
            <span>＋</span>
            {label}
          </button>
        ))}
        <p>
          Choose a field, then click its position on the document. Drag placed
          fields to move them.
        </p>
        {chosen && (
          <div className={styles.properties}>
            <h3>Field settings</h3>
            <label>
              Label
              <input
                value={chosen.label ?? ""}
                onChange={(e) => update(chosen.id, { label: e.target.value })}
              />
            </label>
            <label>
              Recipient
              <select
                value={chosen.recipientId}
                onChange={(e) =>
                  update(chosen.id, { recipientId: e.target.value })
                }
              >
                {signers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={chosen.required}
                onChange={(e) =>
                  update(chosen.id, { required: e.target.checked })
                }
              />
              Required
            </label>
            {["dropdown", "radio"].includes(chosen.inputType ?? "") && (
              <label>
                Options (one per line)
                <textarea
                  value={(chosen.options ?? []).join("\n")}
                  onChange={(e) =>
                    update(chosen.id, { options: e.target.value.split("\n") })
                  }
                />
              </label>
            )}
            <label>
              Width
              <input
                type="number"
                min={8}
                max={600}
                value={chosen.width}
                onChange={(e) =>
                  update(chosen.id, {
                    width: Math.max(8, Number(e.target.value)),
                  })
                }
              />
            </label>
            <label>
              Height
              <input
                type="number"
                min={8}
                max={200}
                value={chosen.height}
                onChange={(e) =>
                  update(chosen.id, {
                    height: Math.max(8, Number(e.target.value)),
                  })
                }
              />
            </label>
            <button
              onClick={() => {
                onChange({
                  ...config,
                  fields: config.fields.filter((f) => f.id !== chosen.id),
                });
                setSelected(null);
              }}
            >
              Remove field
            </button>
          </div>
        )}
      </aside>
      <DocumentViewer
        url={url}
        fields={
          config.fields.map((f, i) => ({ ...f, index: i })) as SigningField[]
        }
        activeId={selected}
        documents={config.documents}
        onPageClick={(page, x, y) => {
          if (!tool || !recipient) return;
          const def = palette.find((p) => p[1] === tool)!;
          const id = crypto.randomUUID();
          onChange({
            ...config,
            fields: [
              ...config.fields,
              {
                id,
                kind: def[0],
                inputType: (["Email", "Number", "Dropdown", "Radio"].includes(
                  def[1],
                )
                  ? def[1].toLowerCase()
                  : "text") as PacketField["inputType"],
                ...(["Dropdown", "Radio"].includes(def[1])
                  ? { options: ["Option 1", "Option 2"] }
                  : {}),
                page,
                x: Math.max(0, x - def[2] / 2),
                y: Math.max(0, y - def[3] / 2),
                width: def[2],
                height: def[3],
                recipientId: recipient,
                label: def[1],
                required: def[0] !== "checkbox",
              },
            ],
          });
          setSelected(id);
        }}
        onFieldMove={(id, x, y) => update(id, { x, y })}
        renderField={(f) => (
          <button
            onClick={() => {
              setSelected(f.id);
              setTool(null);
            }}
            style={{
              background:
                colors[
                  Math.max(
                    0,
                    signers.findIndex((r) => r.id === f.recipientId),
                  ) % colors.length
                ],
              color: "#202032",
              border: "1px solid #66516d",
              outline: 0,
              fontSize: 11,
            }}
          >
            {f.label ?? f.kind}
          </button>
        )}
      />
    </div>
  );
}
