"use client";

/**
 * Vertical flow builder. Holds the tree in state (derived from the saved
 * graph), renders Trigger + spine, applies insert/delete/config mutations, and
 * saves back to /api/flows/[id]. The config drawer is filled in Task 4.
 *
 * Routing rules:
 *   onAddAfter: decision kind -> addSplit; all other kinds -> insertStep
 *   onAddOnBranch: decision kind -> addSplitOnBranch; all other kinds -> insertStepOnBranch
 */
import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  graphToTree,
  treeToGraph,
  newTreeNode,
  insertStep,
  insertStepOnBranch,
  addSplit,
  addSplitOnBranch,
  deleteStep,
  updateNodeConfig,
  findNode,
  type FlowTreeNode,
} from "@/lib/flow/flow-tree";
import type { FlowGraph, NodeKind } from "@/lib/flow/nodes";
import { TriggerCard } from "@/components/email/flow-builder/trigger-card";
import { StepSpine } from "@/components/email/flow-builder/step-spine";
import { AddStepMenu } from "@/components/email/flow-builder/add-step-menu";
import { ConfigDrawer } from "@/components/email/flow-builder/config-drawer";

interface Initial {
  id: string;
  name: string;
  entityType: string;
  triggerEvent: string;
  inactivityDays: number | null;
  reentryPolicy: string;
  reentryCooldownDays: number;
  isActive: boolean;
  entryCriteria: unknown;
  graph: FlowGraph;
}

export function BuilderClient({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [tree, setTree] = useState<FlowTreeNode>(() => graphToTree(initial.graph));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(initial.isActive);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback((fn: (t: FlowTreeNode) => FlowTreeNode) => {
    setTree((t) => fn(t));
    setDirty(true);
  }, []);

  // onAddAfter: inserting a "decision" kind uses addSplit (which handles the
  // branching structure). All other kinds use insertStep.
  const onAddAfter = useCallback((afterId: string, kind: NodeKind) => {
    if (kind === "decision") {
      mutate((t) => addSplit(t, afterId));
    } else {
      mutate((t) => insertStep(t, afterId, newTreeNode(kind)));
    }
  }, [mutate]);

  // onAddOnBranch: inserting a "decision" kind into a branch uses
  // addSplitOnBranch (insertStepOnBranch throws if passed a decision node).
  // All other kinds use insertStepOnBranch.
  const onAddOnBranch = useCallback((decisionId: string, branch: string, kind: NodeKind) => {
    if (kind === "decision") {
      mutate((t) => addSplitOnBranch(t, decisionId, branch));
    } else {
      mutate((t) => insertStepOnBranch(t, decisionId, branch, newTreeNode(kind)));
    }
  }, [mutate]);

  const onDelete = useCallback((id: string) => {
    mutate((t) => deleteStep(t, id));
    setSelectedId((s) => (s === id ? null : s));
  }, [mutate]);

  const onConfigChange = useCallback((id: string, config: Record<string, unknown>) => {
    mutate((t) => updateNodeConfig(t, id, config));
  }, [mutate]);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/flows/${initial.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ graph: treeToGraph(tree), isActive }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Save failed"); return; }
    setDirty(false);
    router.refresh();
  }

  const selected = selectedId ? findNode(tree, selectedId) : null;

  return (
    <div className="ec-fb-wrap">
      <div className="ec-fb-header">
        <div>
          <Link className="ec-btn ec-btn-ghost" href="/email-center/flows" style={{ padding: "4px 10px" }}>Back</Link>
          <span className="ec-fb-name">{initial.name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            className={`ec-switch${isActive ? " ec-switch-on" : ""}`}
            title={isActive ? "Live" : "Draft"}
            onClick={() => { setIsActive((v) => !v); setDirty(true); }}
          >
            <span className="ec-switch-knob" />
          </button>
          <span className="ec-pill ec-pill-neutral">{isActive ? "Live" : "Draft"}</span>
          {error ? <span className="ec-error" style={{ margin: 0, padding: "4px 8px" }}>{error}</span> : null}
          <button className="ec-btn ec-btn-primary" disabled={saving || !dirty} onClick={() => void save()}>
            {saving ? "Saving..." : dirty ? "Save" : "Saved"}
          </button>
        </div>
      </div>
      <div className="ec-fb-canvas">
        <div className="ec-fb-spine">
          <TriggerCard
            entityType={initial.entityType}
            triggerEvent={initial.triggerEvent}
            inactivityDays={initial.inactivityDays}
            reentryPolicy={initial.reentryPolicy}
          />
          {/* Top-of-flow adder: inserts the first step right after the trigger,
              even when the flow is empty (start -> end). */}
          <AddStepMenu onPick={(k) => onAddAfter(tree.id, k)} />
          {tree.children[0] ? (
            <StepSpine
              node={tree.children[0].node}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onAddAfter={onAddAfter}
              onAddOnBranch={onAddOnBranch}
              onDelete={onDelete}
            />
          ) : <div className="ec-fb-end">End</div>}
        </div>
      </div>
      {selected && selected.kind !== "end" ? (
        <ConfigDrawer
          node={selected}
          entityType={initial.entityType}
          onChange={(cfg) => onConfigChange(selected.id, cfg)}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}
