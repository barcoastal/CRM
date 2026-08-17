/**
 * POST /api/emails/mass/[id]/send — kicks off the blast, or schedules it.
 *
 * Body: { scheduledAt?: string }
 *   - If scheduledAt is a future ISO date: sets status=SCHEDULED and returns
 *     { ok: true, scheduled: true } WITHOUT sending.
 *   - Otherwise: validates DRAFT|SCHEDULED status, caps audience to 500,
 *     runs startMassEmailJob synchronously, returns final counts.
 *
 * Returns 409 when status is not DRAFT or SCHEDULED.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { countAudience, startMassEmailJob } from "@/lib/email/mass-sender";

const MAX_RECIPIENTS = 500;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as { scheduledAt?: string };

  const mass = await prisma.massEmail.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      audienceType: true,
      audienceFilter: true,
      audienceIds: true,
      audienceSources: true,
      templateId: true,
    },
  });
  if (!mass) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (mass.status !== "DRAFT" && mass.status !== "SCHEDULED") {
    return NextResponse.json({ error: `Cannot send blast in status ${mass.status}` }, { status: 409 });
  }

  if (!mass.templateId) {
    return NextResponse.json({ error: "Template missing" }, { status: 400 });
  }

  // Scheduling: if scheduledAt is provided and is a future date, schedule without sending.
  if (body.scheduledAt) {
    const scheduledDate = new Date(body.scheduledAt);
    if (!isNaN(scheduledDate.getTime()) && scheduledDate > new Date()) {
      await prisma.massEmail.update({
        where: { id },
        data: { status: "SCHEDULED", scheduledAt: scheduledDate },
      });
      return NextResponse.json({ ok: true, scheduled: true });
    }
  }

  const filter = (mass.audienceFilter ?? {}) as Record<string, unknown>;
  const count = await countAudience(mass.audienceType, filter as never, mass.audienceIds, mass.audienceSources);
  if (count === 0) {
    return NextResponse.json({ error: "No recipients match the audience" }, { status: 400 });
  }
  if (count > MAX_RECIPIENTS) {
    return NextResponse.json(
      {
        error: `Audience too large (${count}). Cap is ${MAX_RECIPIENTS}; batch the send into smaller blasts.`,
      },
      { status: 413 },
    );
  }

  await prisma.massEmail.update({ where: { id }, data: { status: "SENDING", totalCount: count } });
  const result = await startMassEmailJob(id);

  const refreshed = await prisma.massEmail.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      totalCount: true,
      sentCount: true,
      failedCount: true,
      openCount: true,
      clickCount: true,
      sentAt: true,
    },
  });

  return NextResponse.json({ ok: result.ok, error: result.error, massEmail: refreshed });
}
