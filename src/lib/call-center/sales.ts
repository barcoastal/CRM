import { randomUUID } from "node:crypto";
import {
  qualificationSchema,
  readQualifiedDebts,
  debtTotal,
  APPROVAL_STAGES,
  type QualifiedDebt,
} from "./qualification";
import { canSupervise } from "./model";
import { teamOwnerIds } from "@/lib/record-access";
import { callingAccess } from "./access";
import { prisma } from "@/lib/prisma";
import type { AuthedSession } from "@/lib/api-auth";
import type { Prisma } from "@/generated/prisma/client";
import { DEFAULT_TIER_CONFIG, tierForDebt } from "@/lib/closer-tier-config";
import { hasPermission, loadEffectivePermissions } from "@/lib/permissions";
import {
  freshSince,
  ownedCall,
  transfer,
  superviseScope,
  VoiceError,
} from "./service";

export const isCloser = (user: {
  isCloser: boolean;
  closerTier: number | null;
}) => user.isCloser || typeof user.closerTier === "number";
export async function debtRouting(
  tx: Pick<Prisma.TransactionClient, "closerTierConfig"> = prisma,
) {
  return (
    (await tx.closerTierConfig.findUnique({ where: { id: "singleton" } })) ||
    DEFAULT_TIER_CONFIG
  );
}
export async function setCloserOpen(session: AuthedSession, open: boolean) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { isCloser: true, closerTier: true },
  });
  if (!isCloser(user) || !user.closerTier)
    throw new VoiceError(
      "Assign this user a closer tier before opening for transfers.",
      403,
    );
  const changed = await prisma.voiceAgent.updateMany({
    where: {
      userId: session.userId,
      ...(open
        ? { heartbeatAt: { gte: freshSince() }, status: { not: "OFFLINE" } }
        : {}),
    },
    data: { closerOpen: open },
  });
  if (!changed.count) throw new VoiceError("Connect your CRM phone first.");
  if (!open) {
    const waiting = await prisma.voiceCall.findMany({
      where: {
        transferTargetId: session.userId,
        salesStage: "CLOSER_READY",
        status: "IN_PROGRESS",
      },
      select: { id: true },
    });
    for (const request of waiting)
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "VoiceCall" WHERE id=${request.id} FOR UPDATE`;
        const call = await tx.voiceCall.findUniqueOrThrow({
          where: { id: request.id },
        });
        if (
          call.salesStage !== "CLOSER_READY" ||
          call.transferTargetId !== session.userId
        )
          return;
        await tx.voiceAgent.updateMany({
          where: {
            userId: session.userId,
            activeCallId: call.id,
            status: "RESERVED",
          },
          data: { activeCallId: null, status: "PAUSED" },
        });
        await tx.voiceCall.update({
          where: { id: call.id },
          data: { salesStage: "PENDING_CLOSER", transferReadyAt: null },
        });
      });
  }
  await prisma.voiceAgent.updateMany({
    where: { userId: session.userId, activeCallId: null },
    data: { status: open ? "AVAILABLE" : "PAUSED" },
  });
}
export async function qualifyCall(session: AuthedSession, raw: unknown) {
  const parsed = qualificationSchema.safeParse(raw);
  if (!parsed.success)
    throw new VoiceError(
      "Enter each lender, its debt amount, and qualification notes.",
    );
  const input = parsed.data;
  const call = await ownedCall(session, input.id);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { isCloser: true, closerTier: true },
  });
  if (isCloser(user))
    throw new VoiceError("Qualification belongs to the opener workspace.", 403);
  if (call.status !== "IN_PROGRESS" || !call.leadId)
    throw new VoiceError("Qualify a connected call linked to a CRM lead.");
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "VoiceCall" WHERE id=${input.id} FOR UPDATE`;
    const current = await tx.voiceCall.findUniqueOrThrow({
      where: { id: input.id },
    });
    if (
      current.agentId !== session.userId ||
      current.status !== "IN_PROGRESS" ||
      APPROVAL_STAGES.includes(current.salesStage) ||
      current.closerHandoffId
    )
      throw new VoiceError(
        "Cancel the pending handoff before changing qualification.",
        409,
      );
    const previous = readQualifiedDebts(current.qualifiedDebts);
    const rows: (QualifiedDebt & { id: string })[] = [];
    for (const row of input.debts) {
      const id = row.id || previous.find((saved) => saved.key === row.key)?.id;
      if (id) {
        const existing = await tx.leadDebt.findFirst({
          where: { id, leadId: call.leadId! },
        });
        if (
          !existing ||
          !["ACTIVE", "DEFAULTED", "DISPUTED"].includes(existing.status)
        )
          throw new VoiceError(
            "A lender record changed. Refresh the lead before saving.",
            409,
          );
        await tx.leadDebt.update({
          where: { id },
          data: {
            creditorName: row.creditorName,
            amount: Math.round(row.amount * 100) / 100,
          },
        });
        rows.push({ ...row, id, amount: Math.round(row.amount * 100) / 100 });
      } else {
        const added = await tx.leadDebt.create({
          data: {
            leadId: call.leadId!,
            creditorName: row.creditorName,
            amount: Math.round(row.amount * 100) / 100,
            type: "OTHER",
            frequency: "LUMP_SUM",
            createdById: session.userId,
          },
        });
        rows.push({ ...row, id: added.id, amount: added.amount });
      }
    }
    if (new Set(rows.map((row) => row.id)).size !== rows.length)
      throw new VoiceError("Duplicate lender records.");
    const removed = [
      ...new Set([
        ...input.removedDebtIds,
        ...previous
          .filter((row) => !rows.some((next) => next.id === row.id))
          .flatMap((row) => (row.id ? [row.id] : [])),
      ]),
    ];
    if (removed.some((id) => rows.some((row) => row.id === id)))
      throw new VoiceError("Conflicting lender changes.");
    if (removed.length) {
      const owned = await tx.leadDebt.count({
        where: { id: { in: removed }, leadId: call.leadId! },
      });
      if (owned !== removed.length)
        throw new VoiceError(
          "A removed lender does not belong to this lead.",
          403,
        );
      await tx.leadDebt.deleteMany({
        where: { id: { in: removed }, leadId: call.leadId! },
      });
    }
    const total = debtTotal(rows);
    await tx.voiceCall.update({
      where: { id: input.id },
      data: {
        openerId: session.userId,
        qualifiedAt: new Date(),
        qualifiedDebt: total,
        qualifiedDebts: rows,
        qualificationNotes: input.notes,
        salesStage: "QUALIFIED",
        transferManagerId: null,
        transferReviewedAt: null,
        transferRequestedAt: null,
        transferReadyAt: null,
        transferTargetId: null,
        transferRequestKey: null,
        transferReason: null,
      },
    });
    await tx.lead.update({
      where: { id: call.leadId! },
      data: {
        totalDebtEst: total,
        numberOfLenders: rows.length,
        status: "QUALIFIED",
      },
    });
    if (removed.length) {
      const { recalcLeadWeeklyPayment } =
        await import("@/lib/lead-debt-rollup");
      await recalcLeadWeeklyPayment(call.leadId!, tx);
    }
    await tx.voiceEvent.create({
      data: {
        voiceCallId: input.id,
        actorId: session.userId,
        kind: "QUALIFIED",
        detail: `Confirmed debt: ${total}; lenders: ${rows.length}`,
      },
    });
  });
}

