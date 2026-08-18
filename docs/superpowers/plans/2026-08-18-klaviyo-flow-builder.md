# Klaviyo-Style Flow Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Klaviyo-style vertical flow builder in the Email Center (Trigger card, top-to-bottom step spine with "+" inserts, Conditional Split Yes/No branch columns, config drawer) that edits the same `Flow` records the existing engine runs.

**Architecture:** A pure `flow-tree` lib converts the engine's flat `FlowGraph { nodes, edges }` to/from a render-friendly tree (Klaviyo branches never rejoin, so a flow is a tree rooted at `start`). React components render the tree vertically and mutate it; Save serializes back to a graph and PATCHes the existing `/api/flows/[id]`. No engine or API changes.

**Tech Stack:** Next.js App Router, React, Prisma (read-only here), vitest. Monochrome `.ec-` design system.

**Spec:** `docs/superpowers/specs/2026-08-18-klaviyo-flow-builder-design.md`.

**Codebase facts the engineer needs:**
- `src/lib/flow/nodes.ts`: `NodeKind` = start | decision | update_record | create_task | send_email | send_sms | wait | end. `FlowNode = { id, kind, label, position:{x,y}, config }`. `FlowEdge = { id, source, target, branch? }`. `FlowGraph = { nodes, edges }`. `DEFAULT_NODE_CONFIG[kind]` gives default configs (send_email: {templateId, subject, body, toFieldPath:"email", fromMode:"owner"}; wait: {waitSeconds:3600, until:""}; update_record: {updates:[]}; create_task: {subject:"Follow up", assigneeUserId:"", dueDateOffset:1}; decision: {condition:{kind:"and",conditions:[]}}). `NODE_LABELS[kind]`. `emptyGraph()` returns a start+end graph. `SUPPORTED_ENTITIES` = Lead, Contact, Opportunity, Account, Case, Task, Event. `TRIGGER_EVENTS` = INSERT, UPDATE, INSERT_OR_UPDATE, INACTIVITY.
- Condition AST (decision + entry criteria): `ConditionGroup = { kind: "and"|"or", conditions: (ConditionLeaf | ConditionGroup)[] }`, `ConditionLeaf = { field, operator, value? }`, `ConditionOperator` = equals | notEquals | contains | startsWith | endsWith | gt | gte | lt | lte | isNull | isNotNull | in | notIn. The executor's `evaluateCondition` (src/lib/flow/condition.ts) reads this shape; the builder must produce it exactly.
- The executor (`src/lib/flow/executor.ts`) walks from the `start` node following edges; a `decision` node emits branch `"true"`/`"false"` and `nextEdge` follows the matching branch edge. Builder-produced graphs run unchanged.
- Existing APIs (NO changes needed): `POST /api/flows` accepts `{ name, description, entityType, triggerEvent, isActive, reentryPolicy, reentryCooldownDays, inactivityDays }` and returns `{ flow: { id } }`. `PATCH /api/flows/[id]` accepts `{ name?, description?, entityType?, triggerEvent?, isActive?, entryCriteria?, triggerOnFieldChanges?, graph?, reentryPolicy?, reentryCooldownDays?, inactivityDays? }`. `GET /api/email-templates` returns `{ items: [{id,name}] }` (parse defensively).
- Email Center UI: `.ec-` classes in `src/app/(dashboard)/email-center/email-center.css` (monochrome: `--ec-forest` #161616, white cards, `--ec-lime` #d9fe62, `--ec-ink` #131313, `--ec-border` #e6e6e3, `--ec-muted`, `--ec-faint`, `.ec-btn`/`.ec-btn-primary`/`.ec-btn-ghost`, `.ec-input`/`.ec-select`/`.ec-textarea`, `.ec-field-label`, `.ec-pill`/`.ec-pill-neutral`/`.ec-pill-green`/`.ec-pill-live`, `.ec-flows-wrap`/`.ec-flows-head`/`.ec-flows-title`/`.ec-flows-sub`, `.ec-switch`/`.ec-switch-on`/`.ec-switch-knob`, `.ec-empty`, `.ec-error`). The Email Center layout wraps these routes (rail + chrome) automatically since they live under `src/app/(dashboard)/email-center/`.
- Email Center Flows list to repoint: `src/app/(dashboard)/email-center/flows/flows-client.tsx` (currently New Flow -> `/automation/flows/new`, row -> `/automation/flows/[id]`, Report link stays).
- Auth: server pages use `auth()` from `@/lib/auth` + `redirect("/login")`. ADMIN not required to edit flows (matches existing `/automation/flows`). Client fetches hit the flows APIs which gate themselves.
- Tests: vitest, `tests/*.test.ts`, `@` -> `./src`. Local DB `postgresql://postgres:postgres@localhost:5432/crm_local` (repo .env is stale sqlite; override DATABASE_URL). No em dashes. Never push to remote.

**File structure:**
- Create `src/lib/flow/flow-tree.ts` - pure graph<->tree + mutations + layout (TDD).
- Create `src/app/(dashboard)/email-center/flows/new/page.tsx` + `new-flow-client.tsx` - setup card.
- Create `src/app/(dashboard)/email-center/flows/[id]/page.tsx` + `builder-client.tsx` - builder shell.
- Create `src/components/email/flow-builder/{trigger-card,step-spine,step-card,add-step-menu,config-drawer,condition-builder}.tsx`.
- Modify `src/app/(dashboard)/email-center/flows/flows-client.tsx` - repoint links.
- Modify `src/app/(dashboard)/email-center/email-center.css` - append `.ec-fb-*`.

---

### Task 1: flow-tree pure lib (TDD)

**Files:**
- Create: `src/lib/flow/flow-tree.ts`
- Test: `tests/flow-tree.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/flow-tree.test.ts
import { describe, it, expect } from "vitest";
import {
  graphToTree, treeToGraph, newTreeNode, insertStep, insertStepOnBranch,
  deleteStep, addSplit, addSplitOnBranch, updateNodeConfig, findNode, type FlowTreeNode,
} from "@/lib/flow/flow-tree";
import type { FlowGraph } from "@/lib/flow/nodes";

// A minimal linear graph: start -> send_email -> end
const linearGraph: FlowGraph = {
  nodes: [
    { id: "start", kind: "start", label: "Start", position: { x: 0, y: 0 }, config: {} },
    { id: "e1", kind: "send_email", label: "Send Email", position: { x: 0, y: 100 }, config: { subject: "Hi" } },
    { id: "end", kind: "end", label: "End", position: { x: 0, y: 200 }, config: {} },
  ],
  edges: [
    { id: "x1", source: "start", target: "e1" },
    { id: "x2", source: "e1", target: "end" },
  ],
};

describe("graphToTree", () => {
  it("builds a start-rooted tree with a single linear child chain", () => {
    const t = graphToTree(linearGraph);
    expect(t.kind).toBe("start");
    expect(t.children).toHaveLength(1);
    expect(t.children[0].node.kind).toBe("send_email");
    expect(t.children[0].node.children[0].node.kind).toBe("end");
  });
  it("returns a start->end tree for an empty graph", () => {
    const t = graphToTree({ nodes: [], edges: [] });
    expect(t.kind).toBe("start");
    expect(t.children[0].node.kind).toBe("end");
  });
  it("breaks cycles without looping", () => {
    const cyclic: FlowGraph = {
      nodes: [
        { id: "start", kind: "start", label: "Start", position: { x: 0, y: 0 }, config: {} },
        { id: "a", kind: "wait", label: "Wait", position: { x: 0, y: 0 }, config: {} },
      ],
      edges: [
        { id: "x1", source: "start", target: "a" },
        { id: "x2", source: "a", target: "a" },
      ],
    };
    const t = graphToTree(cyclic);
    // Should terminate: the wait node's child is an end (cycle broken).
    expect(t.children[0].node.kind).toBe("wait");
    expect(t.children[0].node.children[0].node.kind).toBe("end");
  });
});

describe("treeToGraph round-trip", () => {
  it("tree -> graph -> tree is identity for a linear flow", () => {
    const t1 = graphToTree(linearGraph);
    const t2 = graphToTree(treeToGraph(t1));
    expect(stripPositions(t2)).toEqual(stripPositions(t1));
  });
  it("assigns positions to every node", () => {
    const g = treeToGraph(graphToTree(linearGraph));
    expect(g.nodes.every((n) => typeof n.position.x === "number" && typeof n.position.y === "number")).toBe(true);
  });
});

describe("mutations", () => {
  it("insertStep adds a step after a node and keeps the chain intact", () => {
    const t = graphToTree(linearGraph);
    const emailId = t.children[0].node.id;
    const t2 = insertStep(t, emailId, newTreeNode("wait"));
    // start -> send_email -> wait -> end
    const email = t2.children[0].node;
    expect(email.children[0].node.kind).toBe("wait");
    expect(email.children[0].node.children[0].node.kind).toBe("end");
  });
  it("addSplit inserts a decision with two end-capped branches", () => {
    const t = graphToTree(linearGraph);
    const emailId = t.children[0].node.id;
    const t2 = addSplit(t, emailId);
    const email = t2.children[0].node;
    const decision = email.children[0].node;
    expect(decision.kind).toBe("decision");
    expect(decision.children.map((c) => c.branch).sort()).toEqual(["false", "true"]);
    expect(decision.children.every((c) => c.node.kind === "end")).toBe(true);
  });
  it("insertStepOnBranch adds into the true branch of a decision", () => {
    const t = addSplit(graphToTree(linearGraph), graphToTree(linearGraph).children[0].node.id);
    const decision = t.children[0].node.children[0].node;
    const t2 = insertStepOnBranch(t, decision.id, "true", newTreeNode("send_email"));
    const d2 = findNode(t2, decision.id)!;
    const trueBranch = d2.children.find((c) => c.branch === "true")!;
    expect(trueBranch.node.kind).toBe("send_email");
  });
  it("newTreeNode('decision') has two end-capped branches", () => {
    const d = newTreeNode("decision");
    expect(d.children.map((c) => c.branch).sort()).toEqual(["false", "true"]);
    expect(d.children.every((c) => c.node.kind === "end")).toBe(true);
  });
  it("addSplitOnBranch nests a split inside a branch, moving its subtree under the nested true branch", () => {
    const base = graphToTree(linearGraph);
    const withSplit = addSplit(base, base.children[0].node.id);
    const decision = withSplit.children[0].node.children[0].node;
    // put a send_email into the Yes branch first
    const withEmail = insertStepOnBranch(withSplit, decision.id, "true", newTreeNode("send_email"));
    const d2 = findNode(withEmail, decision.id)!;
    const yesChildId = d2.children.find((c) => c.branch === "true")!.node.id;
    // now nest a split at the top of the Yes branch
    const nested = addSplitOnBranch(withEmail, decision.id, "true");
    const d3 = findNode(nested, decision.id)!;
    const yesNode = d3.children.find((c) => c.branch === "true")!.node;
    expect(yesNode.kind).toBe("decision");
    expect(yesNode.children.find((c) => c.branch === "true")!.node.id).toBe(yesChildId);
  });
  it("deleteStep splices a linear node out and reconnects its child", () => {
    const t = insertStep(graphToTree(linearGraph), graphToTree(linearGraph).children[0].node.id, newTreeNode("wait"));
    const email = t.children[0].node;
    const waitId = email.children[0].node.id;
    const t2 = deleteStep(t, waitId);
    // send_email -> end again
    expect(t2.children[0].node.children[0].node.kind).toBe("end");
  });
  it("updateNodeConfig replaces a node's config immutably", () => {
    const t = graphToTree(linearGraph);
    const emailId = t.children[0].node.id;
    const t2 = updateNodeConfig(t, emailId, { subject: "Changed" });
    expect(findNode(t2, emailId)!.config.subject).toBe("Changed");
    expect(findNode(t, emailId)!.config.subject).toBe("Hi"); // original untouched
  });
});

function stripPositions(n: FlowTreeNode): unknown {
  return { kind: n.kind, config: n.config, children: n.children.map((c) => ({ branch: c.branch ?? null, node: stripPositions(c.node) })) };
}
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run tests/flow-tree.test.ts` -> FAIL (module not found).

- [ ] **Step 3: Implement the lib**

```typescript
// src/lib/flow/flow-tree.ts
/**
 * Pure conversion between the engine's flat FlowGraph and a render-friendly
 * tree for the vertical builder. Klaviyo branches never rejoin, so a flow is a
 * tree rooted at the start node; every leaf is an `end` node.
 *
 * The tree is the canonical editor state: graphToTree then treeToGraph then
 * graphToTree is the identity (modulo layout positions).
 */
import { DEFAULT_NODE_CONFIG, NODE_LABELS, type FlowGraph, type FlowNode, type FlowEdge, type NodeKind } from "./nodes";

export interface FlowTreeBranch {
  branch?: string; // "true" | "false" for decision children; undefined for linear
  node: FlowTreeNode;
}

export interface FlowTreeNode {
  id: string;
  kind: NodeKind;
  label: string;
  config: Record<string, unknown>;
  children: FlowTreeBranch[];
}

function uid(): string {
  return `n_${crypto.randomUUID().slice(0, 8)}`;
}

export function newTreeNode(kind: NodeKind): FlowTreeNode {
  if (kind === "end") return endNode();
  // A decision needs two labeled branch children, not a single linear child.
  if (kind === "decision") {
    return {
      id: uid(),
      kind,
      label: NODE_LABELS[kind],
      config: structuredClone(DEFAULT_NODE_CONFIG[kind]),
      children: [{ branch: "true", node: endNode() }, { branch: "false", node: endNode() }],
    };
  }
  return {
    id: uid(),
    kind,
    label: NODE_LABELS[kind],
    config: structuredClone(DEFAULT_NODE_CONFIG[kind]),
    children: [{ node: endNode() }],
  };
}

function endNode(): FlowTreeNode {
  return { id: uid(), kind: "end", label: "End", config: {}, children: [] };
}

function startNodeOf(graph: FlowGraph): FlowNode | null {
  return graph.nodes.find((n) => n.kind === "start") ?? null;
}

/** Parse a flat graph into a start-rooted tree. Cycle-safe; normalizes leaves to end nodes. */
export function graphToTree(graph: FlowGraph): FlowTreeNode {
  const start = startNodeOf(graph);
  if (!start) {
    // Empty or corrupt graph: minimal start -> end.
    return { id: "start", kind: "start", label: "Start", config: {}, children: [{ node: endNode() }] };
  }
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const outEdges = (id: string) => graph.edges.filter((e) => e.source === id);

  function build(node: FlowNode, visited: Set<string>): FlowTreeNode {
    const tree: FlowTreeNode = { id: node.id, kind: node.kind, label: node.label || NODE_LABELS[node.kind], config: (node.config ?? {}) as Record<string, unknown>, children: [] };
    if (node.kind === "end") return tree;
    if (visited.has(node.id)) {
      tree.children = [{ node: endNode() }]; // cycle: cap with end
      return tree;
    }
    const nextVisited = new Set(visited).add(node.id);
    const edges = outEdges(node.id);
    if (node.kind === "decision") {
      for (const branch of ["true", "false"] as const) {
        const edge = edges.find((e) => e.branch === branch) ?? edges.find((e) => !e.branch);
        const target = edge ? byId.get(edge.target) : undefined;
        tree.children.push({ branch, node: target ? build(target, nextVisited) : endNode() });
      }
      return tree;
    }
    const edge = edges[0];
    const target = edge ? byId.get(edge.target) : undefined;
    tree.children = [{ node: target ? build(target, nextVisited) : endNode() }];
    return tree;
  }
  return build(start, new Set());
}

const COL_WIDTH = 260;
const ROW_HEIGHT = 120;

/** Flatten the tree back to a graph with vertical auto-layout positions. */
export function treeToGraph(tree: FlowTreeNode): FlowGraph {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  let edgeSeq = 0;

  // depth (y) increases down; col (x) shifts for branches.
  function walk(node: FlowTreeNode, depth: number, col: number): void {
    nodes.push({
      id: node.id,
      kind: node.kind,
      label: node.label,
      position: { x: col * COL_WIDTH, y: depth * ROW_HEIGHT },
      config: node.config,
    });
    node.children.forEach((child, i) => {
      const childCol = node.children.length > 1 ? col + (i === 0 ? -1 : 1) : col;
      edges.push({ id: `e_${edgeSeq++}`, source: node.id, target: child.node.id, ...(child.branch ? { branch: child.branch } : {}) });
      walk(child.node, depth + 1, childCol);
    });
  }
  walk(tree, 0, 0);
  return { nodes, edges };
}

/** Find a node anywhere in the tree by id. */
export function findNode(tree: FlowTreeNode, id: string): FlowTreeNode | null {
  if (tree.id === id) return tree;
  for (const c of tree.children) {
    const found = findNode(c.node, id);
    if (found) return found;
  }
  return null;
}

/** Immutable map over the tree; fn returns a replacement node or the same node. */
function mapTree(node: FlowTreeNode, fn: (n: FlowTreeNode) => FlowTreeNode): FlowTreeNode {
  const mapped = fn(node);
  return { ...mapped, children: mapped.children.map((c) => ({ ...c, node: mapTree(c.node, fn) })) };
}

/** Insert newNode immediately after the linear node with id=afterId, before its (single) child. */
export function insertStep(tree: FlowTreeNode, afterId: string, newNode: FlowTreeNode): FlowTreeNode {
  return mapTree(tree, (n) => {
    if (n.id !== afterId) return n;
    const existingChild = n.children[0];
    const inserted: FlowTreeNode = { ...newNode, children: [existingChild ?? { node: endNode() }] };
    return { ...n, children: [{ node: inserted }] };
  });
}

/** Insert a linear newNode at the top of a decision's branch ("true"/"false"), pushing the branch's current subtree beneath it. */
export function insertStepOnBranch(tree: FlowTreeNode, decisionId: string, branch: string, newNode: FlowTreeNode): FlowTreeNode {
  return mapTree(tree, (n) => {
    if (n.id !== decisionId) return n;
    return {
      ...n,
      children: n.children.map((c) =>
        c.branch === branch ? { branch, node: { ...newNode, children: [{ node: c.node }] } } : c,
      ),
    };
  });
}

/** Insert a decision (Conditional Split) after a linear node, moving its existing subtree under the true branch and capping false with end. */
export function addSplit(tree: FlowTreeNode, afterId: string): FlowTreeNode {
  return mapTree(tree, (n) => {
    if (n.id !== afterId) return n;
    const existing = n.children[0]?.node ?? endNode();
    const decision = newTreeNode("decision");
    decision.children = [
      { branch: "true", node: existing },
      { branch: "false", node: endNode() },
    ];
    return { ...n, children: [{ node: decision }] };
  });
}

/** Insert a nested Conditional Split at the top of a branch, moving the branch's current subtree under the new split's true branch. */
export function addSplitOnBranch(tree: FlowTreeNode, decisionId: string, branch: string): FlowTreeNode {
  return mapTree(tree, (n) => {
    if (n.id !== decisionId) return n;
    return {
      ...n,
      children: n.children.map((c) => {
        if (c.branch !== branch) return c;
        const nested = newTreeNode("decision");
        nested.children = [
          { branch: "true", node: c.node },
          { branch: "false", node: endNode() },
        ];
        return { branch, node: nested };
      }),
    };
  });
}

/** Remove a linear node, reconnecting its single child to its parent. Decisions cannot be spliced (delete removes the whole subtree). */
export function deleteStep(tree: FlowTreeNode, nodeId: string): FlowTreeNode {
  function rec(node: FlowTreeNode): FlowTreeNode {
    const children: FlowTreeBranch[] = [];
    for (const c of node.children) {
      if (c.node.id === nodeId) {
        if (c.node.kind === "decision") {
          children.push({ ...c, node: endNode() }); // deleting a split ends that path
        } else {
          const grandchild = c.node.children[0];
          children.push({ ...c, node: grandchild ? rec(grandchild.node) : endNode() });
        }
      } else {
        children.push({ ...c, node: rec(c.node) });
      }
    }
    return { ...node, children };
  }
  return rec(tree);
}

export function updateNodeConfig(tree: FlowTreeNode, nodeId: string, config: Record<string, unknown>): FlowTreeNode {
  return mapTree(tree, (n) => (n.id === nodeId ? { ...n, config: { ...n.config, ...config } } : n));
}
```

- [ ] **Step 4: Run tests, PASS. Full `npx vitest run` green.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/flow/flow-tree.ts tests/flow-tree.test.ts
git commit -m "Flow builder: pure graph<->tree lib with mutations and layout"
```

---

### Task 2: New-flow setup page

**Files:**
- Create: `src/app/(dashboard)/email-center/flows/new/page.tsx`
- Create: `src/app/(dashboard)/email-center/flows/new/new-flow-client.tsx`

- [ ] **Step 1: Server page**

```tsx
// src/app/(dashboard)/email-center/flows/new/page.tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NewFlowClient } from "./new-flow-client";

export const dynamic = "force-dynamic";

export default async function NewEmailFlowPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return <NewFlowClient />;
}
```

- [ ] **Step 2: Client setup card**

```tsx
// src/app/(dashboard)/email-center/flows/new/new-flow-client.tsx
"use client";

