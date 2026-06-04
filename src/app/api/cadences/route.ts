import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function GET(_request: NextRequest) {
  const r = await requireAuthOrRespond("Lead.Read");
  if ("response" in r) return r.response;
  const cadences = await prisma.callCadence.findMany({
    orderBy: { name: "asc" },
    include: {
      steps: { orderBy: { stepOrder: "asc" } },
      _count: { select: { enrollments: true } },
    },
  });
  return NextResponse.json({ items: cadences });
}

export async function POST(request: NextRequest) {
  const r = await requireAuthOrRespond("Lead.Edit");
  if ("response" in r) return r.response;
  const body = await request.json().catch(() => ({}));
  const { name, description, recordType, steps } = body ?? {};
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const cadence = await prisma.callCadence.create({
    data: {
      name,
      description: description ?? null,
      recordType: recordType ?? "OUTBOUND",
      steps: {
        create: Array.isArray(steps)
          ? steps.map((s, i: number) => ({
              stepOrder: i + 1,
              action: s.action ?? "TASK",
              delayDays: s.delayDays ?? 0,
              delayHours: s.delayHours ?? 0,
              emailTemplateId: s.emailTemplateId ?? null,
              smsBodyTemplate: s.smsBodyTemplate ?? null,
              callScript: s.callScript ?? null,
              taskSubject: s.taskSubject ?? null,
              branchOn: s.branchOn ?? null,
              branchToStep: s.branchToStep ?? null,
            }))
          : [],
      },
    },
    include: { steps: true },
  });
  return NextResponse.json(cadence);
}
