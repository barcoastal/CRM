/**
 * Flow runtime. Walks a FlowGraph step-by-step starting from the `start` node,
 * persisting trace entries on each step and pausing on `wait` nodes.
 *
 * Public surface:
 *   - evaluateAndStartFlows: called by trigger middleware after insert/update
 *   - startFlow: kicks off a single flow run for one record
 *   - resumeRun: continues a previously WAITING run (called by the poller)
 *   - runFlowDryRun: in-memory test runner that returns a trace without
 *     persisting anything (for the test panel in the editor)
 *
 * Behavior is fire-and-forget. Failures in a single node are caught, written
 * to trace, and the run is marked FAILED. They never bubble up to the trigger
 * that started the flow.
 */

import { prisma } from "@/lib/prisma";
import { sendQueuedEmail } from "@/lib/email-sender";
import { sendQueuedSms } from "@/lib/sms-sender";
import { normalizeSubject } from "@/lib/email/threading";
import { isEmailSuppressed } from "@/lib/email/suppression";
import { buildFromAddress, ownerFieldFor } from "./email-node";
import { evaluateCondition } from "./condition";
import { shouldReenter } from "./reentry";
import type {
  ConditionGroup,
  FlowEdge,
  FlowGraph,
  FlowNode,
  NodeKind,
} from "./nodes";

interface TraceEntry {
  nodeId: string;
  kind: NodeKind;
  at: string;
  status: "ok" | "error" | "skipped" | "waited";
  output?: unknown;
  error?: string;
}

type AnyRecord = Record<string, unknown>;

const MAX_STEPS = 100;

function nowIso(): string {
  return new Date().toISOString();
}

function getPath(obj: AnyRecord, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as AnyRecord)[p];
  }
  return cur;
}

/** Replace {{record.field.path}} or {{field}} tokens with values from the record. */
export function mergeFlowTemplate(input: string, record: AnyRecord): string {
  if (!input) return "";
  return input.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key: string) => {
    const stripped = key.startsWith("record.") ? key.slice("record.".length) : key;
    const v = getPath(record, stripped);
    return v == null ? "" : String(v);
  });
}

function nextEdge(graph: FlowGraph, fromNodeId: string, branch?: string): FlowEdge | null {
  const candidates = graph.edges.filter((e) => e.source === fromNodeId);
  if (candidates.length === 0) return null;
  if (branch) {
    const matched = candidates.find((e) => e.branch === branch);
    if (matched) return matched;
  }
  const unbranched = candidates.find((e) => !e.branch);
  return unbranched ?? candidates[0];
}

function findNode(graph: FlowGraph, id: string | null | undefined): FlowNode | null {
  if (!id) return null;
  return graph.nodes.find((n) => n.id === id) ?? null;
}

function startNode(graph: FlowGraph): FlowNode | null {
  return graph.nodes.find((n) => n.kind === "start") ?? null;
}

interface StepResult {
  ok: boolean;
  output?: unknown;
  error?: string;
  branch?: string;
  /** When set, the run pauses and resumes later. */
  waitUntil?: Date;
  /** When set, the run ends successfully (end node). */
  terminate?: boolean;
  /** Optional patches to merge into the in-memory record for downstream nodes. */
  recordPatch?: AnyRecord;
}

