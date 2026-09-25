-- Apply after native-call-center-sales-roles.sql. No calling or routing is enabled by this migration.
BEGIN;
ALTER TABLE "VoiceCall"
  ADD COLUMN "qualifiedDebts" JSONB,
  ADD COLUMN "transferRequestKey" TEXT,
  ADD COLUMN "transferRequestedAt" TIMESTAMP(3),
  ADD COLUMN "transferManagerId" TEXT,
  ADD COLUMN "transferReviewedAt" TIMESTAMP(3),
  ADD COLUMN "transferTargetId" TEXT,
  ADD COLUMN "transferReadyAt" TIMESTAMP(3),
  ADD COLUMN "transferReason" TEXT;
CREATE INDEX "VoiceCall_salesStage_transferTargetId_idx" ON "VoiceCall"("salesStage", "transferTargetId");
COMMIT;
