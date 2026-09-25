-- Apply once after native-call-center-outbound.sql. Existing closer roster and debt limits are reused.
BEGIN;
ALTER TABLE "VoiceAgent" ADD COLUMN "closerOpen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "VoiceCall" ADD COLUMN "openerId" TEXT,
  ADD COLUMN "qualifiedAt" TIMESTAMP(3), ADD COLUMN "qualifiedDebt" DOUBLE PRECISION,
  ADD COLUMN "qualificationNotes" TEXT, ADD COLUMN "salesStage" TEXT NOT NULL DEFAULT 'OPENING',
  ADD COLUMN "closerHandoffId" TEXT;
CREATE UNIQUE INDEX "VoiceCall_closerHandoffId_key" ON "VoiceCall"("closerHandoffId");
ALTER TABLE "VoiceCall" ADD CONSTRAINT "VoiceCall_closerHandoffId_fkey" FOREIGN KEY ("closerHandoffId") REFERENCES "CloserHandoff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
COMMIT;
