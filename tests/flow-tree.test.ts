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
  it("addSplit moves a non-trivial existing subtree under the true branch", () => {
    const t = graphToTree(linearGraph);
    const emailId = t.children[0].node.id;
    const withWait = insertStep(t, emailId, newTreeNode("wait"));
    const t2 = addSplit(withWait, emailId);
    const decision = t2.children[0].node.children[0].node;
    expect(decision.kind).toBe("decision");
    const trueBranch = decision.children.find((c) => c.branch === "true")!;
    expect(trueBranch.node.kind).toBe("wait");
    const falseBranch = decision.children.find((c) => c.branch === "false")!;
    expect(falseBranch.node.kind).toBe("end");
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
