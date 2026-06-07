import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPostback } from "@/lib/marketing/postback";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, logId } = await params;

  const log = await prisma.marketingPostbackLog.findUnique({ where: { id: logId } });
  if (!log || log.endpointId !== id) {
    return NextResponse.json({ error: "Log not found" }, { status: 404 });
  }

  // Reset attempts so the retry runs the full attempt budget again.
  const reset = await prisma.marketingPostbackLog.update({
    where: { id: logId },
    data: { attempts: 0, status: "queued", lastError: null, responseStatus: null, responseBody: null as never, sentAt: null },
  });

  const result = await sendPostback({
    endpointId: id,
    event: reset.event,
    entityType: reset.entityType,
    entityId: reset.entityId,
    data: reset.requestBody as Record<string, unknown>,
    existingLogId: reset.id,
  });

  return NextResponse.json(result);
}
