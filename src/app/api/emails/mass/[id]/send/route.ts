/**
 * POST /api/emails/mass/[id]/send — kicks off the blast.
 *
 * Validates DRAFT status, caps audience to 500 (callers should batch larger
 * sends to avoid blocking the request too long), flips status to SENDING,
 * runs startMassEmailJob synchronously, then returns the final counts.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { countAudience, startMassEmailJob } from "@/lib/email/mass-sender";

const MAX_RECIPIENTS = 500;

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

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
  if (mass.status !== "DRAFT") {
    return NextResponse.json({ error: `Cannot send blast in status ${mass.status}` }, { status: 409 });
  }
  if (!mass.templateId) {
    return NextResponse.json({ error: "Template missing" }, { status: 400 });
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
