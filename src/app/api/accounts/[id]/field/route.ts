import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";
import { applyFieldUpdate, mergeSfData, FieldUpdateError } from "@/lib/field-update";
import { validateAccountPatch } from "@/lib/validation/account-validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Account.Edit");
  if ("response" in r) return r.response;
  const { session } = r;
  const { id } = await params;

  const existing = await prisma.account.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const body = (await request.json()) as Record<string, unknown>;
  const entries = Object.entries(body ?? {});
  if (entries.length !== 1) {
    return NextResponse.json({ error: "Provide exactly one field to update" }, { status: 400 });
  }
  const [fieldName, newValue] = entries[0];

  try {
    const result = applyFieldUpdate({
      entity: "account",
      fieldName,
      newValue,
      existingSfDataJson: existing.sfDataJson,
      existingRecord: existing as unknown as Record<string, unknown>,
    });

    const patch: Record<string, unknown> = {};
    if (result.typedColumn?.name === "stage") patch.stage = result.typedColumn.value;
    if (result.typedColumn?.name === "name") patch.name = result.typedColumn.value;
    if (result.typedColumn?.name === "email") patch.email = result.typedColumn.value;
    if (result.typedColumn?.name === "parentAccountId") patch.parentAccountId = result.typedColumn.value;
    if (Object.keys(patch).length > 0) {
      const vErrors = validateAccountPatch(
        {
          id: existing.id,
          stage: existing.stage,
          name: existing.name,
          email: existing.email,
          recordType: existing.recordType,
          parentAccountId: existing.parentAccountId,
        },
        patch as Parameters<typeof validateAccountPatch>[1],
      );
      if (vErrors.length > 0) {
        return NextResponse.json({ error: vErrors[0], errors: vErrors }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (result.typedColumn) updateData[result.typedColumn.name] = result.typedColumn.value;
    if (result.sfDataPatch) updateData.sfDataJson = mergeSfData(existing.sfDataJson, result.sfDataPatch);

    const updated = await prisma.account.update({ where: { id }, data: updateData });

    await prisma.accountHistory.create({
      data: {
        accountId: id,
        field: result.historyField,
        oldValue: result.oldDisplay,
        newValue: result.newDisplay,
        changedById: session.userId,
      },
    }).catch((err) => { console.error("[accounts/field] accountHistory write failed:", err); });

    await auditWrite({
      userId: session.userId,
      entity: "Account",
      entityId: id,
      action: "UPDATE",
      before: { [result.historyField]: result.oldDisplay },
      after: { [result.historyField]: result.newDisplay },
    }).catch((err) => { console.error("[accounts/field] auditWrite failed:", err); });

    return NextResponse.json({ ok: true, value: result.newDisplay, account: updated });
  } catch (e) {
    if (e instanceof FieldUpdateError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
