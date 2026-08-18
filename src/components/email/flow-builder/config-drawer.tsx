"use client";
// STUB - replaced in Task 4
import type { FlowTreeNode } from "@/lib/flow/flow-tree";
export function ConfigDrawer({ node, onClose }: { node: FlowTreeNode; entityType: string; onChange: (cfg: Record<string, unknown>) => void; onClose: () => void }) {
  return (
    <div className="ec-fb-drawer">
      <div className="ec-fb-drawer-head"><span>{node.label}</span><button className="ec-btn ec-btn-ghost" onClick={onClose}>Close</button></div>
      <div style={{ padding: 16, fontSize: 13, color: "#6e6e6a" }}>Configuration coming in the next step.</div>
    </div>
  );
}
