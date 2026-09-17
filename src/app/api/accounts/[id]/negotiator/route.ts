import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuthOrRespond } from '@/lib/api-auth';
import { recordScope } from '@/lib/record-access';
import { hasPermission, loadEffectivePermissions } from '@/lib/permissions';

const bodySchema = z.object({ userId: z.string().min(1).max(128).nullable(), previousUserId: z.string().max(128).nullable() }).strict();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthOrRespond('Account.Edit');
  if ('response' in auth) return auth.response;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Select a valid negotiator.' }, { status: 400 });
  const { id } = await params;
  // Negotiator sharing never confers the right to reassign the account.
  const scope = await recordScope('account', false);
  const before = await prisma.account.findFirst({ where: { id, AND: [scope] }, select: { assignedNegotiatorId: true, assignedNegotiator: { select: { name: true } } } });
  if (!before) return Response.json({ error: 'Account not found or assignment is not permitted.' }, { status: 404 });
  const { userId, previousUserId } = parsed.data;
  if (before.assignedNegotiatorId !== previousUserId) return Response.json({ error: 'Assignment changed. Refresh the account and try again.' }, { status: 409 });
  const target = userId ? await prisma.user.findFirst({ where: { id: userId, isActive: true }, select: { id: true, name: true } }) : null;
  if (userId && !target) return Response.json({ error: 'Choose an active CRM user.' }, { status: 400 });
  if (userId) {
    const permissions = await loadEffectivePermissions(userId);
    if (!hasPermission(permissions, 'Account.View') || !hasPermission(permissions, 'Opportunity.View')) return Response.json({ error: 'This user needs Account.View and Opportunity.View permissions before assignment.' }, { status: 400 });
  }
  if (userId === previousUserId) return Response.json({ ok: true });
  const updated = await prisma.$transaction(async tx => {
    const result = await tx.account.updateMany({ where: { id, assignedNegotiatorId: previousUserId, AND: [scope] }, data: { assignedNegotiatorId: userId } });
    if (!result.count) return false;
    await tx.accountHistory.create({ data: { accountId: id, field: 'Debt Negotiator', oldValue: before.assignedNegotiator?.name ?? null, newValue: target?.name ?? null, changedById: auth.session.userId } });
    await tx.auditLog.create({ data: { userId: auth.session.userId, entity: 'Account', entityId: id, action: 'UPDATE', before: { assignedNegotiatorId: previousUserId }, after: { assignedNegotiatorId: userId } } });
    return true;
  });
  if (!updated) return Response.json({ error: 'Assignment changed. Refresh the account and try again.' }, { status: 409 });
  return Response.json({ ok: true });
}