async function execStep(
  node: FlowNode,
  record: AnyRecord,
  ctx: { entityType: string; entityId: string; flowId: string; runId: string; dryRun: boolean },
): Promise<StepResult> {
  switch (node.kind) {
    case "start":
      return { ok: true };
    case "end":
      return { ok: true, terminate: true };
    case "decision": {
      const cond = (node.config?.condition as ConditionGroup | undefined) ?? null;
      const truthy = evaluateCondition(cond, record);
      return { ok: true, branch: truthy ? "true" : "false", output: { branch: truthy ? "true" : "false" } };
    }
    case "update_record": {
      const updates = (node.config?.updates as Array<{ field: string; value: string }> | undefined) ?? [];
      const data: AnyRecord = {};
      for (const u of updates) {
        if (!u.field) continue;
        data[u.field] = mergeFlowTemplate(String(u.value ?? ""), record);
      }
      if (Object.keys(data).length === 0) return { ok: true, output: { updates: 0 } };
      if (ctx.dryRun) return { ok: true, output: { dryRun: true, updates: data } };
      try {
        const model = ctx.entityType.toLowerCase();
        const delegate = (prisma as unknown as Record<string, { update: (a: { where: { id: string }; data: AnyRecord }) => Promise<unknown> }>)[model];
        if (!delegate?.update) return { ok: false, error: `Unknown model ${model}` };
        await delegate.update({ where: { id: ctx.entityId }, data });
        return { ok: true, output: { updates: data }, recordPatch: data };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "update failed" };
      }
    }
    case "create_task": {
      const subject = mergeFlowTemplate(String(node.config?.subject ?? "Follow up"), record);
      const assigneeUserId = (node.config?.assigneeUserId as string | undefined) || null;
      const offsetDays = Number(node.config?.dueDateOffset ?? 0);
      const due = new Date();
      due.setDate(due.getDate() + (Number.isFinite(offsetDays) ? offsetDays : 0));
      if (ctx.dryRun) {
        return { ok: true, output: { dryRun: true, subject, assigneeUserId, dueAt: due.toISOString() } };
      }
      try {
        const data: AnyRecord = {
          subject,
          type: "TASK",
          status: "OPEN",
          dueDate: due,
          ownerId: assigneeUserId,
        };
        if (ctx.entityType === "Lead") data.leadId = ctx.entityId;
        else if (ctx.entityType === "Opportunity") data.opportunityId = ctx.entityId;
        else if (ctx.entityType === "Account") data.accountId = ctx.entityId;
        else if (ctx.entityType === "Case") data.caseId = ctx.entityId;
        else if (ctx.entityType === "Contact") data.contactId = ctx.entityId;
        const task = await prisma.task.create({ data: data as never });
        return { ok: true, output: { taskId: (task as { id: string }).id } };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "task create failed" };
      }
    }
    case "send_email": {
      const templateId = (node.config?.templateId as string | undefined) || null;
      const subjectTpl = String(node.config?.subject ?? "");
      const bodyTpl = String(node.config?.body ?? "");
      const toFieldPath = String(node.config?.toFieldPath ?? "email");
      const fromMode = String(node.config?.fromMode ?? "owner");
      const toRaw = getPath(record, toFieldPath);
      const to = toRaw == null ? "" : String(toRaw);
      if (!to) return { ok: false, error: `No recipient at path "${toFieldPath}"` };

      // Suppressed recipients skip the send but the flow continues.
      if (!ctx.dryRun && (await isEmailSuppressed(to))) {
        return { ok: true, output: { skipped: "suppressed", to } };
      }

      // Resolve the sending identity: record owner's mailbox, else company default.
      const ownerField = ownerFieldFor(ctx.entityType);
      const ownerId = ownerField ? ((record[ownerField] as string | null | undefined) ?? null) : null;
      let fromAddress: string | null = null;
      if (fromMode === "owner" && ownerId) {
        const owner = await prisma.user.findUnique({
          where: { id: ownerId },
          select: { name: true, mailboxAddress: true, email: true },
        });
        fromAddress = buildFromAddress(owner);
      }
      if (!fromAddress) {
        fromAddress = process.env.EMAIL_FROM ?? "Coastal Debt <no-reply@coastaldebt.com>";
      }

      const subject = mergeFlowTemplate(subjectTpl, record);
      const body = mergeFlowTemplate(bodyTpl, record);
      if (ctx.dryRun) {
        return { ok: true, output: { dryRun: true, to, from: fromAddress, subject, templateId } };
      }
      try {
        const msgData: AnyRecord = {
          direction: "OUTBOUND",
          status: "QUEUED",
          fromAddress,
          toAddresses: to,
          subject: subject || "(no subject)",
          subjectNorm: normalizeSubject(subject || "(no subject)"),
          bodyHtml: body || null,
          bodyText: body || null,
          provider: "RESEND",
          templateId: templateId || null,
          ownerId,
          flowId: ctx.flowId,
          flowRunId: ctx.runId,
        };
        if (ctx.entityType === "Lead") msgData.leadId = ctx.entityId;
        else if (ctx.entityType === "Contact") msgData.contactId = ctx.entityId;
        else if (ctx.entityType === "Opportunity") msgData.opportunityId = ctx.entityId;
        else if (ctx.entityType === "Account") msgData.accountId = ctx.entityId;
        else if (ctx.entityType === "Case") msgData.caseId = ctx.entityId;
        const msg = await prisma.emailMessage.create({ data: msgData as never, select: { id: true } });
        // New sends anchor their own conversation thread.
        await prisma.emailMessage.update({ where: { id: msg.id }, data: { threadId: msg.id } });
        // Best-effort immediate send; queue drainer will retry on failure.
        void sendQueuedEmail(msg.id).catch(() => undefined);
        return { ok: true, output: { emailMessageId: msg.id, to, from: fromAddress } };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "email create failed" };
      }
    }
    case "send_sms": {
      const bodyTpl = String(node.config?.body ?? "");
      const toFieldPath = String(node.config?.toFieldPath ?? "phone");
      const toRaw = getPath(record, toFieldPath);
      const to = toRaw == null ? "" : String(toRaw);
      if (!to) return { ok: false, error: `No recipient at path "${toFieldPath}"` };
      const body = mergeFlowTemplate(bodyTpl, record);
      if (!body) return { ok: false, error: "SMS body is empty" };
      if (ctx.dryRun) return { ok: true, output: { dryRun: true, to, body } };
      try {
        const msgData: AnyRecord = {
          direction: "OUTBOUND",
          status: "QUEUED",
          toNumber: to,
          body,
          provider: "SMS_MAGIC",
        };
        if (ctx.entityType === "Lead") msgData.leadId = ctx.entityId;
        else if (ctx.entityType === "Opportunity") msgData.opportunityId = ctx.entityId;
        else if (ctx.entityType === "Account") msgData.accountId = ctx.entityId;
        else if (ctx.entityType === "Case") msgData.caseId = ctx.entityId;
        const msg = await prisma.smsMessage.create({ data: msgData as never });
        const id = (msg as { id: string }).id;
        void sendQueuedSms(id).catch(() => undefined);
        return { ok: true, output: { smsMessageId: id, to } };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "sms create failed" };
      }
    }
    case "wait": {
      const waitSeconds = Number(node.config?.waitSeconds ?? 0);
      const until = String(node.config?.until ?? "");
      let resumeAt: Date | null = null;
      if (until) {
        const d = new Date(until);
        if (!Number.isNaN(d.getTime())) resumeAt = d;
      }
      if (!resumeAt && waitSeconds > 0) {
        resumeAt = new Date(Date.now() + waitSeconds * 1000);
      }
      if (!resumeAt) return { ok: true, output: { skippedWait: true } };
      return { ok: true, waitUntil: resumeAt, output: { waitUntil: resumeAt.toISOString() } };
    }
    default:
      return { ok: false, error: `Unknown node kind: ${node.kind}` };
  }
}

