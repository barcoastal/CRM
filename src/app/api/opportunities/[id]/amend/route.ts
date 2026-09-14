import { ssnSafeJson } from "@/lib/ssn-safe-json";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Opportunity.Edit");
  if ("response" in r) return r.response;
  const { session } = r;
  const { id } = await params;
  const opp = await prisma.opportunity.findUnique({ where: { id } });
  if (!opp) return ssnSafeJson({ error: "Not found" }, { status: 404 });

  // version bump: "1.0" → "1.1" → "1.2" etc.
  const parts = (opp.version || "1.0").split(".");
  const major = parts[0] ?? "1";
  const minor = Number(parts[1] ?? "0") + 1;
  const next = `${major}.${minor}`;

  await prisma.$transaction([
    prisma.opportunity.update({ where: { id }, data: { version: next } }),
    prisma.opportunityHistory.create({
      data: {
        opportunityId: id,
        field: "Version",
        oldValue: opp.version,
        newValue: next,
        changedById: session.userId,
      },
    }),
  ]);

  return ssnSafeJson({ ok: true, version: next });
}
