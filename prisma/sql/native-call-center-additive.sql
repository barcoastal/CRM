-- CreateTable
CREATE TABLE "VoiceQueue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "maxWaitSeconds" INTEGER NOT NULL DEFAULT 180,
    "greeting" TEXT NOT NULL DEFAULT 'Thank you for calling. Please stay on the line for the next available agent.',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceQueueMember" (
    "queueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "VoiceQueueMember_pkey" PRIMARY KEY ("queueId","userId")
);

-- CreateTable
CREATE TABLE "VoiceAgent" (
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OFFLINE',
    "activeCallId" TEXT,
    "heartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceAgent_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "VoiceCall" (
    "id" TEXT NOT NULL,
    "callId" TEXT,
    "queueId" TEXT,
    "leadId" TEXT,
    "campaignId" TEXT,
    "campaignContactId" TEXT,
    "agentId" TEXT,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONNECTING',
    "phoneNumber" TEXT NOT NULL,
    "fromNumber" TEXT NOT NULL,
    "customerSid" TEXT,
    "conferenceSid" TEXT,
    "customerDialStarted" BOOLEAN NOT NULL DEFAULT false,
    "held" BOOLEAN NOT NULL DEFAULT false,
    "disposition" TEXT,
    "notes" TEXT,
    "recordingSid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceParticipant" (
    "id" TEXT NOT NULL,
    "voiceCallId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "mode" TEXT,
    "callSid" TEXT,
    "joinedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceEvent" (
    "id" TEXT NOT NULL,
    "voiceCallId" TEXT NOT NULL,
    "actorId" TEXT,
    "kind" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VoiceQueue_phoneNumber_key" ON "VoiceQueue"("phoneNumber");

-- CreateIndex
CREATE INDEX "VoiceAgent_status_heartbeatAt_idx" ON "VoiceAgent"("status", "heartbeatAt");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceCall_callId_key" ON "VoiceCall"("callId");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceCall_customerSid_key" ON "VoiceCall"("customerSid");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceCall_conferenceSid_key" ON "VoiceCall"("conferenceSid");

-- CreateIndex
CREATE INDEX "VoiceCall_queueId_status_createdAt_idx" ON "VoiceCall"("queueId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "VoiceCall_agentId_createdAt_idx" ON "VoiceCall"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "VoiceCall_campaignContactId_status_idx" ON "VoiceCall"("campaignContactId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceParticipant_callSid_key" ON "VoiceParticipant"("callSid");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceParticipant_voiceCallId_userId_key" ON "VoiceParticipant"("voiceCallId", "userId");

-- CreateIndex
CREATE INDEX "VoiceEvent_voiceCallId_createdAt_idx" ON "VoiceEvent"("voiceCallId", "createdAt");

-- AddForeignKey
ALTER TABLE "VoiceQueueMember" ADD CONSTRAINT "VoiceQueueMember_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "VoiceQueue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceQueueMember" ADD CONSTRAINT "VoiceQueueMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceAgent" ADD CONSTRAINT "VoiceAgent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCall" ADD CONSTRAINT "VoiceCall_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCall" ADD CONSTRAINT "VoiceCall_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "VoiceQueue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceParticipant" ADD CONSTRAINT "VoiceParticipant_voiceCallId_fkey" FOREIGN KEY ("voiceCallId") REFERENCES "VoiceCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceEvent" ADD CONSTRAINT "VoiceEvent_voiceCallId_fkey" FOREIGN KEY ("voiceCallId") REFERENCES "VoiceCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

