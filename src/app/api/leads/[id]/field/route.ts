import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";
import { applyFieldUpdate, mergeSfData, FieldUpdateError } from "@/lib/field-update";
import { validateLeadPatch } from "@/lib/validation/lead-validation";

/**
 * Inline-edit endpoint used by the SF-style InlineEditableField component.
 * Accepts a single-field PATCH body: { fieldName: newValue }.
 *
 * For a typed Prisma column we coerce + update directly and optionally mirror
 * the value into sfDataJson. For an SF-only key (PascalCase or *__c) we merge
 * the new value into sfDataJson without touching typed columns.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Lead.Edit");
  if ("response" in r) return r.response;
  const { session } = r;
  const { id } = await params;

  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const body = (await request.json()) as Record<string, unknown>;
  const entries = Object.entries(body ?? {});
  if (entries.length !== 1) {
    return NextResponse.json({ error: "Provide exactly one field to update" }, { status: 400 });
  }
  const [fieldName, newValue] = entries[0];

  try {
    const result = applyFieldUpdate({
      entity: "lead",
      fieldName,
      newValue,
      existingSfDataJson: existing.sfDataJson,
      existingRecord: existing as unknown as Record<string, unknown>,
    });

    // SF validation rules for inline single-field edits.
    const patch: Record<string, unknown> = {};
    if (result.typedColumn?.name === "status") patch.status = result.typedColumn.value;
    if (result.typedColumn?.name === "email") patch.email = result.typedColumn.value;
    if (result.typedColumn?.name === "phone") patch.phone = result.typedColumn.value;
    if (result.typedColumn?.name === "contactName") patch.contactName = result.typedColumn.value;
    if (result.typedColumn?.name === "businessName") patch.businessName = result.typedColumn.value;
    if (fieldName === "Sub_Disposition__c") patch.Sub_Disposition__c = newValue ?? null;
    if (Object.keys(patch).length > 0) {
      const vErrors = validateLeadPatch(
        {
          id: existing.id,
          status: existing.status,
          email: existing.email,
          phone: existing.phone,
          contactName: existing.contactName,
          businessName: existing.businessName,
        },
        patch as Parameters<typeof validateLeadPatch>[1],
      );
      if (vErrors.length > 0) {
        return NextResponse.json({ error: vErrors[0], errors: vErrors }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (result.typedColumn) updateData[result.typedColumn.name] = result.typedColumn.value;
    if (result.sfDataPatch) updateData.sfDataJson = mergeSfData(existing.sfDataJson, result.sfDataPatch);

    const updated = await prisma.lead.update({ where: { id }, data: updateData });

    // Field-level history row + audit log entry for the change.
    await prisma.leadHistory.create({
      data: {
        leadId: id,
        field: result.historyField,
        oldValue: result.oldDisplay,
        newValue: result.newDisplay,
        changedById: session.userId,
      },
    }).catch(() => { /* best-effort */ });

    await auditWrite({
      userId: session.userId,
      entity: "Lead",
      entityId: id,
      action: "UPDATE",
      before: { [result.historyField]: result.oldDisplay },
      after: { [result.historyField]: result.newDisplay },
    }).catch(() => { /* best-effort */ });

    return NextResponse.json({ ok: true, value: result.newDisplay, lead: updated });
  } catch (e) {
    if (e instanceof FieldUpdateError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