/**
 * New flow setup: name + entity + trigger + re-entry. POSTs to /api/flows and
 * drops into the vertical builder. Klaviyo-styled.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const ENTITIES = ["Lead", "Contact", "Opportunity", "Account", "Case"];
const TRIGGERS = [
  { value: "INSERT", label: "created" },
  { value: "UPDATE", label: "updated" },
  { value: "INSERT_OR_UPDATE", label: "created or updated" },
  { value: "INACTIVITY", label: "inactive for N days" },
];
const REENTRY = [
  { value: "ALWAYS", label: "Every trigger" },
  { value: "ONCE", label: "Once per record" },
  { value: "COOLDOWN", label: "Cooldown" },
];

export function NewFlowClient() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [entityType, setEntityType] = useState("Lead");
  const [triggerEvent, setTriggerEvent] = useState("INSERT");
  const [inactivityDays, setInactivityDays] = useState(14);
  const [reentryPolicy, setReentryPolicy] = useState("ALWAYS");
  const [reentryCooldownDays, setReentryCooldownDays] = useState(30);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/flows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(), entityType, triggerEvent, isActive: false,
        reentryPolicy, reentryCooldownDays,
        inactivityDays: triggerEvent === "INACTIVITY" ? inactivityDays : null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok || !data.flow?.id) { setError(data.error ?? "Could not create flow"); return; }
    router.push(`/email-center/flows/${data.flow.id}`);
  }

  return (
    <div className="ec-flows-wrap">
      <div className="ec-flows-head">
        <div>
          <h1 className="ec-flows-title">New Flow</h1>
          <p className="ec-flows-sub">Name it and choose what starts it. You will build the steps next.</p>
        </div>
      </div>
      <div className="ec-seg-editor" style={{ maxWidth: 620 }}>
        <div>
          <label className="ec-field-label">Flow name</label>
          <input className="ec-input" placeholder="Welcome new leads" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="ec-field-label">When a</label>
            <select className="ec-select" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
              {ENTITIES.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="ec-field-label">is</label>
            <select className="ec-select" value={triggerEvent} onChange={(e) => setTriggerEvent(e.target.value)}>
              {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {triggerEvent === "INACTIVITY" ? (
            <div style={{ width: 120 }}>
              <label className="ec-field-label">Days</label>
              <input className="ec-input" type="number" min={1} value={inactivityDays} onChange={(e) => setInactivityDays(Number(e.target.value))} />
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="ec-field-label">Re-entry</label>
            <select className="ec-select" value={reentryPolicy} onChange={(e) => setReentryPolicy(e.target.value)}>
              {REENTRY.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {reentryPolicy === "COOLDOWN" ? (
            <div style={{ width: 140 }}>
              <label className="ec-field-label">Cooldown days</label>
              <input className="ec-input" type="number" min={1} value={reentryCooldownDays} onChange={(e) => setReentryCooldownDays(Number(e.target.value))} />
            </div>
          ) : null}
        </div>
        {error ? <div className="ec-error" style={{ marginTop: 12 }}>{error}</div> : null}
        <div className="ec-seg-editor-foot">
          <span style={{ flex: 1 }} />
          <Link className="ec-btn ec-btn-ghost" href="/email-center/flows">Cancel</Link>
          <button className="ec-btn ec-btn-primary" disabled={saving || !name.trim()} onClick={() => void create()}>
            {saving ? "Creating..." : "Create & build"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit 2>&1 | grep -iE "flows/new" || echo CLEAN`; dev compile check (PORT=3030, GET /email-center/flows/new 200/307).

```bash
git add "src/app/(dashboard)/email-center/flows/new"
git commit -m "Flow builder: Klaviyo-styled new-flow setup page"
```

---

### Task 3: Builder shell + trigger card + linear step spine + save

**Files:**
- Create: `src/app/(dashboard)/email-center/flows/[id]/page.tsx`
- Create: `src/app/(dashboard)/email-center/flows/[id]/builder-client.tsx`
- Create: `src/components/email/flow-builder/trigger-card.tsx`
- Create: `src/components/email/flow-builder/step-spine.tsx`
- Create: `src/components/email/flow-builder/step-card.tsx`
- Create: `src/components/email/flow-builder/add-step-menu.tsx`

- [ ] **Step 1: Server page**

```tsx
// src/app/(dashboard)/email-center/flows/[id]/page.tsx
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { BuilderClient } from "./builder-client";
import type { FlowGraph } from "@/lib/flow/nodes";

export const dynamic = "force-dynamic";

export default async function EmailFlowBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  const flow = await prisma.flow.findUnique({ where: { id } });
  if (!flow) notFound();
  return (
    <BuilderClient
      initial={{
        id: flow.id,
        name: flow.name,
        entityType: flow.entityType,
        triggerEvent: flow.triggerEvent,
        inactivityDays: flow.inactivityDays,
        reentryPolicy: flow.reentryPolicy,
        reentryCooldownDays: flow.reentryCooldownDays,
        isActive: flow.isActive,
        entryCriteria: flow.entryCriteria as unknown,
        graph: flow.graph as unknown as FlowGraph,
      }}
    />
  );
}
```

- [ ] **Step 2: Step card**

```tsx
// src/components/email/flow-builder/step-card.tsx
"use client";

import type { FlowTreeNode } from "@/lib/flow/flow-tree";

const ICONS: Record<string, string> = {
  send_email: "M4 6h16v12H4z M4 7l8 6 8-6",
  wait: "M12 8v4l3 2 M12 3a9 9 0 1 0 0.01 0z",
  update_record: "M4 6h16 M4 12h16 M4 18h10",
  create_task: "M9 11l3 3l8-8 M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9",
  decision: "M12 3l9 9-9 9-9-9z",
};

function summary(n: FlowTreeNode): string {
  const c = n.config as Record<string, unknown>;
  switch (n.kind) {
    case "send_email": return (c.templateId ? "Template email" : (c.subject as string)) || "No content yet";
    case "wait": {
      const s = Number(c.waitSeconds ?? 0);
      if (c.until) return `Until ${c.until}`;
      if (s % 86400 === 0 && s > 0) return `Wait ${s / 86400} day(s)`;
      if (s % 3600 === 0 && s > 0) return `Wait ${s / 3600} hour(s)`;
      return s > 0 ? `Wait ${s}s` : "No delay set";
    }
    case "update_record": return `${(c.updates as unknown[])?.length ?? 0} field update(s)`;
    case "create_task": return (c.subject as string) || "Follow up task";
    case "decision": return "Yes / No branch";
    default: return "";
  }
}

export function StepCard({ node, selected, onClick }: { node: FlowTreeNode; selected: boolean; onClick: () => void }) {
  return (
    <button className={`ec-fb-card${selected ? " ec-fb-card-sel" : ""}`} onClick={onClick}>
      <span className="ec-fb-card-icon">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d={ICONS[node.kind] ?? "M4 6h16v12H4z"} />
        </svg>
      </span>
      <span className="ec-fb-card-main">
        <span className="ec-fb-card-title">{node.label}</span>
        <span className="ec-fb-card-sum">{summary(node)}</span>
      </span>
    </button>
  );
}
```

- [ ] **Step 3: Add-step menu (the "+")**

```tsx
// src/components/email/flow-builder/add-step-menu.tsx
"use client";

import { useState } from "react";
import type { NodeKind } from "@/lib/flow/nodes";

const OPTIONS: { kind: NodeKind; label: string }[] = [
  { kind: "send_email", label: "Send Email" },
  { kind: "wait", label: "Wait" },
  { kind: "update_record", label: "Update Record" },
  { kind: "create_task", label: "Create Task" },
  { kind: "decision", label: "Conditional Split" },
];

export function AddStepMenu({ onPick }: { onPick: (kind: NodeKind) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ec-fb-add">
      <button className="ec-fb-add-btn" onClick={() => setOpen((o) => !o)} title="Add step">+</button>
      {open ? (
        <div className="ec-fb-add-menu" onMouseLeave={() => setOpen(false)}>
          {OPTIONS.map((o) => (
            <button key={o.kind} className="ec-fb-add-item" onClick={() => { onPick(o.kind); setOpen(false); }}>
              {o.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Step spine (recursive, renders linear chain now; branch columns added in Task 5)**

```tsx
// src/components/email/flow-builder/step-spine.tsx
"use client";

import type { FlowTreeNode, FlowTreeBranch } from "@/lib/flow/flow-tree";
import type { NodeKind } from "@/lib/flow/nodes";
import { StepCard } from "./step-card";
import { AddStepMenu } from "./add-step-menu";

/**
 * Renders a tree node and its descendants as a vertical spine. A linear node
 * shows a card, then a "+" adder, then recurses into its single child. A
 * decision node renders its card, then two labeled branch columns (added in
 * Task 5). An end node renders the terminal cap.
 */