async function managerRecipients(openerId: string) {
  const people = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, role: true, managerId: true },
  });
  const recipients = await Promise.all(
    people.map(async (person) => {
      const permissions = [...(await loadEffectivePermissions(person.id))];
      const global =
        ["ADMIN", "SUPER_ADMIN"].includes(person.role) ||
        permissions.includes("Modify.AllData");
      return canSupervise(person.role, permissions) &&
        hasPermission(permissions, "Call.Log") &&
        (global || teamOwnerIds(person.id, people).includes(openerId))
        ? person.id
        : null;
    }),
  );
  return recipients.filter((id): id is string => !!id);
}
async function ping(
  tx: Prisma.TransactionClient,
  ids: string[],
  callId: string,
  actorId: string,
  title: string,
  url: string,
) {
  await tx.notification.createMany({
    data: [...new Set(ids)].map((recipientId) => ({
      recipientId,
      actorId,
      kind: "CALL_TRANSFER",
      title,
      url,
      entityType: "VoiceCall",
      entityId: callId,
    })),
  });
}
export async function requestTransfer(session: AuthedSession, id: string) {
  await ownedCall(session, id);
  const managers = await managerRecipients(session.userId);
  if (!managers.length)
    throw new VoiceError(
      "No Floor Manager has access to your team. Ask an administrator to assign one.",
      409,
    );
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "VoiceCall" WHERE id=${id} FOR UPDATE`;
    const call = await tx.voiceCall.findUniqueOrThrow({ where: { id } });
    if (
      call.agentId !== session.userId ||
      call.openerId !== session.userId ||
      call.status !== "IN_PROGRESS" ||
      !call.qualifiedAt ||
      !readQualifiedDebts(call.qualifiedDebts).length ||
      call.closerHandoffId
    )
      throw new VoiceError(
        "Save the lender details and qualification first.",
        409,
      );
    if (APPROVAL_STAGES.includes(call.salesStage))
      throw new VoiceError("A handoff request is already pending.", 409);
    await tx.voiceCall.update({
      where: { id },
      data: {
        salesStage: "PENDING_APPROVAL",
        transferRequestKey: randomUUID(),
        transferRequestedAt: new Date(),
        transferManagerId: null,
        transferReviewedAt: null,
        transferTargetId: null,
        transferReadyAt: null,
        transferReason: null,
      },
    });
    await ping(
      tx,
      managers,
      id,
      session.userId,
      "Opener is requesting transfer approval",
      "/call-center/live-floor#transfer-approvals",
    );
    await tx.voiceEvent.create({
      data: {
        voiceCallId: id,
        actorId: session.userId,
        kind: "TRANSFER_APPROVAL_REQUESTED",
      },
    });
  });
}
export async function reviewTransfer(
  session: AuthedSession,
  input: {
    id: string;
    requestKey: string;
    approve: boolean;
    target?: string;
    reason?: string;
  },
) {
  const scope = await superviseScope(session);
  if (input.approve && !input.target)
    throw new VoiceError("Choose the receiving closer.");
  if (
    input.target &&
    !hasPermission(
      [...(await loadEffectivePermissions(input.target))],
      "Call.Log",
    )
  )
    throw new VoiceError("The closer needs calling permission.", 403);
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "VoiceCall" WHERE id=${input.id} FOR UPDATE`;
    const call = await tx.voiceCall.findUniqueOrThrow({
      where: { id: input.id },
    });
    if (!call.openerId || !scope.includes(call.openerId))
      throw new VoiceError("This opener is outside your team.", 403);
    if (
      call.status !== "IN_PROGRESS" ||
      call.salesStage !== "PENDING_APPROVAL" ||
      call.transferRequestKey !== input.requestKey
    )
      throw new VoiceError("This request has already changed.", 409);
    if (input.approve) {
      const closer = await tx.user.findUnique({
        where: { id: input.target! },
        select: { isActive: true, isCloser: true, closerTier: true },
      });
      const tier = tierForDebt(call.qualifiedDebt!, await debtRouting(tx));
      if (
        !closer?.isActive ||
        !isCloser(closer) ||
        closer.closerTier !== tier ||
        input.target === call.openerId
      )
        throw new VoiceError(`Choose an active Tier ${tier} closer.`);
    }
    await tx.voiceCall.update({
      where: { id: input.id },
      data: {
        salesStage: input.approve ? "PENDING_CLOSER" : "TRANSFER_REJECTED",
        transferManagerId: session.userId,
        transferReviewedAt: new Date(),
        transferTargetId: input.approve ? input.target : null,
        transferReason: input.reason?.trim() || null,
      },
    });
    await ping(
      tx,
      input.approve ? [input.target!] : [call.openerId],
      input.id,
      session.userId,
      input.approve
        ? "Approved client handoff — mark open when ready"
        : "Floor Manager declined the handoff",
      input.approve
        ? "/call-center/closer#handoff-requests"
        : "/call-center/opener",
    );
    await tx.voiceEvent.create({
      data: {
        voiceCallId: input.id,
        actorId: session.userId,
        kind: input.approve ? "TRANSFER_APPROVED" : "TRANSFER_REJECTED",
        detail: input.approve ? input.target : input.reason,
      },
    });
  });
}
export async function closerReady(
  session: AuthedSession,
  id: string,
  requestKey: string,
) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "VoiceCall" WHERE id=${id} FOR UPDATE`;
    const call = await tx.voiceCall.findUniqueOrThrow({ where: { id } });
    const user = await tx.user.findUniqueOrThrow({
      where: { id: session.userId },
      select: { isActive: true, isCloser: true, closerTier: true },
    });
    if (
      call.transferTargetId !== session.userId ||
      !user.isActive ||
      !isCloser(user)
    )
      throw new VoiceError("This handoff is assigned to another closer.", 403);
    if (
      call.status !== "IN_PROGRESS" ||
      call.salesStage !== "PENDING_CLOSER" ||
      !call.transferReviewedAt ||
      call.transferRequestKey !== requestKey
    )
      throw new VoiceError("This handoff is no longer waiting for you.", 409);
    if (
      user.closerTier !==
      tierForDebt(call.qualifiedDebt!, await debtRouting(tx))
    )
      throw new VoiceError(
        "The debt tier has changed. Request a new approval.",
        409,
      );
    const claim = await tx.voiceAgent.updateMany({
      where: {
        userId: session.userId,
        activeCallId: null,
        status: { in: ["AVAILABLE", "PAUSED"] },
        heartbeatAt: { gte: freshSince() },
      },
      data: { activeCallId: id, closerOpen: true, status: "RESERVED" },
    });
    if (!claim.count)
      throw new VoiceError(
        "Connect your phone and finish your current call first.",
        409,
      );
    await tx.voiceCall.update({
      where: { id },
      data: { salesStage: "CLOSER_READY", transferReadyAt: new Date() },
    });
    await ping(
      tx,
      [call.openerId!],
      id,
      session.userId,
      "Your closer is ready — connect them to the call",
      "/call-center/opener",
    );
    await tx.voiceEvent.create({
      data: { voiceCallId: id, actorId: session.userId, kind: "CLOSER_READY" },
    });
  });
}
export async function cancelTransferRequest(
  session: AuthedSession,
  id: string,
) {
  await ownedCall(session, id);
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "VoiceCall" WHERE id=${id} FOR UPDATE`;
    const call = await tx.voiceCall.findUniqueOrThrow({ where: { id } });
    if (
      call.agentId !== session.userId ||
      !["PENDING_APPROVAL", "PENDING_CLOSER", "CLOSER_READY"].includes(
        call.salesStage,
      )
    )
      throw new VoiceError("This request cannot be canceled now.", 409);
    await tx.voiceAgent.updateMany({
      where: {
        userId: call.transferTargetId || "",
        activeCallId: id,
        status: "RESERVED",
      },
      data: { activeCallId: null, status: "PAUSED", closerOpen: false },
    });
    await tx.voiceCall.update({
      where: { id },
      data: {
        salesStage: "QUALIFIED",
        transferReadyAt: null,
        transferTargetId: null,
        transferRequestKey: null,
        transferManagerId: null,
        transferReviewedAt: null,
        transferRequestedAt: null,
        transferReason: null,
      },
    });
    await tx.voiceEvent.create({
      data: {
        voiceCallId: id,
        actorId: session.userId,
        kind: "TRANSFER_REQUEST_CANCELED",
      },
    });
  });
}

