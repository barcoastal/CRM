-- Apply once AFTER native-call-center-additive.sql. No historical records are deleted.
BEGIN;
ALTER TABLE "VoiceAgent" ADD COLUMN "standbyKey" TEXT, ADD COLUMN "standbySid" TEXT, ADD COLUMN "standbyReady" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "VoiceAgent_standbyKey_key" ON "VoiceAgent"("standbyKey");
CREATE UNIQUE INDEX "VoiceAgent_standbySid_key" ON "VoiceAgent"("standbySid");
ALTER TABLE "VoiceCall" ADD COLUMN "workflow" TEXT NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "attemptStartedAt" TIMESTAMP(3), ADD COLUMN "customerAnsweredAt" TIMESTAMP(3),
  ADD COLUMN "customerJoinedAt" TIMESTAMP(3), ADD COLUMN "humanDetectedAt" TIMESTAMP(3),
  ADD COLUMN "bridgedAt" TIMESTAMP(3), ADD COLUMN "abandonedAt" TIMESTAMP(3), ADD COLUMN "machineResult" TEXT;
CREATE INDEX "VoiceCall_workflow_endedAt_createdAt_idx" ON "VoiceCall"("workflow", "endedAt", "createdAt");
CREATE INDEX "VoiceCall_phoneNumber_endedAt_idx" ON "VoiceCall"("phoneNumber", "endedAt");
-- An agent's open audio leg is reused sequentially, in distinct conferences.
DROP INDEX "VoiceParticipant_callSid_key";
CREATE INDEX "VoiceParticipant_callSid_idx" ON "VoiceParticipant"("callSid");
CREATE TABLE "VoiceOutboundSettings" (
  "id" TEXT NOT NULL DEFAULT 'default', "webEnabled" BOOLEAN NOT NULL DEFAULT false,
  "webEnabledAt" TIMESTAMP(3), "webMemberIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "ownerFirst" BOOLEAN NOT NULL DEFAULT false, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VoiceOutboundSettings_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "VoiceWebLead" (
  "leadId" TEXT NOT NULL, "receivedAt" TIMESTAMP(3) NOT NULL, "deadlineAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'WAITING', "reason" TEXT, "voiceCallId" TEXT,
  "attemptedAt" TIMESTAMP(3), "retryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VoiceWebLead_pkey" PRIMARY KEY ("leadId"),
  CONSTRAINT "VoiceWebLead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "VoiceWebLead_voiceCallId_key" ON "VoiceWebLead"("voiceCallId");
CREATE INDEX "VoiceWebLead_status_deadlineAt_idx" ON "VoiceWebLead"("status", "deadlineAt");
CREATE INDEX "VoiceWebLead_status_retryAt_idx" ON "VoiceWebLead"("status", "retryAt");
CREATE TABLE "VoiceDialingCampaign" (
  "campaignId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PAUSED', "maxLines" INTEGER NOT NULL DEFAULT 10,
  "lineScope" TEXT NOT NULL DEFAULT 'TEAM', "pauseReason" TEXT, "startedAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VoiceDialingCampaign_pkey" PRIMARY KEY ("campaignId"),
  CONSTRAINT "VoiceDialingCampaign_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "VoiceDialerLease" (
  "id" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VoiceDialerLease_pkey" PRIMARY KEY ("id")
);
COMMIT;
