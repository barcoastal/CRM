import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessRecord } from "@/lib/record-access";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { hasPermission } from "@/lib/permissions";
import {
  amendmentInclude,
  amendmentSchema,
  amendmentView,
  applyOpportunityAmendment,
} from "@/lib/opportunity-amendment";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const r = await requireAuthOrRespond("Opportunity.Edit");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  if (!(await canAccessRecord("opportunity", id)))
    return Response.json({ error: "Not found" }, { status: 404 });
  const opp = await prisma.opportunity.findUnique({
    where: { id },
    include: amendmentInclude,
  });
  if (!opp) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({
    ...amendmentView(opp),
    canEditPayments: hasPermission(r.session.permissions, "Draft.Retry"),
    hasActivePlan: opp.programPlans.length > 0,
  });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const r = await requireAuthOrRespond("Opportunity.Edit");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  if (!(await canAccessRecord("opportunity", id)))
    return Response.json({ error: "Not found" }, { status: 404 });
  const parsed = amendmentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid amendment" },
      { status: 400 },
    );
  try {
    const result = await prisma.$transaction(
      (tx) =>
        applyOpportunityAmendment(
          tx,
          id,
          parsed.data,
          r.session.userId,
          hasPermission(r.session.permissions, "Draft.Retry"),
        ),
      { isolationLevel: "Serializable", timeout: 20000 },
    );
    if (result.changedPlanIds.length) {
      const { drainProcessorQueues } =
        await import("@/lib/payment-processors/outbound");
      await Promise.all(
        result.changedPlanIds.map((programPlanId) =>
          drainProcessorQueues({ programPlanId }),
        ),
      );
    }
    return Response.json({ ok: true, version: result.version });
  } catch (e) {
    const message =
      (e as { code?: string }).code === "P2034"
        ? "The opportunity changed. Reopen the amendment before saving."
        : e instanceof Error
          ? e.message
          : "Could not save amendment";
    return Response.json({ error: message }, { status: 409 });
  }
}
