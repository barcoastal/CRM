import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateSalesforcePilot } from "@/lib/esign/salesforce/auth";
import { sourceSchema } from "@/lib/esign/salesforce/policy";
import { issueEmbedToken } from "@/lib/esign/salesforce/embed";
export async function POST(
  req: NextRequest,
  c: { params: Promise<{ id: string }> },
) {
  const pilot = await authenticateSalesforcePilot(req.headers);
  if (!pilot)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (body?.salesforceUserId !== pilot.salesforceUserId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await c.params;
  const packet = await prisma.signingPacket.findFirst({
    where: { id, createdById: pilot.senderUserId },
  });
  const source = sourceSchema.safeParse(packet?.salesforceSource);
  if (
    !source.success ||
    source.data.orgId !== pilot.orgId ||
    source.data.opportunityId !== pilot.opportunityId
  )
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(
    { token: issueEmbedToken(pilot, id) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
