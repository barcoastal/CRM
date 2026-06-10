/**
 * SF-style Flow Builder node + edge types.
 *
 * A flow is a directed graph of nodes connected by edges. Each node has a
 * `kind` (start, decision, action, wait, end) and a `config` object whose
 * shape depends on the kind. The executor walks the graph from the start
 * node, evaluates each node, follows edges, and persists state on wait.
 */

export const NODE_KINDS = [
  "start",
  "decision",
  "update_record",
  "create_task",
  "send_email",
  "send_sms",
  "wait",
  "end",
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export type FlowNode = {
  id: string;
  kind: NodeKind;
  label: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
};

export type FlowEdge = {
  id: string;
  source: string;
  target: string;
  /** For decision nodes: which branch (typically "true" or "false") */
  branch?: string;
};

export type FlowGraph = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};

/** Condition AST shape, reused from ValidationRule. */
export type ConditionOperator =
  | "equals"
  | "notEquals"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "isNull"
  | "isNotNull"
  | "in"
  | "notIn";

export type ConditionLeaf = {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
};

export type ConditionGroup = {
  kind: "and" | "or";
  conditions: Array<ConditionLeaf | ConditionGroup>;
};

/** Default config templates per node kind. UI uses these when adding a node. */
export const DEFAULT_NODE_CONFIG: Record<NodeKind, Record<string, unknown>> = {
  start: {},
  decision: {
    condition: { kind: "and", conditions: [] } as ConditionGroup,
  },
  update_record: {
    updates: [] as Array<{ field: string; value: string }>,
  },
  create_task: {
    subject: "Follow up",
    assigneeUserId: "",
    dueDateOffset: 1,
  },
  send_email: {
    templateId: "",
    subject: "",
    body: "",
    toFieldPath: "email",
  },
  send_sms: {
    body: "",
    toFieldPath: "phone",
  },
  wait: {
    waitSeconds: 3600,
    until: "",
  },
  end: {},
};

/** Human readable label per node kind, used by palette + canvas. */
export const NODE_LABELS: Record<NodeKind, string> = {
  start: "Start",
  decision: "Decision",
  update_record: "Update Record",
  create_task: "Create Task",
  send_email: "Send Email",
  send_sms: "Send SMS",
  wait: "Wait",
  end: "End",
};

/** SLDS-ish color tone per kind (used by the canvas card chrome). */
export const NODE_TONES: Record<NodeKind, { bg: string; fg: string; border: string }> = {
  start: { bg: "#e0f5e9", fg: "#0d6b3b", border: "#0d6b3b" },
  decision: { bg: "#fff5cf", fg: "#7a5c00", border: "#7a5c00" },
  update_record: { bg: "#e3f0ff", fg: "#0b5cad", border: "#0b5cad" },
  create_task: { bg: "#e3f0ff", fg: "#0b5cad", border: "#0b5cad" },
  send_email: { bg: "#efe3ff", fg: "#5b21b6", border: "#5b21b6" },
  send_sms: { bg: "#efe3ff", fg: "#5b21b6", border: "#5b21b6" },
  wait: { bg: "#ecebea", fg: "#444656", border: "#444656" },
  end: { bg: "#fde2e2", fg: "#9d1414", border: "#9d1414" },
};

export const SUPPORTED_ENTITIES = [
  "Lead",
  "Opportunity",
  "Account",
  "Case",
  "Task",
  "Event",
] as const;
export type FlowEntity = (typeof SUPPORTED_ENTITIES)[number];

export const TRIGGER_EVENTS = ["INSERT", "UPDATE", "INSERT_OR_UPDATE"] as const;
export type FlowTriggerEvent = (typeof TRIGGER_EVENTS)[number];

export function emptyGraph(): FlowGraph {
  return {
    nodes: [
      {
        id: "start",
        kind: "start",
        label: "Start",
        position: { x: 80, y: 200 },
        config: {},
      },
      {
        id: "end",
        kind: "end",
        label: "End",
        position: { x: 480, y: 200 },
        config: {},
      },
    ],
    edges: [],
  };
}