interface WalkOptions {
  flowId: string;
  runId: string;
  entityType: string;
  entityId: string;
  dryRun: boolean;
}

async function walk(
  graph: FlowGraph,
  startId: string,
  record: AnyRecord,
  trace: TraceEntry[],
  opts: WalkOptions,
): Promise<{ status: "COMPLETED" | "FAILED" | "WAITING"; currentNodeId: string | null; scheduledResumeAt: Date | null; errorMessage: string | null }> {
  let currentId: string | null = startId;
  let steps = 0;
  while (currentId) {
    steps += 1;
    if (steps > MAX_STEPS) {
      trace.push({ nodeId: currentId, kind: "end", at: nowIso(), status: "error", error: "Exceeded MAX_STEPS" });
      return { status: "FAILED", currentNodeId: currentId, scheduledResumeAt: null, errorMessage: "Exceeded MAX_STEPS" };
    }
    const node = findNode(graph, currentId);
    if (!node) {
      const error = `Node ${currentId} not found`;
      trace.push({ nodeId: currentId, kind: "end", at: nowIso(), status: "error", error });
      return { status: "FAILED", currentNodeId: currentId, scheduledResumeAt: null, errorMessage: error };
    }
    let result: StepResult;
    try {
      result = await execStep(node, record, {
        entityType: opts.entityType,
        entityId: opts.entityId,
        flowId: opts.flowId,
        runId: opts.runId,
        dryRun: opts.dryRun,
      });
    } catch (e) {
      result = { ok: false, error: e instanceof Error ? e.message : "step crashed" };
    }
    const entry: TraceEntry = {
      nodeId: node.id,
      kind: node.kind,
      at: nowIso(),
      status: result.ok ? (result.waitUntil ? "waited" : "ok") : "error",
    };
    if (result.output !== undefined) entry.output = result.output;
    if (result.error) entry.error = result.error;
    trace.push(entry);

    if (!result.ok) {
      return { status: "FAILED", currentNodeId: node.id, scheduledResumeAt: null, errorMessage: result.error ?? "step failed" };
    }
    if (result.terminate) {
      return { status: "COMPLETED", currentNodeId: node.id, scheduledResumeAt: null, errorMessage: null };
    }
    if (result.waitUntil) {
      return { status: "WAITING", currentNodeId: node.id, scheduledResumeAt: result.waitUntil, errorMessage: null };
    }
    if (result.recordPatch) {
      Object.assign(record, result.recordPatch);
    }
    const edge = nextEdge(graph, node.id, result.branch);
    if (!edge) {
      // No outgoing edge: implicit end
      return { status: "COMPLETED", currentNodeId: node.id, scheduledResumeAt: null, errorMessage: null };
    }
    currentId = edge.target;
  }
  return { status: "COMPLETED", currentNodeId: null, scheduledResumeAt: null, errorMessage: null };
}

