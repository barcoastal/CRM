import { withAutomationErrors } from "@/lib/automation/errors";
import { triggerUpdateArgs, makeCtx } from "@/lib/triggers/runner";
import type { Opportunity } from "@/generated/prisma/client";
import { recordScope } from "@/lib/record-access";
import { ssnSafeJson } from "@/lib/ssn-safe-json";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { updateOpportunitySchema } from "@/lib/validations/opportunity";
import { validateOppPatch } from "@/lib/validation/opp-validation";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireAuthOrRespond("Opportunity.View");
  if ("response" in access) return access.response;

  const { id } = await params;

  const opportunity = await prisma.opportunity.findUnique({
    where: { id, AND: [await recordScope("opportunity")] },
    include: {
      lead: {
        select: {
          id: true,
          businessName: true,
          contactName: true,
          phone: true,
          email: true,
          ein: true,
          industry: true,
          annualRevenue: true,
          totalDebtEst: true,
          source: true,
          status: true,
          score: true,
          notes: true,
          createdAt: true,
        },
      },
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
      client: {
        select: { id: true },
      },
    },
  });

  if (!opportunity) {
    return ssnSafeJson({ error: "Opportunity not found" }, { status: 404 });
  }

  return ssnSafeJson({
    ...opportunity,
    expectedCloseDate: opportunity.expectedCloseDate?.toISOString() ?? null,
    createdAt: opportunity.createdAt.toISOString(),
    updatedAt: opportunity.updatedAt.toISOString(),
    lead: opportunity.lead
      ? { ...opportunity.lead, createdAt: opportunity.lead.createdAt.toISOString() }
      : null,
  });
}

async function handlePATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireAuthOrRespond("Opportunity.Edit");
  if ("response" in access) return access.response;

  const { id } = await params;

  const existing = await prisma.opportunity.findUnique({ where: { id, AND: [await recordScope("opportunity")] } });
  if (!existing) {
    return ssnSafeJson({ error: "Opportunity not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateOpportunitySchema.safeParse(body);

  if (!parsed.success) {
    return ssnSafeJson(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // SF validation rules — reject patches that violate ported Opp rules.
  const vErrors = validateOppPatch(
    {
      id: existing.id,
      stage: existing.stage,
      accountId: existing.accountId,
      totalDebt: existing.totalDebt,
      expectedCloseDate: existing.expectedCloseDate,
    },
    {
      stage: typeof data.stage === "string" ? data.stage : undefined,
      totalDebt: typeof data.totalDebt === "number" ? data.totalDebt : (data.totalDebt === null ? null : undefined),
      expectedCloseDate: typeof data.expectedCloseDate === "string" ? data.expectedCloseDate : undefined,
    },
  );
  if (vErrors.length > 0) {
    return ssnSafeJson({ error: vErrors[0], errors: vErrors }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};

  if (data.stage !== undefined) updateData.stage = data.stage;
  if (data.totalDebt !== undefined) {
    updateData.totalDebt = typeof data.totalDebt === "number" ? data.totalDebt : null;
  }
  if (data.expectedCloseDate !== undefined) {
    updateData.expectedCloseDate = data.expectedCloseDate ? new Date(data.expectedCloseDate) : null;
  }
  if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId || null;
  if (data.notes !== undefined) updateData.notes = data.notes || null;

  const opportunity = await triggerUpdateArgs<Opportunity>("opportunity", {
    where: { id, AND: [await recordScope("opportunity")] },
    data: updateData,
    include: {
      lead: {
        select: {
          id: true,
          businessName: true,
          contactName: true,
          phone: true,
          email: true,
          totalDebtEst: true,
        },
      },
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
    },
  }, makeCtx(access.session.userId));

  return ssnSafeJson({
    ...opportunity,
    expectedCloseDate: opportunity.expectedCloseDate?.toISOString() ?? null,
    createdAt: opportunity.createdAt.toISOString(),
    updatedAt: opportunity.updatedAt.toISOString(),
  });
}

async function handleDELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireAuthOrRespond("Opportunity.Delete");
  if ("response" in access) return access.response;

  const { id } = await params;

  const existing = await prisma.opportunity.findUnique({ where: { id, AND: [await recordScope("opportunity")] } });
  if (!existing) {
    return ssnSafeJson({ error: "Opportunity not found" }, { status: 404 });
  }

  const opportunity = await triggerUpdateArgs<Opportunity>("opportunity", {
    where: { id, AND: [await recordScope("opportunity")] },
    data: { stage: "CLOSED" },
  }, makeCtx(access.session.userId));

  return ssnSafeJson({
    ...opportunity,
    expectedCloseDate: opportunity.expectedCloseDate?.toISOString() ?? null,
    createdAt: opportunity.createdAt.toISOString(),
    updatedAt: opportunity.updatedAt.toISOString(),
  });
}

export const PATCH = withAutomationErrors(handlePATCH);

export const DELETE = withAutomationErrors(handleDELETE);
