"use client";

/**
 * Flow Builder editor. Renders a ReactFlow canvas backed by the Flow.graph
 * JSON. The palette on the left lets you drop nodes onto the canvas; the
 * inspector on the right edits the currently selected node's config. The
 * test panel sends a sample record to the dry-run API.
 */

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Handle,
  Position,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  DEFAULT_NODE_CONFIG,
  NODE_KINDS,
  NODE_LABELS,
  NODE_TONES,
  SUPPORTED_ENTITIES,
  TRIGGER_EVENTS,
  type FlowEdge as FbEdge,
  type FlowGraph,
  type FlowNode as FbNode,
  type NodeKind,
} from "@/lib/flow/nodes";
import { FlowRunsList } from "./runs-list";

interface InitialFlow {
  id: string;
  name: string;
  description: string;
  entityType: string;
  triggerEvent: string;
  isActive: boolean;
  entryCriteria: unknown;
  triggerOnFieldChanges: unknown;
  graph: unknown;
}

type RfNode = Node<{ kind: NodeKind; label: string; config: Record<string, unknown> }>;
type RfEdge = Edge<{ branch?: string }>;

function genId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function toRfNodes(graph: FlowGraph): RfNode[] {
  return graph.nodes.map((n) => ({
    id: n.id,
    type: "flowCard",
    position: n.position,
    data: { kind: n.kind, label: n.label || NODE_LABELS[n.kind], config: n.config ?? {} },
  }));
}

function toRfEdges(graph: FlowGraph): RfEdge[] {
  return graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.branch ?? null,
    label: e.branch === "true" ? "True" : e.branch === "false" ? "False" : undefined,
    data: e.branch ? { branch: e.branch } : undefined,
    style: { stroke: e.branch === "false" ? "#9d1414" : e.branch === "true" ? "#0d6b3b" : "#3052ff", strokeWidth: 2 },
    labelStyle: { fontSize: 11, fontWeight: 600 },
  }));
}

function toGraphPayload(nodes: RfNode[], edges: RfEdge[]): FlowGraph {
  const outNodes: FbNode[] = nodes.map((n) => ({
    id: n.id,
    kind: n.data.kind,
    label: n.data.label,
    position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
    config: n.data.config ?? {},
  }));
  const outEdges: FbEdge[] = edges.map((e) => {
    const branch = (e.data?.branch as string | undefined) ?? (typeof e.sourceHandle === "string" ? e.sourceHandle : undefined);
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      branch: branch || undefined,
    };
  });
  return { nodes: outNodes, edges: outEdges };
}

function CardNode({ data, selected }: NodeProps) {
  const d = data as { kind: NodeKind; label: string };
  const tone = NODE_TONES[d.kind] ?? NODE_TONES.start;
  const isDecision = d.kind === "decision";
  const isStart = d.kind === "start";
  const isEnd = d.kind === "end";
  return (
    <div
      className="rounded-lg px-3 py-2 min-w-[150px]"
      style={{
        background: tone.bg,
        color: tone.fg,
        border: `2px solid ${selected ? "#3052ff" : tone.border}`,
        boxShadow: selected ? "0 0 0 3px rgba(48,82,255,0.18)" : "0 4px 14px rgba(19,27,46,0.08)",
      }}
    >
      {!isStart ? <Handle type="target" position={Position.Left} style={{ background: tone.border }} /> : null}
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full"
          style={{ background: tone.border }}
        />
        <div className="text-[10px] uppercase tracking-[0.4px] font-bold opacity-80">
          {NODE_LABELS[d.kind]}
        </div>
      </div>
      <div className="text-[13px] font-semibold mt-0.5 leading-tight">{d.label}</div>
      {isDecision ? (
        <>
          <Handle
            type="source"
            id="true"
            position={Position.Right}
            style={{ top: "35%", background: "#0d6b3b" }}
          />
          <Handle
            type="source"
            id="false"
            position={Position.Right}
            style={{ top: "70%", background: "#9d1414" }}
          />
          <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] font-semibold">
            <span className="text-[#0d6b3b]">True</span>
            <span>/</span>
            <span className="text-[#9d1414]">False</span>
          </div>
        </>
      ) : !isEnd ? (
        <Handle type="source" position={Position.Right} style={{ background: tone.border }} />
      ) : null}
    </div>
  );
}

const nodeTypes = { flowCard: CardNode };

