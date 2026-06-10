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

function delegateFor(model: string): AnyDelegate {
  const p = prisma as unknown as Record<string, AnyDelegate>;
  const d = p[model];
  if (!d) throw new Error(`Unknown Prisma model: ${model}`);
  return d;
}

export async function triggerCreate<TRow>(
  model: string,
  data: Record<string, unknown>,
  ctx: TriggerCtx
): Promise<TRow> {
  const trigger = getTrigger(model) as Trigger<TRow, Record<string, unknown>> | undefined;
  if (trigger?.beforeInsert) {
    await trigger.beforeInsert({ next: data, ctx });
  }
  const row = (await delegateFor(model).create({ data })) as TRow;
  if (trigger?.afterInsert) {
    await trigger.afterInsert({ row, ctx });
  }
  // SF-style Flow Builder: fire matching INSERT / INSERT_OR_UPDATE flows.
  // Fire-and-forget so flow runtime failures never block the create path.
  const entityLabel = FLOW_ENTITY_LABEL[model.toLowerCase()];
  if (entityLabel) {
    void evaluateAndStartFlows(entityLabel, "INSERT", row as unknown as Record<string, unknown>).catch(() => null);
  }
  return row;
}

export async function triggerUpdate<TRow>(
  model: string,
  id: string,
  data: Record<string, unknown>,
  ctx: TriggerCtx
): Promise<TRow> {
  const trigger = getTrigger(model) as Trigger<TRow, Record<string, unknown>> | undefined;
  const delegate = delegateFor(model);
  const prev = (await delegate.findUnique({ where: { id } })) as TRow | null;
  if (!prev) throw new Error(`${model} ${id} not found`);

  if (trigger?.beforeUpdate) {
    await trigger.beforeUpdate({ next: data, prev, ctx });
  }
  const row = (await delegate.update({ where: { id }, data })) as TRow;
  if (trigger?.afterUpdate) {
    await trigger.afterUpdate({ row, prev, ctx });
  }
  // SF-style Flow Builder: fire matching UPDATE / INSERT_OR_UPDATE flows.
  const entityLabel = FLOW_ENTITY_LABEL[model.toLowerCase()];
  if (entityLabel) {
    void evaluateAndStartFlows(
      entityLabel,
      "UPDATE",
      row as unknown as Record<string, unknown>,
      prev as unknown as Record<string, unknown>,
    ).catch(() => null);
  }
  return row;
}

export async function triggerDelete<TRow>(
  model: string,
  id: string,
  ctx: TriggerCtx
): Promise<TRow> {
  const trigger = getTrigger(model) as Trigger<TRow, Record<string, unknown>> | undefined;
  const delegate = delegateFor(model);
  const prev = (await delegate.findUnique({ where: { id } })) as TRow | null;
  if (!prev) throw new Error(`${model} ${id} not found`);
  const row = (await delegate.delete({ where: { id } })) as TRow;
  if (trigger?.afterDelete) {
    await trigger.afterDelete({ row, ctx });
  }
  return row;
}
