"use client";

import type { FlowTreeNode, FlowTreeBranch } from "@/lib/flow/flow-tree";
import type { NodeKind } from "@/lib/flow/nodes";
import { StepCard, type StepStats } from "./step-card";
import { AddStepMenu } from "./add-step-menu";

/**
 * Renders a tree node and its descendants as a vertical spine. A linear node
 * shows a card, then a "+" adder, then recurses into its single child. A
 * decision node renders its card, then two labeled branch columns. An end node
 * renders the terminal cap.
 */
export function StepSpine({
  node, selectedId, stats, onSelect, onAddAfter, onAddOnBranch, onDelete,
}: {
  node: FlowTreeNode;
  selectedId: string | null;
  stats: StepStats | null;
  onSelect: (id: string) => void;
  onAddAfter: (afterId: string, kind: NodeKind) => void;
  onAddOnBranch: (decisionId: string, branch: string, kind: NodeKind) => void;
  onDelete: (id: string) => void;
}) {
  if (node.kind === "end") {
    return <div className="ec-fb-end">End</div>;
  }
  const common = { selectedId, stats, onSelect, onAddAfter, onAddOnBranch, onDelete };
  if (node.kind === "decision") {
    return (
      <div className="ec-fb-node">
        <div className="ec-fb-cardwrap">
          <StepCard node={node} selected={selectedId === node.id} stats={stats} onClick={() => onSelect(node.id)} />
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
        <StepCard node={node} selected={selectedId === node.id} stats={stats} onClick={() => onSelect(node.id)} />
        <button className="ec-fb-del" title="Delete step" onClick={() => onDelete(node.id)}>x</button>
      </div>
      <AddStepMenu onPick={(k) => onAddAfter(node.id, k)} />
      {child ? <StepSpine node={child.node} {...common} /> : <div className="ec-fb-end">End</div>}
    </div>
  );
}
