import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";
import { applyFieldUpdate, mergeSfData, FieldUpdateError } from "@/lib/field-update";
import { validateContactPatch } from "@/lib/validation/contact-validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Contact.Edit");
  if ("response" in r) return r.response;
  const { session } = r;
  const { id } = await params;

  const existing = await prisma.contact.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const body = (await request.json()) as Record<string, unknown>;
  const entries = Object.entries(body ?? {});
  if (entries.length !== 1) {
    return NextResponse.json({ error: "Provide exactly one field to update" }, { status: 400 });
  }
  const [fieldName, newValue] = entries[0];

  try {
    const result = applyFieldUpdate({
      entity: "contact",
      fieldName,
      newValue,
      existingSfDataJson: existing.sfDataJson,
      existingRecord: existing as unknown as Record<string, unknown>,
    });

    const patch: Record<string, unknown> = {};
    if (result.typedColumn?.name === "firstName") patch.firstName = result.typedColumn.value;
    if (result.typedColumn?.name === "lastName") patch.lastName = result.typedColumn.value;
    if (result.typedColumn?.name === "email") patch.email = result.typedColumn.value;
    if (result.typedColumn?.name === "phone") patch.phone = result.typedColumn.value;
    if (result.typedColumn?.name === "mobilePhone") patch.mobilePhone = result.typedColumn.value;
    if (result.typedColumn?.name === "primaryAccountId") patch.primaryAccountId = result.typedColumn.value;
    if (Object.keys(patch).length > 0) {
      const vErrors = validateContactPatch(
        {
          id: existing.id,
          firstName: existing.firstName,
          lastName: existing.lastName,
          email: existing.email,
          phone: existing.phone,
          mobilePhone: existing.mobilePhone,
          primaryAccountId: existing.primaryAccountId,
        },
        patch as Parameters<typeof validateContactPatch>[1],
      );
      if (vErrors.length > 0) {
        return NextResponse.json({ error: vErrors[0], errors: vErrors }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (result.typedColumn) updateData[result.typedColumn.name] = result.typedColumn.value;
    if (result.sfDataPatch) updateData.sfDataJson = mergeSfData(existing.sfDataJson, result.sfDataPatch);

    // Keep fullName in sync when firstName / lastName change.
    if (result.typedColumn?.name === "firstName" || result.typedColumn?.name === "lastName") {
      const first = result.typedColumn.name === "firstName" ? (result.typedColumn.value as string) : existing.firstName;
      const last = result.typedColumn.name === "lastName" ? (result.typedColumn.value as string) : existing.lastName;
      updateData.fullName = [first, last].filter(Boolean).join(" ").trim();
    }

    const updated = await prisma.contact.update({ where: { id }, data: updateData });

    await auditWrite({
      userId: session.userId,
      entity: "Contact",
      entityId: id,
      action: "UPDATE",
      before: { [result.historyField]: result.oldDisplay },
      after: { [result.historyField]: result.newDisplay },
    }).catch(() => { /* best-effort */ });

    return NextResponse.json({ ok: true, value: result.newDisplay, contact: updated });
  } catch (e) {
    if (e instanceof FieldUpdateError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
