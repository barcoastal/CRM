import { recordScope } from "@/lib/record-access";
import { ssnSafeJson } from "@/lib/ssn-safe-json";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { updateAccountSchema } from "@/lib/validations/account";
import { auditWrite } from "@/lib/audit";
import { validateAccountPatch } from "@/lib/validation/account-validation";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Account.View");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const account = await prisma.account.findUnique({
    where: { id, AND: [await recordScope("account")] },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      contacts: { include: { contact: true } },
      opportunities: true,
      creditor: true,
      childAccounts: { select: { id: true, name: true, recordType: true } },
      parentAccount: { select: { id: true, name: true } },
    },
  });
  if (!account) return ssnSafeJson({ error: "Not found" }, { status: 404 });
  return ssnSafeJson(account);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Account.Edit");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const parsed = updateAccountSchema.safeParse(body);
  if (!parsed.success) {
    return ssnSafeJson({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const before = await prisma.account.findUnique({ where: { id, AND: [await recordScope("account")] } });
  if (!before) return ssnSafeJson({ error: "Not found" }, { status: 404 });

  // SF validation rules — reject patches that violate ported Account rules.
  const d = parsed.data as Record<string, unknown>;
  if (Object.hasOwn(d, "ownerId") && !await prisma.account.findFirst({ where: { id, AND: [await recordScope("account", false)] }, select: { id: true } })) return Response.json({ error: "Owner reassignment is not permitted." }, { status: 403 });
  const vErrors = validateAccountPatch(
    {
      id: before.id,
      stage: before.stage,
      name: before.name,
      email: before.email,
      recordType: before.recordType,
      parentAccountId: before.parentAccountId,
    },
    {
      stage: typeof d.stage === "string" ? d.stage : undefined,
      name: typeof d.name === "string" ? d.name : undefined,
      email: typeof d.email === "string" ? d.email : undefined,
      parentAccountId: typeof d.parentAccountId === "string" ? d.parentAccountId : undefined,
    },
  );
  if (vErrors.length > 0) {
    return ssnSafeJson({ error: vErrors[0], errors: vErrors }, { status: 400 });
  }

  const account = await prisma.account.update({ where: { id, AND: [await recordScope("account", !Object.hasOwn(d, "ownerId"))] }, data: parsed.data });
  await auditWrite({
    userId: r.session.userId,
    entity: "Account",
    entityId: id,
    action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: account as unknown as Record<string, unknown>,
  }).catch(() => null);
  return ssnSafeJson(account);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Account.Delete");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  // Soft-delete: flip isActive instead of dropping data.
  const before = await prisma.account.findUnique({ where: { id, AND: [await recordScope("account")] } });
  if (!before) return ssnSafeJson({ error: "Not found" }, { status: 404 });
  if (!before.isActive) return ssnSafeJson({ ok: true, alreadyInactive: true });

  await prisma.account.update({ where: { id, AND: [await recordScope("account")] }, data: { isActive: false } });
  await auditWrite({
    userId: r.session.userId,
    entity: "Account",
    entityId: id,
    action: "DELETE",
    before: { isActive: true },
    after: { isActive: false },
  }).catch(() => null);
  return ssnSafeJson({ ok: true });
}
