import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";
import { applyFieldUpdate, mergeSfData, FieldUpdateError } from "@/lib/field-update";
import { validateOppPatch } from "@/lib/validation/opp-validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Opportunity.Edit");
  if ("response" in r) return r.response;
  const { session } = r;
  const { id } = await params;

  const existing = await prisma.opportunity.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });

  const body = (await request.json()) as Record<string, unknown>;
  const entries = Object.entries(body ?? {});
  if (entries.length !== 1) {
    return NextResponse.json({ error: "Provide exactly one field to update" }, { status: 400 });
  }
  const [fieldName, newValue] = entries[0];

  try {
    const result = applyFieldUpdate({
      entity: "opportunity",
      fieldName,
      newValue,
      existingSfDataJson: existing.sfDataJson,
      existingRecord: existing as unknown as Record<string, unknown>,
    });

    // SF validation rules for inline single-field edits on Opportunity.
    const patch: Record<string, unknown> = {};
    if (result.typedColumn?.name === "stage") patch.stage = result.typedColumn.value;
    if (result.typedColumn?.name === "totalDebt") patch.totalDebt = result.typedColumn.value;
    if (result.typedColumn?.name === "expectedCloseDate") patch.expectedCloseDate = result.typedColumn.value as string | Date | null;
    if (fieldName === "Payment_Term__c") patch.Payment_Term__c = newValue == null ? null : String(newValue);
    if (Object.keys(patch).length > 0) {
      const vErrors = validateOppPatch(
        {
          id: existing.id,
          stage: existing.stage,
          accountId: existing.accountId,
          totalDebt: existing.totalDebt,
          expectedCloseDate: existing.expectedCloseDate,
        },
        patch as Parameters<typeof validateOppPatch>[1],
      );
      if (vErrors.length > 0) {
        return NextResponse.json({ error: vErrors[0], errors: vErrors }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (result.typedColumn) updateData[result.typedColumn.name] = result.typedColumn.value;
    if (result.sfDataPatch) updateData.sfDataJson = mergeSfData(existing.sfDataJson, result.sfDataPatch);

    const updated = await prisma.opportunity.update({ where: { id }, data: updateData });

    await prisma.opportunityHistory.create({
      data: {
        opportunityId: id,
        field: result.historyField,
        oldValue: result.oldDisplay,
        newValue: result.newDisplay,
        changedById: session.userId,
      },
    }).catch((err) => { console.error("[opportunities/field] opportunityHistory write failed:", err); });

    await auditWrite({
      userId: session.userId,
      entity: "Opportunity",
      entityId: id,
      action: "UPDATE",
      before: { [result.historyField]: result.oldDisplay },
      after: { [result.historyField]: result.newDisplay },
    }).catch((err) => { console.error("[opportunities/field] auditWrite failed:", err); });

    return NextResponse.json({ ok: true, value: result.newDisplay, opportunity: updated });
  } catch (e) {
    if (e instanceof FieldUpdateError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
