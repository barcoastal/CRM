import { NextRequest } from "next/server";
import { handleWebhook } from "@/lib/webhooks";

/**
 * Ad-click attribution webhook (gclid/fbclid/eli capture). Just logs the event;
 * cross-referencing to a Lead happens in a later attribution job (Phase 7).
 */
export async function POST(req: NextRequest) {
  return handleWebhook({
    req, source: "AD_CLICK",
    endpoint: "/api/webhooks/ad-click",
    secretEnvVar: "AD_CLICK_WEBHOOK_SECRET",
    process: async () => {
      return { status: "PROCESSED", note: "click logged (attribution job runs in Phase 7)" };
    },
  });
}
