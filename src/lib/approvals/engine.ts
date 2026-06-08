// Approval Engine
// SF-style Approval Processes. Admins define processes per entity type; when a
// record matches the entry criteria, users can submit it for approval. The
// request routes through ordered steps; each step has one or more approvers
// (or uses the submitter's manager). Any approver advances; one rejection ends
// the request. Final-approval/rejection actions can mutate the record.

import { prisma } from "@/lib/prisma";

// Lower-case Prisma model accessors for each supported entity type. Used by
// findEligibleProcesses to load the record and by setField actions to update
// it. Keys correspond to the `entityType` strings on ApprovalProcess.
const ENTITY_MODELS: Record<string, string> = {
  Opportunity: "opportunity",
  Settlement: "settlement",
  Fee: "fee",
  Offer: "offer",
  Lead: "lead",
  Case: "case",
};

export interface CriteriaRule {
  field: string;
  operator: string;
  value: unknown;
}

export interface FinalAction {
  kind: string;
  field?: string;
  value?: unknown;
}

export type SubmitOpts = {
  processId: string;
  entityType: string;
  entityId: string;
  submitterUserId: string;
  comments?: string;
};

// ---------------------------------------------------------------------------
// Criteria evaluator (parity with Reports filter operators)
// ---------------------------------------------------------------------------

function readPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function evalRule(record: Record<string, unknown>, rule: CriteriaRule): boolean {
  const value = readPath(record, rule.field);
  const raw = rule.value;
  switch (rule.operator) {
    case "isNull":
      return value === null || value === undefined || value === "";
    case "isNotNull":
      return value !== null && value !== undefined && value !== "";
    case "equals":
      return String(value ?? "") === String(raw ?? "");
    case "not":
      return String(value ?? "") !== String(raw ?? "");
    case "contains":
      return String(value ?? "").toLowerCase().includes(String(raw ?? "").toLowerCase());
    case "startsWith":
      return String(value ?? "").toLowerCase().startsWith(String(raw ?? "").toLowerCase());
    case "endsWith":
      return String(value ?? "").toLowerCase().endsWith(String(raw ?? "").toLowerCase());
    case "gt":
      return Number(value) > Number(raw);
    case "gte":
      return Number(value) >= Number(raw);
    case "lt":
      return Number(value) < Number(raw);
    case "lte":
      return Number(value) <= Number(raw);
    case "in": {
      const arr = Array.isArray(raw)
        ? raw.map(String)
        : String(raw ?? "").split(",").map((s) => s.trim());
      return arr.includes(String(value ?? ""));
    }
    case "notIn": {
      const arr = Array.isArray(raw)
        ? raw.map(String)
        : String(raw ?? "").split(",").map((s) => s.trim());
      return !arr.includes(String(value ?? ""));
    }
    default:
      return false;
  }
}

function matchesAll(record: Record<string, unknown>, rules: CriteriaRule[]): boolean {
  if (!Array.isArray(rules) || rules.length === 0) return true;
  return rules.every((r) => evalRule(record, r));
}

function asRules(json: unknown): CriteriaRule[] {
  if (!Array.isArray(json)) return [];
  return json.filter(
    (r): r is CriteriaRule =>
      r !== null && typeof r === "object" && typeof (r as CriteriaRule).field === "string",
  );
}

function asActions(json: unknown): FinalAction[] {
  if (!Array.isArray(json)) return [];
  return json.filter(
    (a): a is FinalAction =>
      a !== null && typeof a === "object" && typeof (a as FinalAction).kind === "string",
  );
}

// ---------------------------------------------------------------------------
// Record loader
// ---------------------------------------------------------------------------

async function loadRecord(entityType: string, entityId: string): Promise<Record<string, unknown> | null> {
  const model = ENTITY_MODELS[entityType];
  if (!model) return null;
  // The Prisma client is typed per-model; we access by string key for dynamic dispatch.
  // The `findUnique` call shape is identical across models that have `id` PKs.
  // We swallow runtime errors so callers see "no record" rather than 500.
  try {
    const client = prisma as unknown as Record<string, { findUnique?: (args: { where: { id: string } }) => Promise<unknown> }>;
    const r = await client[model]?.findUnique?.({ where: { id: entityId } });
    return (r as Record<string, unknown>) ?? null;
  } catch {
    return null;
  }
}

async function updateRecord(entityType: string, entityId: string, data: Record<string, unknown>): Promise<void> {
  const model = ENTITY_MODELS[entityType];
  if (!model) return;
  try {
    const client = prisma as unknown as Record<string, { update?: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown> }>;
    await client[model]?.update?.({ where: { id: entityId }, data });
  } catch {
    // Swallow: invalid field on dynamic update should not break approval flow.
  }
}

