import { prisma } from "@/lib/prisma";
import type { Trigger, TriggerCtx } from "./types";
import { getTrigger } from "./registry";
import { evaluateAndStartFlows } from "@/lib/flow/executor";

/** Maps lowercase Prisma model name to canonical entity label used by Flow.entityType. */
const FLOW_ENTITY_LABEL: Record<string, string> = {
  lead: "Lead",
  opportunity: "Opportunity",
  account: "Account",
  case: "Case",
  task: "Task",
  event: "Event",
  contact: "Contact",
};

/**
 * Service wrapper that fires the SF-style triggers around a Prisma operation.
 * Use these helpers in API routes instead of calling prisma.<model>.update()
 * directly so triggers always run.
 *
 * Example:
 *   await triggerUpdate("lead", id, { status: "Working Lead" }, ctx);
 */

export function makeCtx(userId: string | null, skipKeys: string[] = []): TriggerCtx {
  return {
    prisma,
    userId,
    skip: new Set(skipKeys),
  };
}

type AnyDelegate = {
  findUnique: (args: { where: { id: string } }) => Promise<unknown>;
  create: (args: { data: unknown }) => Promise<unknown>;
  update: (args: { where: { id: string }; data: unknown }) => Promise<unknown>;
  delete: (args: { where: { id: string } }) => Promise<unknown>;
};

function delegateFor(model: string, ctx: TriggerCtx): AnyDelegate {
  const p = ctx.prisma as unknown as Record<string, AnyDelegate>;
  const d = p[model];
  if (!d) throw new Error(`Unknown Prisma model: ${model}`);
  return d;
}

export async function triggerCreate<TRow>(
  model: string,
  data: Record<string, unknown>,
  ctx: TriggerCtx
): Promise<TRow> {
  if (model === "case" && ctx.prisma === prisma) {
    const afterCommit: Array<() => Promise<void>> = [];
    const row = await prisma.$transaction(tx => triggerCreate<TRow>(model, data, { ...ctx, prisma: tx, afterCommit }));
    for (const effect of afterCommit) await effect();
    return row;
  }
  const trigger = getTrigger(model) as Trigger<TRow, Record<string, unknown>> | undefined;
  if (trigger?.beforeInsert) {
    await trigger.beforeInsert({ next: data, ctx });
  }
  let row = (await delegateFor(model, ctx).create({ data })) as TRow;
  if (trigger?.afterInsert) {
    await trigger.afterInsert({ row, ctx });
    if (model === "case") row = await delegateFor(model, ctx).findUnique({ where: { id: (row as { id: string }).id } }) as TRow;
  }
  // SF-style Flow Builder: fire matching INSERT / INSERT_OR_UPDATE flows.
  // Await dispatch; individual flow failures remain recorded by the executor.
  const entityLabel = FLOW_ENTITY_LABEL[model.toLowerCase()];
  if (entityLabel) {
    const dispatch = async () => { await evaluateAndStartFlows(entityLabel, "INSERT", row as unknown as Record<string, unknown>).catch(() => null); };
    if (ctx.afterCommit) ctx.afterCommit.push(dispatch); else await dispatch();
  }
  return row;
}

export async function triggerUpdate<TRow>(
  model: string,
  id: string,
  data: Record<string, unknown>,
  ctx: TriggerCtx,
  where: { id: string; [key: string]: unknown } = { id }
): Promise<TRow> {
  const trigger = getTrigger(model) as Trigger<TRow, Record<string, unknown>> | undefined;
  const delegate = delegateFor(model, ctx);
  const prev = (await delegate.findUnique({ where })) as TRow | null;
  if (!prev) throw new Error(`${model} ${id} not found`);

  if (trigger?.beforeUpdate) {
    await trigger.beforeUpdate({ next: data, prev, ctx });
  }
  const row = (await delegate.update({ where, data })) as TRow;
  if (trigger?.afterUpdate) {
    await trigger.afterUpdate({ row, prev, ctx });
  }
  // SF-style Flow Builder: fire matching UPDATE / INSERT_OR_UPDATE flows.
  const entityLabel = FLOW_ENTITY_LABEL[model.toLowerCase()];
  if (entityLabel) {
    const dispatch = async () => { await evaluateAndStartFlows(
      entityLabel,
      "UPDATE",
      row as unknown as Record<string, unknown>,
      prev as unknown as Record<string, unknown>,
    ).catch(() => null); };
    if (ctx.afterCommit) ctx.afterCommit.push(dispatch); else await dispatch();
  }
  return row;
}

export async function triggerDelete<TRow>(
  model: string,
  id: string,
  ctx: TriggerCtx
): Promise<TRow> {
  const trigger = getTrigger(model) as Trigger<TRow, Record<string, unknown>> | undefined;
  const delegate = delegateFor(model, ctx);
  const prev = (await delegate.findUnique({ where: { id } })) as TRow | null;
  if (!prev) throw new Error(`${model} ${id} not found`);
  const row = (await delegate.delete({ where: { id } })) as TRow;
  if (trigger?.afterDelete) {
    await trigger.afterDelete({ row, ctx });
  }
  return row;
}

/** Preserve caller projections and access scopes while dispatching hooks. */
export async function triggerCreateArgs<TRow>(model: string, args: {
  data: Record<string, unknown>; include?: Record<string, unknown>;
}, ctx: TriggerCtx): Promise<TRow> {
  const row = await triggerCreate<TRow>(model, args.data, ctx);
  if (!args.include) return row;
  const delegate = ctx.prisma as unknown as Record<string, { findUniqueOrThrow(args: unknown): Promise<TRow> }>;
  return delegate[model].findUniqueOrThrow({ where: { id: (row as { id: string }).id }, include: args.include });
}

export async function triggerUpdateArgs<TRow>(model: string, args: {
  where: { id: string; [key: string]: unknown }; data: Record<string, unknown>; include?: Record<string, unknown>;
}, ctx: TriggerCtx): Promise<TRow> {
  const delegate = ctx.prisma as unknown as Record<string, { findUniqueOrThrow(args: unknown): Promise<TRow> }>;
  // Check the complete caller scope, not just the ID.
  await delegate[model].findUniqueOrThrow({ where: args.where });
  const row = await triggerUpdate<TRow>(model, args.where.id, args.data, ctx, args.where);
  return args.include ? delegate[model].findUniqueOrThrow({ where: { id: args.where.id }, include: args.include }) : row;
}

/** Bulk edits must run per-record rules; return partial failures explicitly. */
export async function triggerUpdateMany(model: string, where: Record<string, unknown>, data: Record<string, unknown>, ctx: TriggerCtx) {
  const delegate = ctx.prisma as unknown as Record<string, { findMany(args: unknown): Promise<Array<{ id: string }>> }>;
  const rows = await delegate[model].findMany({ where, select: { id: true } });
  let count = 0;
  const failures: Array<{ id: string; error: string }> = [];
  for (const row of rows) {
    try { await triggerUpdate(model, row.id, { ...data }, ctx, { id: row.id, AND: [where] }); count++; }
    catch (error) { failures.push({ id: row.id, error: error instanceof Error ? error.message : "Update failed" }); }
  }
  return { count, failures };
}
