import { prisma } from "@/lib/prisma";
/** One atomic, idempotent daily observation. Earlier history is never fabricated. */
export async function captureDailyPipeline(now = new Date(), db: Pick<typeof prisma, "opportunitySnapshot" | "$executeRaw"> = prisma): Promise<number> {
  const date = new Date(now.toISOString().slice(0, 10));
  if (await db.opportunitySnapshot.findFirst({ where: { capturedAt: date }, select: { id: true } })) return 0;
  return db.$executeRaw`
    INSERT INTO "OpportunitySnapshot" ("id", "opportunityId", "capturedAt", "stage", "amount", "totalDebt", "isClosed", "isWon", "assignedToId", "assignedToName", "createdAt")
    SELECT md5(o."id" || ${date.toISOString()}), o."id", ${date}, o."stage", o."amount", COALESCE(o."totalDebt", 0),
      COALESCE(o."isClosed", false) OR o."stage" IN ('Closed Won','Closed Lost','CLOSED','CLOSED_WON_FIRST_PAYMENT','ARCHIVED'),
      COALESCE(o."isWon", false) OR o."stage" IN ('Closed Won','CLOSED_WON_FIRST_PAYMENT'),
      o."assignedToId", u."name", NOW()
    FROM "Opportunity" o LEFT JOIN "User" u ON u."id" = o."assignedToId"
    ON CONFLICT ("opportunityId", "capturedAt") DO NOTHING`;
}
let armed = false;
export function schedulePipelineHistory() {
  if (armed || process.env.NEXT_PHASE === "phase-production-build") return;
  armed = true; let running = false;
  const tick = async () => { if (running) return; running = true; try { await captureDailyPipeline(); } catch (e) { console.error("[pipeline-history]", e instanceof Error ? e.message : "Capture failed"); } finally { running = false; } };
  setTimeout(() => void tick(), 120000).unref();
  setInterval(() => void tick(), 3600000).unref();
}