interface SaveProps {
  setSaving: (b: boolean) => void;
  setError: (s: string | null) => void;
  flowId: string;
}

export function FlowEditor({ initial }: { initial: InitialFlow }) {
  return (
    <ReactFlowProvider>
      <FlowEditorInner initial={initial} />
    </ReactFlowProvider>
  );
}

function FlowEditorInner({ initial }: { initial: InitialFlow }) {
  const initialGraph = useMemo<FlowGraph>(() => {
    const g = (initial.graph as FlowGraph | null) ?? null;
    if (g && Array.isArray(g.nodes) && Array.isArray(g.edges) && g.nodes.length > 0) return g;
    return {
      nodes: [
        { id: "start", kind: "start", label: "Start", position: { x: 80, y: 200 }, config: {} },
        { id: "end", kind: "end", label: "End", position: { x: 480, y: 200 }, config: {} },
      ],
      edges: [],
    };
  }, [initial.graph]);

  const [nodes, setNodes] = useState<RfNode[]>(() => toRfNodes(initialGraph));
  const [edges, setEdges] = useState<RfEdge[]>(() => toRfEdges(initialGraph));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [entityType, setEntityType] = useState(initial.entityType);
  const [triggerEvent, setTriggerEvent] = useState(initial.triggerEvent);
  const [isActive, setIsActive] = useState(initial.isActive);
  const [entryCriteriaJson, setEntryCriteriaJson] = useState(() => JSON.stringify(initial.entryCriteria ?? { kind: "and", conditions: [] }, null, 2));
  const [triggerOnFieldChanges, setTriggerOnFieldChanges] = useState(() => {
    const arr = Array.isArray(initial.triggerOnFieldChanges) ? (initial.triggerOnFieldChanges as string[]) : [];
    return arr.join(", ");
  });
  const [sampleRecord, setSampleRecord] = useState(() => JSON.stringify({ id: "sample-id", status: "Active", email: "test@example.com" }, null, 2));
  const [testResult, setTestResult] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"inspector" | "settings" | "test" | "runs">("inspector");

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds) as RfNode[]),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds) as RfEdge[]),
    [],
  );
  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => {
      const branch = typeof connection.sourceHandle === "string" ? connection.sourceHandle : undefined;
      const stroke = branch === "false" ? "#9d1414" : branch === "true" ? "#0d6b3b" : "#3052ff";
      return addEdge(
        {
          ...connection,
          id: genId("e"),
          label: branch === "true" ? "True" : branch === "false" ? "False" : undefined,
          data: branch ? { branch } : undefined,
          style: { stroke, strokeWidth: 2 },
          labelStyle: { fontSize: 11, fontWeight: 600 },
        },
        eds,
      ) as RfEdge[];
    });
  }, []);

  const selected = selectedId ? nodes.find((n) => n.id === selectedId) ?? null : null;

  function addNode(kind: NodeKind) {
    const id = genId(kind);
    const node: RfNode = {
      id,
      type: "flowCard",
      position: { x: 250 + Math.round(Math.random() * 60), y: 60 + Math.round(Math.random() * 200) },
      data: { kind, label: NODE_LABELS[kind], config: { ...DEFAULT_NODE_CONFIG[kind] } },
    };
    setNodes((prev) => [...prev, node]);
    setSelectedId(id);
    setTab("inspector");
  }

  function updateSelectedConfig(patch: Record<string, unknown>) {
    if (!selectedId) return;
    setNodes((prev) =>
      prev.map((n) =>
        n.id === selectedId
          ? { ...n, data: { ...n.data, config: { ...n.data.config, ...patch } } }
          : n,
      ),
    );
  }

  function updateSelectedLabel(label: string) {
    if (!selectedId) return;
    setNodes((prev) =>
      prev.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, label } } : n)),
    );
  }

  function deleteSelected() {
    if (!selectedId) return;
    if (selectedId === "start" || selectedId === "end") return;
    setNodes((prev) => prev.filter((n) => n.id !== selectedId));
    setEdges((prev) => prev.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    let parsedCriteria: unknown;
    try {
      parsedCriteria = JSON.parse(entryCriteriaJson);
    } catch {
      setError("Entry criteria is not valid JSON");
      setSaving(false);
      return;
    }
    const triggerOnList = triggerOnFieldChanges
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      const res = await fetch(`/api/flows/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          entityType,
          triggerEvent,
          isActive,
          entryCriteria: parsedCriteria,
          triggerOnFieldChanges: triggerOnList,
          graph: toGraphPayload(nodes, edges),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? `HTTP ${res.status}`);
        setSaving(false);
        return;
      }
      setSaving(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setSaving(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      // Save first so the test uses the latest graph + criteria
      await save();
      let sample: unknown;
      try {
        sample = JSON.parse(sampleRecord);
      } catch {
        setError("Sample record is not valid JSON");
        setTesting(false);
        return;
      }
      const res = await fetch(`/api/flows/${initial.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleRecord: sample }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-[24px] font-bold tracking-tight text-[#131b2e] bg-transparent border-0 focus:outline-none focus:border-b-2 focus:border-[#3052ff]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          />
          <p className="text-[12px] text-[#444656] mt-1">
            {entityType} on {triggerEvent}
            {isActive ? "" : " (inactive)"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {error ? (
            <span className="px-2 py-1 rounded text-[11px] font-semibold bg-[#fde2e2] text-[#9d1414]">
              {error}
            </span>
          ) : null}
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="px-3 py-1.5 rounded text-[12px] font-semibold text-white"
            style={{ background: saving ? "#9c9bb5" : "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        {/* Palette */}
        <div
          className="bg-white rounded-xl p-3 w-[180px] shrink-0"
          style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
        >
          <div className="text-[11px] uppercase tracking-[0.4px] font-bold text-[#444656] mb-2">
            Add Node
          </div>
          <div className="space-y-1.5">
            {NODE_KINDS.filter((k) => k !== "start" && k !== "end").map((k) => {
              const tone = NODE_TONES[k];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => addNode(k)}
                  className="w-full text-left px-2.5 py-1.5 rounded text-[12px] font-semibold flex items-center gap-2"
                  style={{ background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}` }}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: tone.border }}
                  />
                  {NODE_LABELS[k]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Canvas */}
        <div
          className="bg-white rounded-xl overflow-hidden flex-1"
          style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)", height: "560px" }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => {
              setSelectedId(node.id);
              setTab("inspector");
            }}
            onPaneClick={() => setSelectedId(null)}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} color="#f2f3ff" />
            <Controls />
            <MiniMap pannable zoomable nodeStrokeWidth={3} />
          </ReactFlow>
        </div>

        {/* Inspector */}
        <div
          className="bg-white rounded-xl w-[320px] shrink-0 overflow-hidden flex flex-col"
          style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)", height: "560px" }}
        >
          <div className="flex border-b border-[#f2f3ff]">
            {(["inspector", "settings", "test", "runs"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className="flex-1 px-2 py-2 text-[11px] uppercase tracking-[0.4px] font-bold"
                style={{
                  color: tab === t ? "#3052ff" : "#747474",
                  background: tab === t ? "#f2f3ff" : "transparent",
                  borderBottom: tab === t ? "2px solid #3052ff" : "2px solid transparent",
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-3 text-[12px] text-[#131b2e]">
            {tab === "inspector" ? (
              selected ? (
                <NodeInspector
                  node={selected}
                  onLabelChange={updateSelectedLabel}
                  onConfigChange={updateSelectedConfig}
                  onDelete={deleteSelected}
                />
              ) : (
                <div className="text-[12px] text-[#747474]">
                  Select a node on the canvas to edit its config. Drag from a node handle to connect.
                  Decision nodes have two output handles (True / False).
                </div>
              )
            ) : null}
            {tab === "settings" ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#444656] mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-2 py-1.5 text-[12px] border border-[#e0dfe6] rounded"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#444656] mb-1">Entity</label>
                  <select
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value)}
                    className="w-full px-2 py-1.5 text-[12px] border border-[#e0dfe6] rounded bg-white"
                  >
                    {SUPPORTED_ENTITIES.map((e) => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#444656] mb-1">Trigger Event</label>
                  <select
                    value={triggerEvent}
                    onChange={(e) => setTriggerEvent(e.target.value)}
                    className="w-full px-2 py-1.5 text-[12px] border border-[#e0dfe6] rounded bg-white"
                  >
                    {TRIGGER_EVENTS.map((e) => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#444656] mb-1">
                    Fire only when these fields change (comma separated, UPDATE only)
                  </label>
                  <input
                    type="text"
                    value={triggerOnFieldChanges}
                    onChange={(e) => setTriggerOnFieldChanges(e.target.value)}
                    placeholder="status, owner"
                    className="w-full px-2 py-1.5 text-[12px] border border-[#e0dfe6] rounded"
                  />
                </div>
                <div>
                  <label className="inline-flex items-center gap-2 text-[12px] text-[#444656]">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                    />
                    Active
                  </label>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#444656] mb-1">
                    Entry Criteria (JSON, ConditionGroup AST)
                  </label>
                  <textarea
                    rows={6}
                    value={entryCriteriaJson}
                    onChange={(e) => setEntryCriteriaJson(e.target.value)}
                    className="w-full px-2 py-1.5 text-[11px] font-mono border border-[#e0dfe6] rounded"
                  />
                  <div className="text-[10px] text-[#747474] mt-1">
                    Shape: {"{ kind: 'and' | 'or', conditions: [{ field, operator, value }] }"}
                  </div>
                </div>
              </div>
            ) : null}
            {tab === "test" ? (
              <div className="space-y-3">
                <div className="text-[11px] text-[#747474]">
                  Dry run the flow against a sample record. No side effects.
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#444656] mb-1">Sample Record</label>
                  <textarea
                    rows={6}
                    value={sampleRecord}
                    onChange={(e) => setSampleRecord(e.target.value)}
                    className="w-full px-2 py-1.5 text-[11px] font-mono border border-[#e0dfe6] rounded"
                  />
                </div>
                <button
                  type="button"
                  disabled={testing}
                  onClick={runTest}
                  className="w-full px-3 py-1.5 rounded text-[12px] font-semibold text-white"
                  style={{ background: testing ? "#9c9bb5" : "linear-gradient(135deg, #0034e4, #3052ff)" }}
                >
                  {testing ? "Running..." : "Save and Test"}
                </button>
                {testResult ? (
                  <pre className="bg-[#f7f7fb] border border-[#e0dfe6] rounded px-2 py-1.5 text-[10px] overflow-auto max-h-[260px]">
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                ) : null}
              </div>
            ) : null}
            {tab === "runs" ? <FlowRunsList flowId={initial.id} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function NodeInspector({
  node,
  onLabelChange,
  onConfigChange,
  onDelete,
}: {
  node: RfNode;
  onLabelChange: (s: string) => void;
  onConfigChange: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const kind = node.data.kind;
  const config = node.data.config;
  const isStartOrEnd = kind === "start" || kind === "end";
  return (
    <div className="space-y-3">
      <div>
        <div className="text-[10px] uppercase tracking-[0.4px] font-bold text-[#747474]">{NODE_LABELS[kind]}</div>
        <input
          value={node.data.label}
          onChange={(e) => onLabelChange(e.target.value)}
          className="w-full text-[14px] font-bold text-[#131b2e] bg-transparent border-0 focus:outline-none focus:border-b-2 focus:border-[#3052ff]"
        />
      </div>
      {kind === "decision" ? (
        <div>
          <label className="block text-[11px] font-semibold text-[#444656] mb-1">
            Condition (JSON AST)
          </label>
          <textarea
            rows={6}
            value={JSON.stringify(config.condition ?? { kind: "and", conditions: [] }, null, 2)}
            onChange={(e) => {
              try {
                onConfigChange({ condition: JSON.parse(e.target.value) });
              } catch {
                // Keep editing; ignore parse errors until valid.
              }
            }}
            className="w-full px-2 py-1.5 text-[11px] font-mono border border-[#e0dfe6] rounded"
          />
          <div className="text-[10px] text-[#747474] mt-1">
            True branch follows the green handle; false follows the red.
          </div>
        </div>
      ) : null}
      {kind === "update_record" ? (
        <div>
          <label className="block text-[11px] font-semibold text-[#444656] mb-1">
            Updates (JSON: array of {"{ field, value }"})
          </label>
          <textarea
            rows={5}
            value={JSON.stringify(config.updates ?? [], null, 2)}
            onChange={(e) => {
              try {
                onConfigChange({ updates: JSON.parse(e.target.value) });
              } catch {
                // ignore
              }
            }}
            className="w-full px-2 py-1.5 text-[11px] font-mono border border-[#e0dfe6] rounded"
          />
          <div className="text-[10px] text-[#747474] mt-1">
            Use {"{{record.field}}"} to reference the current record.
          </div>
        </div>
      ) : null}
      {kind === "create_task" ? (
        <>
          <div>
            <label className="block text-[11px] font-semibold text-[#444656] mb-1">Subject</label>
            <input
              type="text"
              value={String(config.subject ?? "")}
              onChange={(e) => onConfigChange({ subject: e.target.value })}
              className="w-full px-2 py-1.5 text-[12px] border border-[#e0dfe6] rounded"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#444656] mb-1">Assignee User ID (optional)</label>
            <input
              type="text"
              value={String(config.assigneeUserId ?? "")}
              onChange={(e) => onConfigChange({ assigneeUserId: e.target.value })}
              className="w-full px-2 py-1.5 text-[12px] border border-[#e0dfe6] rounded"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#444656] mb-1">Due in (days from now)</label>
            <input
              type="number"
              value={Number(config.dueDateOffset ?? 0)}
              onChange={(e) => onConfigChange({ dueDateOffset: Number(e.target.value) })}
              className="w-full px-2 py-1.5 text-[12px] border border-[#e0dfe6] rounded"
            />
          </div>
        </>
      ) : null}
      {kind === "send_email" ? (
        <>
          <div>
            <label className="block text-[11px] font-semibold text-[#444656] mb-1">Template ID (optional)</label>
            <input
              type="text"
              value={String(config.templateId ?? "")}
              onChange={(e) => onConfigChange({ templateId: e.target.value })}
              className="w-full px-2 py-1.5 text-[12px] border border-[#e0dfe6] rounded"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#444656] mb-1">Subject (overrides template)</label>
            <input
              type="text"
              value={String(config.subject ?? "")}
              onChange={(e) => onConfigChange({ subject: e.target.value })}
              className="w-full px-2 py-1.5 text-[12px] border border-[#e0dfe6] rounded"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#444656] mb-1">Body (overrides template)</label>
            <textarea
              rows={4}
              value={String(config.body ?? "")}
              onChange={(e) => onConfigChange({ body: e.target.value })}
              className="w-full px-2 py-1.5 text-[12px] border border-[#e0dfe6] rounded"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#444656] mb-1">Recipient field path</label>
            <input
              type="text"
              value={String(config.toFieldPath ?? "email")}
              onChange={(e) => onConfigChange({ toFieldPath: e.target.value })}
              className="w-full px-2 py-1.5 text-[12px] border border-[#e0dfe6] rounded"
            />
            <div className="text-[10px] text-[#747474] mt-1">e.g. email, owner.email</div>
          </div>
        </>
      ) : null}
      {kind === "send_sms" ? (
        <>
          <div>
            <label className="block text-[11px] font-semibold text-[#444656] mb-1">Body</label>
            <textarea
              rows={3}
              value={String(config.body ?? "")}
              onChange={(e) => onConfigChange({ body: e.target.value })}
              className="w-full px-2 py-1.5 text-[12px] border border-[#e0dfe6] rounded"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#444656] mb-1">Recipient field path</label>
            <input
              type="text"
              value={String(config.toFieldPath ?? "phone")}
              onChange={(e) => onConfigChange({ toFieldPath: e.target.value })}
              className="w-full px-2 py-1.5 text-[12px] border border-[#e0dfe6] rounded"
            />
          </div>
        </>
      ) : null}
      {kind === "wait" ? (
        <>
          <div>
            <label className="block text-[11px] font-semibold text-[#444656] mb-1">Wait seconds</label>
            <input
              type="number"
              value={Number(config.waitSeconds ?? 0)}
              onChange={(e) => onConfigChange({ waitSeconds: Number(e.target.value) })}
              className="w-full px-2 py-1.5 text-[12px] border border-[#e0dfe6] rounded"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#444656] mb-1">
              Or wait until ISO timestamp
            </label>
            <input
              type="text"
              value={String(config.until ?? "")}
              onChange={(e) => onConfigChange({ until: e.target.value })}
              placeholder="2026-06-15T09:00:00Z"
              className="w-full px-2 py-1.5 text-[12px] border border-[#e0dfe6] rounded"
            />
          </div>
        </>
      ) : null}
      {kind === "start" || kind === "end" ? (
        <div className="text-[11px] text-[#747474]">
          {NODE_LABELS[kind]} nodes have no config.
        </div>
      ) : null}
      {!isStartOrEnd ? (
        <button
          type="button"
          onClick={onDelete}
          className="w-full px-2 py-1.5 rounded text-[11px] font-semibold text-[#9d1414] bg-[#fde2e2]"
        >
          Delete Node
        </button>
      ) : null}
    </div>
  );
}