export function StepSpine({
  node, selectedId, onSelect, onAddAfter, onAddOnBranch, onDelete,
}: {
  node: FlowTreeNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddAfter: (afterId: string, kind: NodeKind) => void;
  onAddOnBranch: (decisionId: string, branch: string, kind: NodeKind) => void;
  onDelete: (id: string) => void;
}) {
  if (node.kind === "end") {
    return <div className="ec-fb-end">End</div>;
  }
  const common = { selectedId, onSelect, onAddAfter, onAddOnBranch, onDelete };
  if (node.kind === "decision") {
    return (
      <div className="ec-fb-node">
        <div className="ec-fb-cardwrap">
          <StepCard node={node} selected={selectedId === node.id} onClick={() => onSelect(node.id)} />
          <button className="ec-fb-del" title="Delete branch" onClick={() => onDelete(node.id)}>x</button>
        </div>
        <div className="ec-fb-branches">
          {(["true", "false"] as const).map((branch) => {
            const child: FlowTreeBranch | undefined = node.children.find((c) => c.branch === branch);
            return (
              <div key={branch} className="ec-fb-branch">
                <div className="ec-fb-branch-label">{branch === "true" ? "Yes" : "No"}</div>
                <AddStepMenu onPick={(k) => onAddOnBranch(node.id, branch, k)} />
                {child ? <StepSpine node={child.node} {...common} /> : <div className="ec-fb-end">End</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  const child = node.children[0];
  return (
    <div className="ec-fb-node">
      <div className="ec-fb-cardwrap">
        <StepCard node={node} selected={selectedId === node.id} onClick={() => onSelect(node.id)} />
        <button className="ec-fb-del" title="Delete step" onClick={() => onDelete(node.id)}>x</button>
      </div>
      <AddStepMenu onPick={(k) => onAddAfter(node.id, k)} />
      {child ? <StepSpine node={child.node} {...common} /> : <div className="ec-fb-end">End</div>}
    </div>
  );
}
```

- [ ] **Step 5: Trigger card**

```tsx
// src/components/email/flow-builder/trigger-card.tsx
"use client";

const TRIGGER_LABEL: Record<string, string> = {
  INSERT: "is created",
  UPDATE: "is updated",
  INSERT_OR_UPDATE: "is created or updated",
  INACTIVITY: "goes inactive",
};

export function TriggerCard({
  entityType, triggerEvent, inactivityDays, reentryPolicy,
}: {
  entityType: string; triggerEvent: string; inactivityDays: number | null; reentryPolicy: string;
}) {
  return (
    <div className="ec-fb-trigger">
      <div className="ec-fb-trigger-label">Trigger</div>
      <div className="ec-fb-trigger-text">
        When a <b>{entityType}</b> {TRIGGER_LABEL[triggerEvent] ?? triggerEvent}
        {triggerEvent === "INACTIVITY" && inactivityDays ? ` for ${inactivityDays} days` : ""}
      </div>
      <div className="ec-fb-trigger-meta">
        Re-entry: {reentryPolicy.toLowerCase()}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Builder client (state, mutations, save; config drawer wired as a stub for now)**

```tsx
// src/app/(dashboard)/email-center/flows/[id]/builder-client.tsx
"use client";

/**
 * Vertical flow builder. Holds the tree in state (derived from the saved
 * graph), renders Trigger + spine, applies insert/delete/config mutations, and
 * saves back to /api/flows/[id]. The config drawer is filled in Task 4.
 */
import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { graphToTree, treeToGraph, newTreeNode, insertStep, insertStepOnBranch, addSplit, addSplitOnBranch, deleteStep, updateNodeConfig, findNode, type FlowTreeNode } from "@/lib/flow/flow-tree";
import type { FlowGraph, NodeKind } from "@/lib/flow/nodes";
import { TriggerCard } from "@/components/email/flow-builder/trigger-card";
import { StepSpine } from "@/components/email/flow-builder/step-spine";
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

  const onAddAfter = useCallback((afterId: string, kind: NodeKind) => {
    if (kind === "decision") mutate((t) => addSplit(t, afterId));
    else mutate((t) => insertStep(t, afterId, newTreeNode(kind)));
  }, [mutate]);

  const onAddOnBranch = useCallback((decisionId: string, branch: string, kind: NodeKind) => {
    if (kind === "decision") {
      // add a split at the top of the branch: insert an empty step then split it is complex;
      // simplest is to insert a decision node directly via a small helper: reuse insertStepOnBranch with a decision node.
      mutate((t) => insertStepOnBranch(t, decisionId, branch, newTreeNode("decision")));
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
          <button className={`ec-switch${isActive ? " ec-switch-on" : ""}`} title={isActive ? "Live" : "Draft"}
            onClick={() => { setIsActive((v) => !v); setDirty(true); }}>
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
          <TriggerCard entityType={initial.entityType} triggerEvent={initial.triggerEvent} inactivityDays={initial.inactivityDays} reentryPolicy={initial.reentryPolicy} />
          {/* The tree root is the start node; render its child chain. */}
          {tree.children[0] ? (
            <StepSpine node={tree.children[0].node} selectedId={selectedId} onSelect={setSelectedId} onAddAfter={onAddAfter} onAddOnBranch={onAddOnBranch} onDelete={onDelete} />
          ) : <div className="ec-fb-end">End</div>}
        </div>
      </div>
      {selected && selected.kind !== "end" ? (
        <ConfigDrawer node={selected} entityType={initial.entityType} onChange={(cfg) => onConfigChange(selected.id, cfg)} onClose={() => setSelectedId(null)} />
      ) : null}
    </div>
  );
}
```

Note: this imports `ConfigDrawer` (built in Task 4). To keep Task 3 compiling on its own, create a minimal stub `src/components/email/flow-builder/config-drawer.tsx` now that renders the node kind + a Close button; Task 4 replaces its body. Stub:

```tsx
// src/components/email/flow-builder/config-drawer.tsx (STUB - replaced in Task 4)
"use client";
import type { FlowTreeNode } from "@/lib/flow/flow-tree";
export function ConfigDrawer({ node, onClose }: { node: FlowTreeNode; entityType: string; onChange: (cfg: Record<string, unknown>) => void; onClose: () => void }) {
  return (
    <div className="ec-fb-drawer">
      <div className="ec-fb-drawer-head"><span>{node.label}</span><button className="ec-btn ec-btn-ghost" onClick={onClose}>Close</button></div>
      <div style={{ padding: 16, fontSize: 13, color: "#6e6e6a" }}>Configuration coming in the next step.</div>
    </div>
  );
}
```

- [ ] **Step 7: Append builder CSS to email-center.css**

```css
/* ---------- Flow builder ---------- */
.ec-fb-wrap { flex: 1; display: flex; flex-direction: column; min-width: 0; height: 100%; position: relative; }
.ec-fb-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; background: #fff; border-bottom: 1px solid var(--ec-border); }
.ec-fb-name { font-size: 15px; font-weight: 700; margin-left: 12px; }
.ec-fb-canvas { flex: 1; overflow: auto; background: var(--ec-canvas); padding: 28px; }
.ec-fb-spine { display: flex; flex-direction: column; align-items: center; gap: 0; min-width: fit-content; margin: 0 auto; }
.ec-fb-node { display: flex; flex-direction: column; align-items: center; }
.ec-fb-trigger { width: 320px; background: var(--ec-forest); color: #fff; border-radius: 12px; padding: 14px 18px; box-shadow: var(--ec-shadow); }
.ec-fb-trigger-label { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ec-lime); }
.ec-fb-trigger-text { font-size: 14px; margin-top: 4px; }
.ec-fb-trigger-meta { font-size: 11px; color: rgba(244,247,242,0.6); margin-top: 4px; }
.ec-fb-cardwrap { display: flex; align-items: center; gap: 6px; position: relative; }
.ec-fb-card { width: 320px; display: flex; gap: 12px; align-items: center; text-align: left; background: #fff; border: 1px solid var(--ec-border); border-radius: 12px; padding: 12px 14px; box-shadow: var(--ec-shadow); cursor: pointer; font-family: inherit; transition: border-color 0.15s ease; }
.ec-fb-card:hover { border-color: var(--ec-ink); }
.ec-fb-card-sel { border-color: var(--ec-ink); box-shadow: 0 0 0 2px var(--ec-lime); }
.ec-fb-card-icon { width: 30px; height: 30px; border-radius: 8px; background: var(--ec-green-soft); color: var(--ec-ink); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ec-fb-card-main { min-width: 0; flex: 1; }
.ec-fb-card-title { display: block; font-size: 13.5px; font-weight: 650; }
.ec-fb-card-sum { display: block; font-size: 12px; color: var(--ec-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ec-fb-del { position: absolute; right: -26px; border: 0; background: transparent; color: var(--ec-faint); cursor: pointer; font-size: 14px; padding: 4px; }
.ec-fb-del:hover { color: var(--ec-danger); }
.ec-fb-add { position: relative; display: flex; flex-direction: column; align-items: center; }
.ec-fb-add::before { content: ""; width: 2px; height: 14px; background: var(--ec-border); }
.ec-fb-add-btn { width: 24px; height: 24px; border-radius: 50%; border: 1px solid var(--ec-border); background: #fff; color: var(--ec-ink); font-size: 16px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.ec-fb-add-btn:hover { border-color: var(--ec-ink); background: var(--ec-ink); color: #fff; }
.ec-fb-add-menu { position: absolute; top: 40px; z-index: 5; background: #fff; border: 1px solid var(--ec-border); border-radius: 10px; box-shadow: var(--ec-shadow-lift); padding: 4px; width: 180px; }
.ec-fb-add-item { display: block; width: 100%; text-align: left; border: 0; background: transparent; padding: 8px 10px; font-size: 13px; border-radius: 6px; cursor: pointer; font-family: inherit; }
.ec-fb-add-item:hover { background: var(--ec-border-soft); }
.ec-fb-end { margin-top: 14px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ec-faint); padding: 6px 14px; border: 1px dashed var(--ec-border); border-radius: 999px; }
.ec-fb-branches { display: flex; gap: 40px; align-items: flex-start; margin-top: 14px; }
.ec-fb-branch { display: flex; flex-direction: column; align-items: center; }
.ec-fb-branch-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ec-ink); background: var(--ec-lime); border-radius: 999px; padding: 2px 12px; margin-bottom: 8px; }
.ec-fb-drawer { position: absolute; top: 0; right: 0; width: 360px; height: 100%; background: #fff; border-left: 1px solid var(--ec-border); box-shadow: -8px 0 24px rgba(19,19,19,0.06); z-index: 10; display: flex; flex-direction: column; overflow: hidden; }
.ec-fb-drawer-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--ec-border); font-size: 14px; font-weight: 700; }
.ec-fb-drawer-body { padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
```

- [ ] **Step 8: Verify + commit**

Run: `npx tsc --noEmit 2>&1 | grep -iE "flow-builder|flows/\[id\]/builder" || echo CLEAN`; `npx vitest run` green; dev compile check on `/email-center/flows/[id]` with a real flow id (or 307).

```bash
git add "src/app/(dashboard)/email-center/flows/[id]" src/components/email/flow-builder "src/app/(dashboard)/email-center/email-center.css"
git commit -m "Flow builder: vertical shell, trigger card, step spine, add/delete, save"
```

---

### Task 4: Config drawer (Send Email, Wait, Update Record, Create Task, Split condition)

**Files:**
- Create: `src/components/email/flow-builder/condition-builder.tsx`
- Replace: `src/components/email/flow-builder/config-drawer.tsx`

- [ ] **Step 1: Condition builder (ConditionGroup AST)**

```tsx
// src/components/email/flow-builder/condition-builder.tsx
"use client";

import type { ConditionGroup, ConditionLeaf, ConditionOperator } from "@/lib/flow/nodes";

const OPS: { value: ConditionOperator; label: string }[] = [
  { value: "equals", label: "equals" },
  { value: "notEquals", label: "not equal" },
  { value: "contains", label: "contains" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
  { value: "isNull", label: "is empty" },
  { value: "isNotNull", label: "is not empty" },
];

/** Edits a flat ConditionGroup (AND/OR over leaf conditions). Nested groups are left as-is. */
export function ConditionBuilder({ value, onChange }: { value: ConditionGroup; onChange: (g: ConditionGroup) => void }) {
  const leaves = value.conditions.filter((c): c is ConditionLeaf => "field" in c);
  function setLeaf(i: number, patch: Partial<ConditionLeaf>) {
    const next = leaves.map((l, j) => (j === i ? { ...l, ...patch } : l));
    onChange({ ...value, conditions: next });
  }
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <span className="ec-field-label" style={{ margin: 0 }}>Match</span>
        <select className="ec-select ec-select-sm" style={{ width: 90 }} value={value.kind} onChange={(e) => onChange({ ...value, kind: e.target.value as "and" | "or" })}>
          <option value="and">all</option>
          <option value="or">any</option>
        </select>
      </div>
      {leaves.map((leaf, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <input className="ec-input" style={{ width: 110 }} placeholder="field" value={leaf.field} onChange={(e) => setLeaf(i, { field: e.target.value })} />
          <select className="ec-select" style={{ width: 120 }} value={leaf.operator} onChange={(e) => setLeaf(i, { operator: e.target.value as ConditionOperator })}>
            {OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {leaf.operator !== "isNull" && leaf.operator !== "isNotNull" ? (
            <input className="ec-input" style={{ flex: 1 }} placeholder="value" value={String(leaf.value ?? "")} onChange={(e) => setLeaf(i, { value: e.target.value })} />
          ) : <span style={{ flex: 1 }} />}
          <button className="ec-btn ec-btn-ghost" onClick={() => onChange({ ...value, conditions: leaves.filter((_, j) => j !== i) })}>x</button>
        </div>
      ))}
      <button className="ec-btn ec-btn-ghost" style={{ marginTop: 4 }} onClick={() => onChange({ ...value, conditions: [...leaves, { field: "status", operator: "equals", value: "" }] })}>
        + Add condition
      </button>
    </div>
  );
}
```

- [ ] **Step 2: The config drawer (replace the stub)**

```tsx
// src/components/email/flow-builder/config-drawer.tsx
"use client";

/**
 * Per-step configuration drawer. Renders the right form for the selected
 * node kind and pushes config patches up via onChange. All configs match the
 * shapes the executor reads (DEFAULT_NODE_CONFIG in src/lib/flow/nodes.ts).
 */
import { useEffect, useState } from "react";
import type { FlowTreeNode } from "@/lib/flow/flow-tree";
import type { ConditionGroup } from "@/lib/flow/nodes";
import { ConditionBuilder } from "./condition-builder";

export function ConfigDrawer({
  node, onChange, onClose,
}: {
  node: FlowTreeNode;
  entityType: string;
  onChange: (cfg: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (node.kind !== "send_email") return;
    fetch("/api/email-templates").then((r) => r.json()).then((d) => {
      const items = Array.isArray(d) ? d : (d.items ?? d.templates ?? []);
      setTemplates(items.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
    }).catch(() => setTemplates([]));
  }, [node.kind]);

  const c = node.config as Record<string, unknown>;

  return (
    <div className="ec-fb-drawer">
      <div className="ec-fb-drawer-head"><span>{node.label}</span><button className="ec-btn ec-btn-ghost" onClick={onClose}>Close</button></div>
      <div className="ec-fb-drawer-body">
        {node.kind === "send_email" ? (
          <>
            <div>
              <label className="ec-field-label">Template</label>
              <select className="ec-select" value={String(c.templateId ?? "")} onChange={(e) => onChange({ templateId: e.target.value })}>
                <option value="">Write inline below</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            {!c.templateId ? (
              <>
                <div><label className="ec-field-label">Subject</label><input className="ec-input" value={String(c.subject ?? "")} onChange={(e) => onChange({ subject: e.target.value })} /></div>
                <div><label className="ec-field-label">Body</label><textarea className="ec-textarea" rows={6} value={String(c.body ?? "")} onChange={(e) => onChange({ body: e.target.value })} /></div>
              </>
            ) : null}
            <div>
              <label className="ec-field-label">Send from</label>
              <select className="ec-select" value={String(c.fromMode ?? "owner")} onChange={(e) => onChange({ fromMode: e.target.value })}>
                <option value="owner">Record owner&apos;s mailbox</option>
                <option value="company">Company default address</option>
              </select>
            </div>
            <div><label className="ec-field-label">Recipient field</label><input className="ec-input" value={String(c.toFieldPath ?? "email")} onChange={(e) => onChange({ toFieldPath: e.target.value })} /></div>
          </>
        ) : null}

        {node.kind === "wait" ? (
          <WaitConfig seconds={Number(c.waitSeconds ?? 0)} onChange={(s) => onChange({ waitSeconds: s, until: "" })} />
        ) : null}

        {node.kind === "update_record" ? (
          <UpdateConfig updates={(c.updates as Array<{ field: string; value: string }>) ?? []} onChange={(u) => onChange({ updates: u })} />
        ) : null}

        {node.kind === "create_task" ? (
          <>
            <div><label className="ec-field-label">Task subject</label><input className="ec-input" value={String(c.subject ?? "")} onChange={(e) => onChange({ subject: e.target.value })} /></div>
            <div><label className="ec-field-label">Due in (days)</label><input className="ec-input" type="number" value={Number(c.dueDateOffset ?? 1)} onChange={(e) => onChange({ dueDateOffset: Number(e.target.value) })} /></div>
          </>
        ) : null}

        {node.kind === "decision" ? (
          <div>
            <label className="ec-field-label">Branch to Yes when</label>
            <ConditionBuilder value={(c.condition as ConditionGroup) ?? { kind: "and", conditions: [] }} onChange={(g) => onChange({ condition: g })} />
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
        <input className="ec-input" type="number" min={1} value={amount} onChange={(e) => onChange(Number(e.target.value) * (unit === "days" ? 86400 : 3600))} />
      </div>
      <div style={{ width: 110 }}>
        <select className="ec-select" value={unit} onChange={(e) => onChange(amount * (e.target.value === "days" ? 86400 : 3600))}>
          <option value="hours">hours</option>
          <option value="days">days</option>
        </select>
      </div>
    </div>
  );
}

function UpdateConfig({ updates, onChange }: { updates: Array<{ field: string; value: string }>; onChange: (u: Array<{ field: string; value: string }>) => void }) {
  return (
    <div>
      <label className="ec-field-label">Field updates</label>
      {updates.map((u, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <input className="ec-input" placeholder="field" value={u.field} onChange={(e) => onChange(updates.map((x, j) => j === i ? { ...x, field: e.target.value } : x))} />
          <input className="ec-input" placeholder="value" value={u.value} onChange={(e) => onChange(updates.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} />
          <button className="ec-btn ec-btn-ghost" onClick={() => onChange(updates.filter((_, j) => j !== i))}>x</button>
        </div>
      ))}
      <button className="ec-btn ec-btn-ghost" onClick={() => onChange([...updates, { field: "", value: "" }])}>+ Add field</button>
    </div>
  );
}
```

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit 2>&1 | grep -iE "config-drawer|condition-builder" || echo CLEAN`; dev compile check.

```bash
git add src/components/email/flow-builder/config-drawer.tsx src/components/email/flow-builder/condition-builder.tsx
git commit -m "Flow builder: per-step config drawer + condition builder"
```

---

### Task 5: Repoint the Email Center flows list

**Files:**
- Modify: `src/app/(dashboard)/email-center/flows/flows-client.tsx`

- [ ] **Step 1: Repoint New Flow + row links to the new builder**

In `flows-client.tsx`: change the "New Flow" Link `href="/automation/flows/new"` to `href="/email-center/flows/new"`, and the per-flow row main Link `href={\`/automation/flows/${f.id}\`}` to `href={\`/email-center/flows/${f.id}\`}`. Leave the "Report" link (`/email-center/flows/[id]/report`) unchanged. Update the file's header comment that says rows link into the canvas editor to say they open the Email Center builder.

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit 2>&1 | grep -iE "flows-client" || echo CLEAN`; dev compile check on `/email-center/flows`.

```bash
git add "src/app/(dashboard)/email-center/flows/flows-client.tsx"
git commit -m "Flow builder: Email Center flows list opens the new vertical builder"
```

---

### Task 6: Full verification + E2E

- [ ] **Step 1: Suite + build + lint**

Run: `npx vitest run` (flow-tree tests green), `npm run build`, `npx eslint "src/app/(dashboard)/email-center" src/components/email/flow-builder src/lib/flow/flow-tree.ts 2>&1 | tail -3`.

- [ ] **Step 2: Browser E2E (local DB, PORT=3031)**

Seed a throwaway admin user (SUPER_ADMIN + System_Administrator profile + bcrypt, reuse prior E2E pattern) and one EmailTemplate. Then in Playwright:
1. Go to `/email-center/flows`, click New Flow -> fill name "E2E Vertical Flow", entity Lead, trigger created -> Create & build -> lands on the builder.
2. Trigger card shows "When a Lead is created". Click the "+" after the trigger, add Send Email; click the card, the drawer opens, pick the template (or set a subject), close.
3. Add a Wait step (2 days) after the email.
4. Add a Conditional Split; confirm two columns Yes/No render; add a Send Email into the Yes branch; set its condition (status equals NEW).
5. Toggle Live, click Save; confirm "Saved". Reload the page and confirm the whole structure round-trips (email, wait, split with the Yes-branch email all still there and configured).
6. Verify the saved graph runs: with DATABASE_URL override, a tsx one-liner calling `runFlowDryRun` (from src/lib/flow/executor) or `graphToTree`/`treeToGraph` round-trip on the saved flow.graph confirms it is a valid executable graph (start present, decision has true/false edges).
7. Screenshot the builder with the split.
8. Clean up (flow, user, template, scripts); kill server; `git status --short` clean.

- [ ] **Step 3: Commit anything outstanding; do NOT push**

Deploy note for the final report: no new env, no schema, no cron changes; this is pure UI over the existing flow engine and APIs. The old `/automation/flows` canvas remains available and unchanged.