async function persistRunState(
  runId: string,
  trace: TraceEntry[],
  result: { status: string; currentNodeId: string | null; scheduledResumeAt: Date | null; errorMessage: string | null },
): Promise<void> {
  await prisma.flowRun.update({
    where: { id: runId },
    data: {
      status: result.status,
      currentNodeId: result.currentNodeId,
      scheduledResumeAt: result.scheduledResumeAt,
      trace: trace as unknown as object,
      errorMessage: result.errorMessage,
      finishedAt: result.status === "COMPLETED" || result.status === "FAILED" ? new Date() : null,
    },
  });
}

export async function startFlow(
  flowId: string,
  entityType: string,
  entityId: string,
  record: AnyRecord,
): Promise<{ runId: string }> {
  const flow = await prisma.flow.findUnique({ where: { id: flowId } });
  if (!flow) throw new Error(`Flow ${flowId} not found`);
  const graph = (flow.graph as unknown as FlowGraph) ?? { nodes: [], edges: [] };
  const start = startNode(graph);
  if (!start) throw new Error(`Flow ${flowId} has no start node`);
  const run = await prisma.flowRun.create({
    data: {
      flowId,
      entityType,
      entityId,
      status: "RUNNING",
      currentNodeId: start.id,
      trace: [] as unknown as object,
    },
  });
  const trace: TraceEntry[] = [];
  const result = await walk(graph, start.id, { ...record }, trace, {
    flowId,
    runId: run.id,
    entityType,
    entityId,
    dryRun: false,
  });
  await persistRunState(run.id, trace, result);
  return { runId: run.id };
}