export async function validateCloserTransfer(
  tx: Prisma.TransactionClient,
  callId: string,
  target: string,
) {
  const call = await tx.voiceCall.findUniqueOrThrow({ where: { id: callId } });
  const user = await tx.user.findUnique({
    where: { id: target },
    select: { isActive: true, isCloser: true, closerTier: true },
  });
  if (!user?.isActive) throw new VoiceError("The receiving agent is inactive.");
  if (!isCloser(user)) {
    if (call.qualifiedAt)
      throw new VoiceError(
        "Qualified clients require a Floor Manager-approved closer.",
        403,
      );
    return false;
  }
  if (
    !call.qualifiedAt ||
    !call.qualifiedDebt ||
    !call.openerId ||
    call.closerHandoffId
  )
    throw new VoiceError(
      "Save the opener's qualification before transferring to a closer.",
    );
  if (
    call.salesStage !== "CLOSER_READY" ||
    !call.transferReviewedAt ||
    !call.transferReadyAt ||
    call.transferTargetId !== target
  )
    throw new VoiceError(
      "Floor Manager approval and the assigned closer's readiness are required.",
      409,
    );
  const tier = tierForDebt(call.qualifiedDebt, await debtRouting(tx));
  if (user.closerTier !== tier)
    throw new VoiceError(`This debt amount requires a Tier ${tier} closer.`);
  const seat = await tx.voiceAgent.findUnique({ where: { userId: target } });
  if (
    !seat?.closerOpen ||
    seat.status !== "RESERVED" ||
    seat.activeCallId !== callId ||
    seat.heartbeatAt < freshSince()
  )
    throw new VoiceError(
      "This closer is closed, offline, or already on a call.",
      409,
    );
  return true;
}
export async function transferQualified(
  session: AuthedSession,
  id: string,
  target?: string,
) {
  const call = await ownedCall(session, id);
  if (
    !call.qualifiedAt ||
    !call.qualifiedDebt ||
    call.openerId !== session.userId ||
    call.closerHandoffId
  )
    throw new VoiceError("Save the opener qualification first.");
  if (
    call.salesStage !== "CLOSER_READY" ||
    !call.transferTargetId ||
    (target && target !== call.transferTargetId)
  )
    throw new VoiceError(
      "Wait for Floor Manager approval and the assigned closer to mark open.",
      409,
    );
  if (
    !hasPermission(
      [...(await loadEffectivePermissions(call.transferTargetId))],
      "Call.Log",
    )
  )
    throw new VoiceError("The closer no longer has calling permission.", 403);
  await transfer(session, id, call.transferTargetId);
}

