-- Additive-only local/prod rollout for the second AI dialer.
-- Safe to run repeatedly; it intentionally does not reconcile unrelated drift.

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "aiCallConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "aiCallConsentAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "aiCallConsentSource" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "aiCallConsentText" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "aiCallConsentIp" TEXT;

ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "aiEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "aiAgentId" TEXT;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "aiMaxConcurrency" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "meetingDurationMin" INTEGER NOT NULL DEFAULT 30;

CREATE TABLE IF NOT EXISTS "AiOutboundNumber" (
  "id" TEXT PRIMARY KEY,
  "phoneNumber" TEXT NOT NULL,
  "state" TEXT,
  "retellNumberId" TEXT,
  "label" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "AiOutboundNumber_phoneNumber_key" ON "AiOutboundNumber"("phoneNumber");
CREATE INDEX IF NOT EXISTS "AiOutboundNumber_state_isActive_priority_idx" ON "AiOutboundNumber"("state", "isActive", "priority");

CREATE TABLE IF NOT EXISTS "AiCall" (
  "id" TEXT PRIMARY KEY,
  "retellCallId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "campaignId" TEXT,
  "outboundNumberId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'REGISTERED',
  "outcome" TEXT,
  "fromNumber" TEXT NOT NULL,
  "toNumber" TEXT NOT NULL,
  "disconnectionReason" TEXT,
  "durationMs" INTEGER,
  "transcript" TEXT,
  "summary" TEXT,
  "analysis" JSONB,
  "metadata" JSONB,
  "transferred" BOOLEAN NOT NULL DEFAULT false,
  "meetingAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiCall_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AiCall_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AiCall_outboundNumberId_fkey" FOREIGN KEY ("outboundNumberId") REFERENCES "AiOutboundNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "AiCall_retellCallId_key" ON "AiCall"("retellCallId");
CREATE INDEX IF NOT EXISTS "AiCall_campaignId_status_idx" ON "AiCall"("campaignId", "status");
CREATE INDEX IF NOT EXISTS "AiCall_leadId_createdAt_idx" ON "AiCall"("leadId", "createdAt");
CREATE INDEX IF NOT EXISTS "AiCall_outcome_createdAt_idx" ON "AiCall"("outcome", "createdAt");