export async function resumeRun(runId: string): Promise<void> {
  const run = await prisma.flowRun.findUnique({ where: { id: runId } });
  if (!run) return;
  if (run.status !== "WAITING") return;
  const flow = await prisma.flow.findUnique({ where: { id: run.flowId } });
  if (!flow) {
    await prisma.flowRun.update({
      where: { id: runId },
      data: { status: "FAILED", errorMessage: "Flow deleted", finishedAt: new Date() },
    });
    return;
  }
  const graph = (flow.graph as unknown as FlowGraph) ?? { nodes: [], edges: [] };
  const fromNode = findNode(graph, run.currentNodeId);
  if (!fromNode) {
    await prisma.flowRun.update({
      where: { id: runId },
      data: { status: "FAILED", errorMessage: "Wait node missing", finishedAt: new Date() },
    });
    return;
  }
  // Follow the next edge from the wait node, then resume the walk from there.
  const edge = nextEdge(graph, fromNode.id);
  if (!edge) {
    await prisma.flowRun.update({
      where: { id: runId },
      data: { status: "COMPLETED", finishedAt: new Date() },
    });
    return;
  }
  // Reload the entity to get a fresh record for downstream nodes.
  const model = run.entityType.toLowerCase();
  const delegate = (prisma as unknown as Record<string, { findUnique: (a: { where: { id: string } }) => Promise<unknown> }>)[model];
  const record = ((await delegate?.findUnique?.({ where: { id: run.entityId } })) ?? {}) as AnyRecord;
  const trace: TraceEntry[] = Array.isArray(run.trace) ? (run.trace as unknown as TraceEntry[]) : [];
  const result = await walk(graph, edge.target, { ...record }, trace, {
    flowId: flow.id,
    runId: run.id,
    entityType: run.entityType,
    entityId: run.entityId,
    dryRun: false,
  });
  await persistRunState(run.id, trace, result);
}

/** Dry run: returns the trace without persisting anything. Used by the editor test panel. */
export async function runFlowDryRun(
  graph: FlowGraph,
  entryCriteria: ConditionGroup | null | undefined,
  entityType: string,
  sampleRecord: AnyRecord,
): Promise<{ entered: boolean; trace: TraceEntry[]; result: string }> {
  const entered = evaluateCondition(entryCriteria ?? null, sampleRecord);
  if (!entered) {
    return { entered: false, trace: [], result: "Entry criteria not met" };
  }
  const start = startNode(graph);
  if (!start) return { entered: true, trace: [], result: "No start node" };
  const trace: TraceEntry[] = [];
  const r = await walk(graph, start.id, { ...sampleRecord }, trace, {
    flowId: "dry-run",
    runId: "dry-run",
    entityType,
    entityId: "dry-run",
    dryRun: true,
  });
  return { entered: true, trace, result: r.status };
}

/**
 * Called by trigger middleware after an insert or update. Loads all active
 * flows for the entityType + matching triggerEvent, evaluates entryCriteria
 * against the record, and starts a run for each matching flow.
 *
 * Fire-and-forget. Never throws.
 */
export async function evaluateAndStartFlows(
  entityType: string,
  event: "INSERT" | "UPDATE",
  record: AnyRecord,
  prev?: AnyRecord,
): Promise<void> {
  try {
    const flows = await prisma.flow.findMany({
      where: { entityType, isActive: true },
    });
    const entityId = String(record?.id ?? "");
    if (!entityId) return;
    for (const flow of flows) {
      const triggerEvent = String(flow.triggerEvent ?? "INSERT_OR_UPDATE");
      if (triggerEvent !== "INSERT_OR_UPDATE" && triggerEvent !== event) continue;

      // For UPDATE flows with a triggerOnFieldChanges list, gate on whether
      // any of the named fields actually changed.
      if (event === "UPDATE" && prev) {
        const changedFields = Array.isArray(flow.triggerOnFieldChanges)
          ? (flow.triggerOnFieldChanges as unknown[]).filter((s) => typeof s === "string") as string[]
          : [];
        if (changedFields.length > 0) {
          const anyChanged = changedFields.some((f) => (record as AnyRecord)[f] !== (prev as AnyRecord)[f]);
          if (!anyChanged) continue;
        }
      }

      const criteria = (flow.entryCriteria as unknown as ConditionGroup | null) ?? null;
      if (!evaluateCondition(criteria, record)) continue;

      if (flow.reentryPolicy !== "ALWAYS") {
        const lastRun = await prisma.flowRun.findFirst({
          where: { flowId: flow.id, entityId },
          orderBy: { startedAt: "desc" },
          select: { startedAt: true },
        });
        if (!shouldReenter(flow.reentryPolicy, flow.reentryCooldownDays, lastRun?.startedAt ?? null)) {
          continue;
        }
      }

      try {
        await startFlow(flow.id, entityType, entityId, record);
      } catch {
        // Already logged in trace; never bubble.
      }
    }
  } catch {
    // Trigger middleware must not crash because of flow runtime issues.
  }
}