export async function salesOverview(
  session: AuthedSession,
  visibleIds: string[],
  supervisor: boolean,
) {
  const [current, config, people, handoffs] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: session.userId },
      select: { isActive: true, role: true, isCloser: true, closerTier: true },
    }),
    debtRouting(),
    prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { voiceAgent: { isNot: null } },
          { isCloser: true },
          { closerTier: { not: null } },
        ],
      },
      select: {
        id: true,
        name: true,
        isCloser: true,
        closerTier: true,
        voiceAgent: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.closerHandoff.findMany({
      where: {
        ...(supervisor
          ? {
              OR: [
                { closerId: { in: visibleIds } },
                { fronterId: { in: visibleIds } },
              ],
            }
          : {
              OR: [{ closerId: session.userId }, { fronterId: session.userId }],
            }),
        voiceCall: { isNot: null },
      },
      include: {
        fronter: { select: { name: true } },
        closer: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);
  return {
    role: isCloser(current) ? "CLOSER" : "OPENER",
    access: callingAccess(current, session.permissions),
    config,
    handoffs,
    roster: people.map((user) => {
      const seat = user.voiceAgent;
      const fresh = !!seat && seat.heartbeatAt >= freshSince();
      const role = isCloser(user) ? "CLOSER" : "OPENER";
      const state = seat?.activeCallId
        ? seat.status === "RESERVED"
          ? "RESERVED"
          : seat.status === "WRAP_UP"
            ? "WRAP_UP"
            : "ON_CALL"
        : !fresh || seat?.status === "OFFLINE"
          ? "OFFLINE"
          : role === "CLOSER"
            ? seat?.closerOpen && seat.status === "AVAILABLE"
              ? "OPEN"
              : "CLOSED"
            : seat?.status === "AVAILABLE"
              ? "READY"
              : "PAUSED";
      return {
        id: user.id,
        name: user.name,
        role,
        tier: user.closerTier,
        state,
        fresh,
        changedAt: seat?.updatedAt,
        open: !!seat?.closerOpen,
        callId:
          visibleIds.includes(user.id) || user.id === session.userId
            ? seat?.activeCallId || null
            : null,
      };
    }),
  };
}
