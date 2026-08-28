"use client";

/**
 * Per-step configuration drawer. Renders the right form for the selected
 * node kind and pushes config patches up via onChange. All configs match the
 * shapes the executor reads (DEFAULT_NODE_CONFIG in src/lib/flow/nodes.ts):
 *   send_email: templateId / subject / body / toFieldPath / fromMode
 *   wait:       waitSeconds / until
 *   update_record: updates[{field, value}]
 *   create_task: subject / assigneeUserId / dueDateOffset
 *   decision:   condition as ConditionGroup {kind, conditions:[{field,operator,value}]}
 */
import { useEffect, useState } from "react";
import type { FlowTreeNode } from "@/lib/flow/flow-tree";
import type { ConditionGroup } from "@/lib/flow/nodes";
import { ConditionBuilder } from "./condition-builder";

export function ConfigDrawer({
  node,
  onChange,
  onClose,
}: {
  node: FlowTreeNode;
  entityType: string;
  onChange: (cfg: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [smsTemplates, setSmsTemplates] = useState<{ id: string; name: string; body: string }[]>([]);

  useEffect(() => {
    if (node.kind !== "send_email") return;
    fetch("/api/email-templates")
      .then((r) => r.json())
      .then((d) => {
        const items: unknown[] = Array.isArray(d) ? d : (d.items ?? d.templates ?? []);
        setTemplates(
          items.map((t) => {
            const rec = t as { id: string; name: string };
            return { id: rec.id, name: rec.name };
          }),
        );
      })
      .catch(() => setTemplates([]));
  }, [node.kind]);

  useEffect(() => {
    if (node.kind !== "send_sms") return;
    fetch("/api/email-center/sms-templates")
      .then((r) => r.json())
      .then((d) => setSmsTemplates((d.items ?? []).map((t: { id: string; name: string; body: string }) => ({ id: t.id, name: t.name, body: t.body }))))
      .catch(() => setSmsTemplates([]));
  }, [node.kind]);

  const c = node.config as Record<string, unknown>;

  return (
    <div className="ec-fb-drawer">
      <div className="ec-fb-drawer-head">
        <span>{node.label}</span>
        <button className="ec-btn ec-btn-ghost" onClick={onClose}>Close</button>
      </div>
      <div className="ec-fb-drawer-body">
        {node.kind === "send_email" ? (
          <>
            <div>
              <label className="ec-field-label">Template</label>
              <select
                className="ec-select"
                value={String(c.templateId ?? "")}
                onChange={(e) => onChange({ templateId: e.target.value })}
              >
                <option value="">Write inline below</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            {!c.templateId ? (
              <>
                <div>
                  <label className="ec-field-label">Subject</label>
                  <input
                    className="ec-input"
                    value={String(c.subject ?? "")}
                    onChange={(e) => onChange({ subject: e.target.value })}
                  />
                </div>
                <div>
                  <label className="ec-field-label">Body</label>
                  <textarea
                    className="ec-textarea"
                    rows={6}
                    value={String(c.body ?? "")}
                    onChange={(e) => onChange({ body: e.target.value })}
                  />
                </div>
              </>
            ) : null}
            <div>
              <label className="ec-field-label">Send from</label>
              <select
                className="ec-select"
                value={String(c.fromMode ?? "owner")}
                onChange={(e) => onChange({ fromMode: e.target.value })}
              >
                <option value="owner">Record owner&apos;s mailbox</option>
                <option value="company">Company default address</option>
              </select>
            </div>
            <div>
              <label className="ec-field-label">Recipient field</label>
              <input
                className="ec-input"
                value={String(c.toFieldPath ?? "email")}
                onChange={(e) => onChange({ toFieldPath: e.target.value })}
              />
            </div>
          </>
        ) : null}

        {node.kind === "send_sms" ? (
          <>
            <div>
              <label className="ec-field-label">SMS template</label>
              <select
                className="ec-select"
                value=""
                onChange={(e) => { const t = smsTemplates.find((x) => x.id === e.target.value); if (t) onChange({ body: t.body }); }}
              >
                <option value="">Insert from template...</option>
                {smsTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="ec-field-label">Message</label>
              <textarea
                className="ec-textarea"
                rows={5}
                value={String(c.body ?? "")}
                onChange={(e) => onChange({ body: e.target.value })}
                placeholder="Hi {{firstName}}, ..."
              />
              <div style={{ fontSize: 11, color: "#8a94a6", marginTop: 4 }}>
                {String(c.body ?? "").length} chars · ~{Math.max(1, Math.ceil(String(c.body ?? "").length / 160))} segment(s). Supports {"{{firstName}}"} merge fields.
              </div>
            </div>
            <div>
              <label className="ec-field-label">Recipient field</label>
              <input
                className="ec-input"
                value={String(c.toFieldPath ?? "phone")}
                onChange={(e) => onChange({ toFieldPath: e.target.value })}
              />
            </div>
          </>
        ) : null}

        {node.kind === "wait" ? (
          <WaitConfig
            seconds={Number(c.waitSeconds ?? 0)}
            onChange={(s) => onChange({ waitSeconds: s, until: "" })}
          />
        ) : null}

        {node.kind === "update_record" ? (
          <UpdateConfig
            updates={(c.updates as Array<{ field: string; value: string }>) ?? []}
            onChange={(u) => onChange({ updates: u })}
          />
        ) : null}

        {node.kind === "create_task" ? (
          <>
            <div>
              <label className="ec-field-label">Task subject</label>
              <input
                className="ec-input"
                value={String(c.subject ?? "")}
                onChange={(e) => onChange({ subject: e.target.value })}
              />
            </div>
            <div>
              <label className="ec-field-label">Due in (days)</label>
              <input
                className="ec-input"
                type="number"
                value={Number(c.dueDateOffset ?? 1)}
                onChange={(e) => onChange({ dueDateOffset: Number(e.target.value) })}
              />
            </div>
          </>
        ) : null}

        {node.kind === "decision" ? (
          <div>
            <label className="ec-field-label">Branch to Yes when</label>
            <ConditionBuilder
              value={(c.condition as ConditionGroup) ?? { kind: "and", conditions: [] }}
              onChange={(g) => onChange({ condition: g })}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function WaitConfig({ seconds, onChange }: { seconds: number; onChange: (s: number) => void }) {
  const unit = seconds % 86400 === 0 && seconds > 0 ? "days" : "hours";
  const amount = unit === "days" ? seconds / 86400 : Math.max(1, Math.round(seconds / 3600));
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
      <div style={{ flex: 1 }}>
        <label className="ec-field-label">Wait</label>
        <input
          className="ec-input"
          type="number"
          min={1}
          value={amount}
          onChange={(e) =>
            onChange(Number(e.target.value) * (unit === "days" ? 86400 : 3600))
          }
        />
      </div>
      <div style={{ width: 110 }}>
        <select
          className="ec-select"
          value={unit}
          onChange={(e) =>
            onChange(amount * (e.target.value === "days" ? 86400 : 3600))
          }
        >
          <option value="hours">hours</option>
          <option value="days">days</option>
        </select>
      </div>
    </div>
  );
}

function UpdateConfig({
  updates,
  onChange,
}: {
  updates: Array<{ field: string; value: string }>;
  onChange: (u: Array<{ field: string; value: string }>) => void;
}) {
  return (
    <div>
      <label className="ec-field-label">Field updates</label>
      {updates.map((u, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <input
            className="ec-input"
            placeholder="field"
            value={u.field}
            onChange={(e) =>
              onChange(updates.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))
            }
          />
          <input
            className="ec-input"
            placeholder="value"
            value={u.value}
            onChange={(e) =>
              onChange(updates.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
            }
          />
          <button
            className="ec-btn ec-btn-ghost"
            onClick={() => onChange(updates.filter((_, j) => j !== i))}
          >
            x
          </button>
        </div>
      ))}
      <button
        className="ec-btn ec-btn-ghost"
        onClick={() => onChange([...updates, { field: "", value: "" }])}
      >
        + Add field
      </button>
    </div>
  );
}
