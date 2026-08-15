/**
 * Inactivity sweep. For every active Flow with triggerEvent=INACTIVITY, finds
 * records of the flow's entityType with no email/call/task activity in the
 * last `inactivityDays` days and starts runs (respecting entry criteria and
 * the flow's re-entry policy; ALWAYS is treated as COOLDOWN over the
 * inactivity window so a record cannot re-enter on every sweep).
 *
 *   POST /api/flow/sweep
 *   Headers: Authorization: Bearer ${FLOW_POLL_SECRET}
 *     (falls back to PROCESSOR_SYNC_SECRET, same contract as /api/flow/poll)
 *
 * Call daily (or hourly) from the same external cron that hits /api/flow/poll.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startFlow } from "@/lib/flow/executor";
import { evaluateCondition } from "@/lib/flow/condition";
import { shouldReenter } from "@/lib/flow/reentry";
import type { ConditionGroup } from "@/lib/flow/nodes";

function authorize(req: NextRequest): boolean {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  const primary = process.env.FLOW_POLL_SECRET;
  const fallback = process.env.PROCESSOR_SYNC_SECRET;
  if (!primary && !fallback) return false;
  if (primary && token === primary) return true;
  if (fallback && token === fallback) return true;
  return false;
}

const BATCH_PER_FLOW = 200;

/** Inactivity where-clause per entity: nothing on the activity relations since the cutoff. */
function inactivityWhere(entityType: string, cutoff: Date): Record<string, unknown> | null {
  const noneSince = { none: { createdAt: { gte: cutoff } } };
  switch (entityType) {
    case "Lead":
      return { createdAt: { lt: cutoff }, emails: noneSince, calls: noneSince, tasks: noneSince };
    case "Contact":
      return { createdAt: { lt: cutoff }, emails: noneSince, tasks: noneSince };
    case "Account":
      return { createdAt: { lt: cutoff }, emails: noneSince, tasks: noneSince };
    default:
      return null; // other entities not supported for inactivity
  }
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const flows = await prisma.flow.findMany({
    where: { isActive: true, triggerEvent: "INACTIVITY" },
  });
  const results: Array<{ flowId: string; started: number; scanned: number; skipped?: string }> = [];
  for (const flow of flows) {
    const days = flow.inactivityDays ?? 0;
    if (days <= 0) {
      results.push({ flowId: flow.id, started: 0, scanned: 0, skipped: "no inactivityDays" });
      continue;
    }
    const cutoff = new Date(Date.now() - days * 864e5);
    const where = inactivityWhere(flow.entityType, cutoff);
    if (!where) {
      results.push({ flowId: flow.id, started: 0, scanned: 0, skipped: `entity ${flow.entityType} unsupported` });
      continue;
    }
    const model = flow.entityType.toLowerCase();
    const delegate = (prisma as unknown as Record<string, { findMany: (a: object) => Promise<Array<Record<string, unknown>>> }>)[model];
    if (!delegate?.findMany) {
      results.push({ flowId: flow.id, started: 0, scanned: 0, skipped: "no delegate" });
      continue;
    }
    const candidates = await delegate.findMany({ where, take: BATCH_PER_FLOW });
    let started = 0;
    for (const record of candidates) {
      const entityId = String(record.id ?? "");
      if (!entityId) continue;
      const criteria = (flow.entryCriteria as unknown as ConditionGroup | null) ?? null;
      if (!evaluateCondition(criteria, record)) continue;
      const lastRun = await prisma.flowRun.findFirst({
        where: { flowId: flow.id, entityId },
        orderBy: { startedAt: "desc" },
        select: { startedAt: true },
      });
      // ALWAYS would refire on every sweep, so it is treated as a cooldown of
      // the inactivity window itself. ONCE / COOLDOWN follow the flow's policy.
      const policy = flow.reentryPolicy === "ALWAYS" ? "COOLDOWN" : flow.reentryPolicy;
      const cooldown = flow.reentryPolicy === "ALWAYS" ? days : flow.reentryCooldownDays;
      if (!shouldReenter(policy, cooldown, lastRun?.startedAt ?? null)) continue;
      try {
        await startFlow(flow.id, flow.entityType, entityId, record);
        started += 1;
      } catch {
        // Trace already records the failure; keep sweeping.
      }
    }
    results.push({ flowId: flow.id, started, scanned: candidates.length });
  }
  return NextResponse.json({ ok: true, flows: results.length, results });
}
