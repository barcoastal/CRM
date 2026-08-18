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
    if (node.kind === "end") {
      return { id: node.id, kind: "end", label: node.label || "End", config: (node.config ?? {}) as Record<string, unknown>, children: [] };
    }
    if (visited.has(node.id)) {
      return endNode(); // cycle: cap with end
    }
    const tree: FlowTreeNode = { id: node.id, kind: node.kind, label: node.label || NODE_LABELS[node.kind], config: (node.config ?? {}) as Record<string, unknown>, children: [] };
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
  if (newNode.kind === "decision") throw new Error("Use addSplit to insert a Conditional Split, not insertStep");
  return mapTree(tree, (n) => {
    if (n.id !== afterId) return n;
    const existingChild = n.children[0];
    const inserted: FlowTreeNode = { ...newNode, children: [existingChild ?? { node: endNode() }] };
    return { ...n, children: [{ node: inserted }] };
  });
}

/** Insert a linear newNode at the top of a decision's branch ("true"/"false"), pushing the branch's current subtree beneath it. */
export function insertStepOnBranch(tree: FlowTreeNode, decisionId: string, branch: string, newNode: FlowTreeNode): FlowTreeNode {
  if (newNode.kind === "decision") throw new Error("Use addSplitOnBranch to insert a Conditional Split into a branch, not insertStepOnBranch");
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
