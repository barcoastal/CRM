import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { teamOwnerIds } from "@/lib/record-access";
export const runtimeFiltersSchema = z.object({
  from: z.string().date().optional(), to: z.string().date().optional(), ownerId: z.string().min(1).max(100).optional(), includeTeam: z.boolean().optional(),
}).refine(v => !v.from || !v.to || v.from <= v.to, "Start date must precede end date");
export type RuntimeFilters = z.infer<typeof runtimeFiltersSchema>;
export async function runtimeWhere(model: string, filters: RuntimeFilters = {}): Promise<Record<string, unknown>> {
  const parsed = runtimeFiltersSchema.parse(filters);
  const clauses: Record<string, unknown>[] = [];
  const dateField = model === "opportunitySnapshot" ? "capturedAt" : model === "opportunityHistory" ? "changedAt" : "createdAt";
  if (parsed.from || parsed.to) clauses.push({ [dateField]: { ...(parsed.from ? { gte: new Date(parsed.from) } : {}), ...(parsed.to ? { lt: new Date(new Date(parsed.to).getTime() + 86400000) } : {}) } });
  if (parsed.ownerId) {
    const ids = parsed.includeTeam ? teamOwnerIds(parsed.ownerId, await prisma.user.findMany({ select: { id: true, managerId: true } })) : [parsed.ownerId];
    const paths: Record<string, string> = { lead: "assignedToId", opportunity: "assignedToId", account: "ownerId", case: "ownerId", task: "ownerId", event: "ownerId", envelope: "createdById", debt: "opportunity.assignedToId", payment: "client.opportunity.assignedToId", opportunitySnapshot: "assignedToId", opportunityHistory: "opportunity.assignedToId" };
    const path = paths[model];
    if (!path) throw new Error("Owner filtering is unavailable for this report type");
    let condition: Record<string, unknown> = { in: ids };
    for (const key of path.split(".").reverse()) condition = { [key]: condition };
    clauses.push(condition);
  }
  return { AND: clauses };
}