// ---------------------------------------------------------------------------
// Eligible processes
// ---------------------------------------------------------------------------

export async function findEligibleProcesses(entityType: string, entityId: string) {
  if (!ENTITY_MODELS[entityType]) return [];
  const processes = await prisma.approvalProcess.findMany({
    where: { entityType, isActive: true },
    include: { steps: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  const record = await loadRecord(entityType, entityId);
  if (!record) return [];
  return processes.filter((p) => matchesAll(record, asRules(p.entryCriteria as unknown)));
}

// ---------------------------------------------------------------------------
// Submitter manager helper
// ---------------------------------------------------------------------------

async function managerOf(userId: string): Promise<string | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { managerId: true } });
  return u?.managerId ?? null;
}

// ---------------------------------------------------------------------------
// Submit, approve, reject, recall
// ---------------------------------------------------------------------------

export async function submitForApproval(o: SubmitOpts): Promise<{ requestId: string }> {
  const process = await prisma.approvalProcess.findUnique({
    where: { id: o.processId },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  if (!process) throw new Error("Process not found");
  if (!process.isActive) throw new Error("Process is inactive");
  if (process.entityType !== o.entityType) throw new Error("Entity type mismatch");

  // Re-check entry criteria at submission time.
  const record = await loadRecord(o.entityType, o.entityId);
  if (!record) throw new Error("Record not found");
  if (!matchesAll(record, asRules(process.entryCriteria as unknown))) {
    throw new Error("Record no longer matches entry criteria");
  }

  // Initial submitter check. Empty list => anyone can submit.
  const submitters = Array.isArray(process.initialSubmitters)
    ? (process.initialSubmitters as unknown[]).map(String)
    : [];
  if (submitters.length > 0 && !submitters.includes(o.submitterUserId)) {
    throw new Error("You are not an allowed submitter for this process");
  }

  // Block duplicate pending request for the same entity.
  const existing = await prisma.approvalRequest.findFirst({
    where: { entityType: o.entityType, entityId: o.entityId, status: "PENDING" },
  });
  if (existing) throw new Error("A pending approval request already exists for this record");

  const firstStep = process.steps[0];
  if (!firstStep) throw new Error("Process has no steps");

  const request = await prisma.approvalRequest.create({
    data: {
      processId: process.id,
      entityType: o.entityType,
      entityId: o.entityId,
      submittedById: o.submitterUserId,
      status: "PENDING",
      currentStepId: firstStep.id,
      comments: o.comments ?? null,
      snapshot: record as never,
    },
  });

  await prisma.approvalAction.create({
    data: {
      requestId: request.id,
      stepId: firstStep.id,
      actorId: o.submitterUserId,
      kind: "SUBMITTED",
      comments: o.comments ?? null,
    },
  });

  return { requestId: request.id };
}

async function isActorAuthorizedForStep(
  step: { approverUserIds: string[]; useSubmitterManager: boolean },
  submitterId: string | null,
  actorId: string,
): Promise<boolean> {
  if (step.useSubmitterManager) {
    if (!submitterId) return false;
    const mgr = await managerOf(submitterId);
    return mgr === actorId;
  }
  return step.approverUserIds.includes(actorId);
}

async function runActions(
  entityType: string,
  entityId: string,
  actions: FinalAction[],
): Promise<void> {
  const updates: Record<string, unknown> = {};
  for (const a of actions) {
    if (a.kind === "setField" && typeof a.field === "string") {
      updates[a.field] = a.value;
    }
  }
  if (Object.keys(updates).length > 0) {
    await updateRecord(entityType, entityId, updates);
  }
}

export async function approveStep(o: {
  requestId: string;
  actorUserId: string;
  comments?: string;
}): Promise<{ status: string }> {
  const request = await prisma.approvalRequest.findUnique({
    where: { id: o.requestId },
    include: {
      process: { include: { steps: { orderBy: { order: "asc" } } } },
      currentStep: true,
    },
  });
  if (!request) throw new Error("Request not found");
  if (request.status !== "PENDING") throw new Error("Request is not pending");
  if (!request.currentStep) throw new Error("Request has no current step");

  const ok = await isActorAuthorizedForStep(
    {
      approverUserIds: request.currentStep.approverUserIds,
      useSubmitterManager: request.currentStep.useSubmitterManager,
    },
    request.submittedById,
    o.actorUserId,
  );
  if (!ok) throw new Error("You are not an approver for the current step");

  await prisma.approvalAction.create({
    data: {
      requestId: request.id,
      stepId: request.currentStep.id,
      actorId: o.actorUserId,
      kind: "APPROVED",
      comments: o.comments ?? null,
    },
  });

  // Advance: find next step by order strictly greater than current.
  const steps = request.process.steps;
  const idx = steps.findIndex((s) => s.id === request.currentStep!.id);
  const next = idx >= 0 ? steps[idx + 1] : null;

  if (next) {
    await prisma.approvalRequest.update({
      where: { id: request.id },
      data: { currentStepId: next.id },
    });
    return { status: "PENDING" };
  }

  // No more steps: run final approval actions and mark APPROVED.
  await runActions(
    request.entityType,
    request.entityId,
    asActions(request.process.finalApprovalActions as unknown),
  );

  await prisma.approvalRequest.update({
    where: { id: request.id },
    data: { status: "APPROVED", currentStepId: null, decidedAt: new Date() },
  });

  return { status: "APPROVED" };
}

export async function rejectRequest(o: {
  requestId: string;
  actorUserId: string;
  comments: string;
}): Promise<{ status: string }> {
  const request = await prisma.approvalRequest.findUnique({
    where: { id: o.requestId },
    include: { process: true, currentStep: true },
  });
  if (!request) throw new Error("Request not found");
  if (request.status !== "PENDING") throw new Error("Request is not pending");
  if (!request.currentStep) throw new Error("Request has no current step");

  const ok = await isActorAuthorizedForStep(
    {
      approverUserIds: request.currentStep.approverUserIds,
      useSubmitterManager: request.currentStep.useSubmitterManager,
    },
    request.submittedById,
    o.actorUserId,
  );
  if (!ok) throw new Error("You are not an approver for the current step");

  await prisma.approvalAction.create({
    data: {
      requestId: request.id,
      stepId: request.currentStep.id,
      actorId: o.actorUserId,
      kind: "REJECTED",
      comments: o.comments,
    },
  });

  await runActions(
    request.entityType,
    request.entityId,
    asActions(request.process.rejectionActions as unknown),
  );

  await prisma.approvalRequest.update({
    where: { id: request.id },
    data: { status: "REJECTED", currentStepId: null, decidedAt: new Date() },
  });

  return { status: "REJECTED" };
}

export async function recallRequest(o: {
  requestId: string;
  actorUserId: string;
}): Promise<{ status: string }> {
  const request = await prisma.approvalRequest.findUnique({
    where: { id: o.requestId },
  });
  if (!request) throw new Error("Request not found");
  if (request.status !== "PENDING") throw new Error("Request is not pending");
  if (request.submittedById !== o.actorUserId) {
    throw new Error("Only the submitter can recall a request");
  }

  await prisma.approvalAction.create({
    data: {
      requestId: request.id,
      stepId: request.currentStepId,
      actorId: o.actorUserId,
      kind: "RECALLED",
    },
  });

  await prisma.approvalRequest.update({
    where: { id: request.id },
    data: { status: "RECALLED", currentStepId: null, decidedAt: new Date() },
  });

  return { status: "RECALLED" };
}

// ---------------------------------------------------------------------------
// Inbox helpers (used by the Approvals landing page).
// "current approver" = user appears in currentStep.approverUserIds, or is the
// submitter's manager when the step is manager-based.
// ---------------------------------------------------------------------------

export async function listMyPendingApprovals(userId: string) {
  // Pull all pending requests and filter by step membership. We also need to
  // resolve manager-based steps by checking the submitter's manager.
  const requests = await prisma.approvalRequest.findMany({
    where: { status: "PENDING" },
    include: {
      process: { select: { id: true, name: true, entityType: true } },
      currentStep: true,
      submittedBy: { select: { id: true, name: true, managerId: true } },
    },
    orderBy: { submittedAt: "desc" },
  });

  return requests.filter((r) => {
    if (!r.currentStep) return false;
    if (r.currentStep.useSubmitterManager) {
      return r.submittedBy?.managerId === userId;
    }
    return r.currentStep.approverUserIds.includes(userId);
  });
}

export async function listMySubmittedApprovals(userId: string) {
  return prisma.approvalRequest.findMany({
    where: { submittedById: userId },
    include: {
      process: { select: { id: true, name: true, entityType: true } },
      currentStep: { select: { id: true, name: true } },
    },
    orderBy: { submittedAt: "desc" },
    take: 100,
  });
}

export const APPROVAL_ENTITY_TYPES = Object.keys(ENTITY_MODELS);
