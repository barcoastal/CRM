import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleWebhook } from "@/lib/webhooks";

/**
 * Payment processor (e.g. RAM) draft-status callback. Expected body shape:
 *   { draftId: string, status: "SUCCESS"|"FAILED", returnCode?: string, returnReason?: string }
 * Updates the Draft + processedAt/settledAt. Idempotent on repeat callbacks.
 */
export async function POST(req: NextRequest) {
  return handleWebhook({
    req, source: "PAYMENT_PROCESSOR",
    endpoint: "/api/webhooks/payment-processor",
    secretEnvVar: "PAYMENT_PROCESSOR_WEBHOOK_SECRET",
    process: async (payload) => {
      const p = payload as { draftId?: string; status?: string; returnCode?: string; returnReason?: string };
      if (!p?.draftId || !p?.status) return { status: "IGNORED", note: "missing draftId or status" };
      const draft = await prisma.draft.findUnique({ where: { id: p.draftId } });
      if (!draft) return { status: "IGNORED", note: `draft ${p.draftId} not found` };
      if (draft.status === "SUCCESS" || draft.status === "FAILED") {
        return { status: "IGNORED", note: `already terminal: ${draft.status}` };
      }

      const data: Record<string, unknown> = { status: p.status, processedAt: new Date() };
      if (p.status === "SUCCESS") data.settledAt = new Date();
      if (p.status === "FAILED") {
        data.returnCode = p.returnCode ?? null;
        data.returnReason = p.returnReason ?? null;
      }
      await prisma.draft.update({ where: { id: p.draftId }, data });
      return { status: "PROCESSED", note: `draft ${p.draftId} → ${p.status}` };
    },
  });
}
